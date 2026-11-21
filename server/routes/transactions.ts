/**
 * PRYORA Transactions API Routes
 *
 * Implements:
 * - Strict user ownership verification on all accounts, categories, splits, and recurring rules
 * - Atomic balance adjustments using domain invariants
 * - Split transactions validation and persistence
 * - Smart natural-language filter parser
 * - Duplicate transaction detection
 * - Validated receipt image attachments (JPEG/PNG/WebP only, <= 10MB)
 * - Idempotency-Key deduplication for offline replay safety
 */

import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';
import { calculateBalanceDeltas, validateTransactionSplits, AccountType } from '../domain/finance.js';
import { getIdempotentResponse, setIdempotentResponse } from '../middleware/security.js';

export const transactionsRouter = Router();

const ALLOWED_TX_TYPES = new Set(['expense', 'income', 'transfer', 'refund', 'reimbursement']);
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB decoded
const RECEIPT_DATA_URL_REGEX = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

function validateAndParseReceipt(
  receiptDataUrl: unknown,
  receiptFileName: unknown
): { mimeType: string; dataUrl: string; fileSize: number; fileName: string } | { error: string } {
  if (typeof receiptDataUrl !== 'string') {
    return { error: 'Invalid receipt attachment payload.' };
  }

  const match = receiptDataUrl.trim().match(RECEIPT_DATA_URL_REGEX);
  if (!match) {
    return { error: 'Only JPEG, PNG, and WebP receipt images are supported.' };
  }

  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const base64Body = match[2].replace(/\s+/g, '');
  const estimatedBytes = Math.floor((base64Body.length * 3) / 4);

  if (estimatedBytes <= 0 || estimatedBytes > MAX_RECEIPT_BYTES) {
    return { error: 'Receipt image must be 10MB or smaller.' };
  }

  const rawName = typeof receiptFileName === 'string' ? receiptFileName.trim() : 'receipt.jpg';
  const safeName = rawName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'receipt.jpg';

  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${base64Body}`,
    fileSize: estimatedBytes,
    fileName: safeName,
  };
}

function getOwnedCategoryIds(userId: string): Set<string> {
  const rows = query<{ id: string }>('SELECT id FROM categories WHERE user_id = ?', [userId]);
  return new Set(rows.map(r => r.id));
}

function isValidIsoDate(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

// GET /api/transactions
transactionsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      page = '1',
      limit = '50',
      type,
      accountId,
      categoryId,
      startDate,
      endDate,
      search,
      tag,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE t.user_id = ?';
    const params: (string | number)[] = [userId];

    if (type && ALLOWED_TX_TYPES.has(type)) {
      whereClause += ' AND t.type = ?';
      params.push(type);
    }

    if (accountId) {
      whereClause += ' AND (t.account_id = ? OR t.to_account_id = ?)';
      params.push(accountId, accountId);
    }

    if (categoryId) {
      whereClause +=
        ' AND (t.category_id = ? OR EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transaction_id = t.id AND ts.category_id = ?))';
      params.push(categoryId, categoryId);
    }

    if (startDate && isValidIsoDate(startDate)) {
      whereClause += ' AND t.date >= ?';
      params.push(startDate);
    }

    if (endDate && isValidIsoDate(endDate)) {
      whereClause += ' AND t.date <= ?';
      params.push(endDate);
    }

    if (tag) {
      whereClause += ' AND t.tags LIKE ?';
      params.push(`%"${tag.slice(0, 60)}"%`);
    }

    // Natural Language Search Handling
    if (search && search.trim()) {
      const q = search.trim().toLowerCase().slice(0, 120);
      const aboveMatch = q.match(/above\s+(\d+)/i) || q.match(/>\s*(\d+)/);
      const belowMatch = q.match(/below\s+(\d+)/i) || q.match(/<\s*(\d+)/);

      if (aboveMatch) {
        const amt = parseInt(aboveMatch[1], 10) * 100;
        whereClause += ' AND t.amount_minor >= ?';
        params.push(amt);
      } else if (belowMatch) {
        const amt = parseInt(belowMatch[1], 10) * 100;
        whereClause += ' AND t.amount_minor <= ?';
        params.push(amt);
      } else {
        whereClause += ` AND (
          LOWER(t.merchant) LIKE ? OR
          LOWER(COALESCE(t.notes, '')) LIKE ? OR
          LOWER(COALESCE(c.name, '')) LIKE ? OR
          LOWER(COALESCE(a.name, '')) LIKE ? OR
          LOWER(COALESCE(t.tags, '')) LIKE ?
        )`;
        const wildcard = `%${q}%`;
        params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
      }
    }

    const countSql = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
      LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
      ${whereClause}
    `;
    const countResult = queryOne<{ total: number }>(countSql, params);
    const totalCount = countResult ? countResult.total : 0;

    const sql = `
      SELECT t.id, t.account_id, t.to_account_id, t.category_id, t.type,
             t.amount_minor, t.currency, t.merchant, t.date, t.notes, t.tags,
             t.receipt_url, t.recurring_rule_id, t.is_split, t.created_at,
             a.name as account_name, a.type as account_type, a.color as account_color,
             to_a.name as to_account_name, to_a.type as to_account_type,
             c.name as category_name, c.icon as category_icon, c.color as category_color,
             (SELECT COUNT(*) FROM receipts r WHERE r.transaction_id = t.id AND r.user_id = t.user_id) as receipt_count
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
      LEFT JOIN accounts to_a ON to_a.id = t.to_account_id AND to_a.user_id = t.user_id
      LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
      ${whereClause}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const queryParams = [...params, limitNum, offset];
    const transactions = query<any>(sql, queryParams);

    res.json({
      transactions,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Could not fetch transactions.' });
  }
});

// GET /api/transactions/duplicates - Detect duplicate transactions
transactionsRouter.get('/duplicates', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const duplicates = query<any>(
      `SELECT t1.id as original_id, t1.date as original_date, t1.merchant, t1.amount_minor,
              t2.id as duplicate_id, t2.date as duplicate_date,
              a.name as account_name
       FROM transactions t1
       JOIN transactions t2 ON t1.user_id = t2.user_id
                           AND t1.id < t2.id
                           AND t1.merchant = t2.merchant
                           AND t1.amount_minor = t2.amount_minor
                           AND t1.type = t2.type
                           AND ABS(JULIANDAY(t1.date) - JULIANDAY(t2.date)) <= 2
       LEFT JOIN accounts a ON a.id = t1.account_id AND a.user_id = t1.user_id
       WHERE t1.user_id = ?
       ORDER BY t1.date DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ duplicates });
  } catch (err) {
    console.error('Error detecting duplicates:', err);
    res.status(500).json({ error: 'Could not run duplicate check.' });
  }
});

// GET /api/transactions/:id/splits
transactionsRouter.get('/:id/splits', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const txId = req.params.id;

    const splits = query<any>(
      `SELECT s.id, s.category_id, s.amount_minor, s.notes,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transaction_splits s
       JOIN transactions t ON t.id = s.transaction_id
       LEFT JOIN categories c ON c.id = s.category_id AND c.user_id = t.user_id
       WHERE s.transaction_id = ? AND t.user_id = ?`,
      [txId, userId]
    );

    res.json({ splits });
  } catch {
    res.status(500).json({ error: 'Could not fetch splits.' });
  }
});

// Helper: load owned account map for balance recalculation & ownership verification
function getAccountMap(userId: string): Map<string, { type: AccountType }> {
  const accounts = query<{ id: string; type: AccountType }>(
    'SELECT id, type FROM accounts WHERE user_id = ?',
    [userId]
  );
  return new Map(accounts.map(a => [a.id, { type: a.type }]));
}

// POST /api/transactions
transactionsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const idempotencyKey = req.headers['idempotency-key'];
    const cached = getIdempotentResponse(userId, 'POST:/api/transactions', idempotencyKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    const {
      accountId,
      toAccountId,
      categoryId,
      type,
      amount,
      merchant,
      date,
      notes,
      tags,
      receiptDataUrl,
      receiptFileName,
      splits,
      recurringRuleId,
    } = req.body || {};

    if (!accountId || typeof accountId !== 'string') {
      res.status(400).json({ error: 'Please select an account for this transaction.' });
      return;
    }

    if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
      res.status(400).json({ error: 'Merchant or source description is required.' });
      return;
    }

    const txType = (type || 'expense') as string;
    if (!ALLOWED_TX_TYPES.has(txType)) {
      res.status(400).json({ error: 'Invalid transaction type.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Transaction amount must be greater than zero.' });
      return;
    }

    if (txType === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      res.status(400).json({ error: 'Transfers require a distinct destination account.' });
      return;
    }

    // Ownership checks for accounts
    const accountMap = getAccountMap(userId);
    if (!accountMap.has(accountId)) {
      res.status(403).json({ error: 'Selected source account was not found in your workspace.' });
      return;
    }
    if (txType === 'transfer' && (!toAccountId || !accountMap.has(toAccountId))) {
      res.status(403).json({ error: 'Selected destination account was not found in your workspace.' });
      return;
    }

    // Ownership checks for categories & splits
    const ownedCategoryIds = getOwnedCategoryIds(userId);
    if (categoryId && !ownedCategoryIds.has(categoryId)) {
      res.status(403).json({ error: 'Selected category was not found in your workspace.' });
      return;
    }

    const isSplit = Array.isArray(splits) && splits.length > 1;
    if (isSplit) {
      for (const s of splits) {
        if (s.categoryId && !ownedCategoryIds.has(s.categoryId)) {
          res.status(403).json({ error: 'One or more split categories do not belong to your workspace.' });
          return;
        }
      }
      const splitItems = splits.map((s: any) => ({
        amountMinor: toMinorUnits(s.amount, currency),
        categoryId: s.categoryId,
        notes: s.notes,
      }));
      const validation = validateTransactionSplits(amountMinor, splitItems);
      if (!validation.valid) {
        res.status(400).json({
          error: `Split amounts do not match transaction total. Difference: ${validation.differenceMinor / 100}.`,
        });
        return;
      }
    }

    // Ownership check for optional recurringRuleId
    if (recurringRuleId) {
      const ownedRule = queryOne('SELECT id FROM recurring_rules WHERE id = ? AND user_id = ?', [
        recurringRuleId,
        userId,
      ]);
      if (!ownedRule) {
        res.status(403).json({ error: 'Referenced recurring rule was not found in your workspace.' });
        return;
      }
    }

    // Validate receipt attachment if provided
    let parsedReceipt: { mimeType: string; dataUrl: string; fileSize: number; fileName: string } | null = null;
    if (receiptDataUrl) {
      const check = validateAndParseReceipt(receiptDataUrl, receiptFileName);
      if ('error' in check) {
        res.status(400).json({ error: check.error });
        return;
      }
      parsedReceipt = check;
    }

    const deltas = calculateBalanceDeltas(
      {
        accountId,
        toAccountId: txType === 'transfer' ? toAccountId : null,
        type: txType as any,
        amountMinor,
      },
      accountMap
    );

    const txId = `tx_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const txDate = isValidIsoDate(date) ? date.trim() : now.slice(0, 10);
    const cleanTags = Array.isArray(tags)
      ? tags
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 20)
          .map(t => t.trim().slice(0, 40))
      : null;
    const tagsJson = cleanTags && cleanTags.length > 0 ? JSON.stringify(cleanTags) : null;

    transaction(() => {
      // 1. Insert transaction (store NULL parent category_id when split to avoid ambiguity)
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type,
                                   amount_minor, currency, merchant, date, notes, tags, receipt_url,
                                   recurring_rule_id, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          userId,
          accountId,
          txType === 'transfer' ? toAccountId : null,
          isSplit ? null : categoryId || null,
          txType,
          amountMinor,
          currency,
          merchant.trim().slice(0, 160),
          txDate,
          typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null,
          tagsJson,
          parsedReceipt ? `receipt_${txId}` : null,
          recurringRuleId || null,
          isSplit ? 1 : 0,
          now,
          now,
        ]
      );

      // 2. Insert splits if any
      if (isSplit) {
        for (const s of splits) {
          const splitId = `sp_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
          const sMinor = toMinorUnits(s.amount, currency);
          run(
            `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [splitId, txId, s.categoryId || null, sMinor, typeof s.notes === 'string' ? s.notes.trim().slice(0, 200) : null, now]
          );
        }
      }

      // 3. Attach validated receipt if provided
      if (parsedReceipt) {
        const receiptId = `rc_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
        run(
          `INSERT INTO receipts (id, user_id, transaction_id, file_name, mime_type, data_base64, file_size, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            receiptId,
            userId,
            txId,
            parsedReceipt.fileName,
            parsedReceipt.mimeType,
            parsedReceipt.dataUrl,
            parsedReceipt.fileSize,
            now,
          ]
        );
      }

      // 4. Update owned account balances atomically
      for (const [accId, delta] of deltas.entries()) {
        run(
          'UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ? AND user_id = ?',
          [delta, now, accId, userId]
        );
      }
    });

    const created = queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    const responseBody = { message: 'Transaction recorded successfully.', transaction: created };
    setIdempotentResponse(userId, 'POST:/api/transactions', idempotencyKey, 201, responseBody);
    res.status(201).json(responseBody);
  } catch (err: any) {
    console.error('Error creating transaction:', err?.message || err);
    res.status(500).json({ error: 'Could not record transaction. Existing data is safe.' });
  }
});

// PUT /api/transactions/:id
transactionsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const txId = req.params.id;

    const oldTx = queryOne<any>('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    if (!oldTx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const {
      accountId,
      toAccountId,
      categoryId,
      type,
      amount,
      merchant,
      date,
      notes,
      tags,
      splits,
    } = req.body || {};

    const currency = req.user!.currency || 'INR';
    const newAmountMinor = amount !== undefined ? toMinorUnits(amount, currency) : oldTx.amount_minor;
    if (newAmountMinor <= 0) {
      res.status(400).json({ error: 'Transaction amount must be greater than zero.' });
      return;
    }

    const newType = (type || oldTx.type) as string;
    if (!ALLOWED_TX_TYPES.has(newType)) {
      res.status(400).json({ error: 'Invalid transaction type.' });
      return;
    }

    const newAccountId = accountId || oldTx.account_id;
    const newToAccountId =
      newType === 'transfer' ? (toAccountId !== undefined ? toAccountId : oldTx.to_account_id) : null;

    if (newType === 'transfer' && (!newToAccountId || newToAccountId === newAccountId)) {
      res.status(400).json({ error: 'Transfers require a distinct destination account.' });
      return;
    }

    const accountMap = getAccountMap(userId);
    if (!accountMap.has(newAccountId)) {
      res.status(403).json({ error: 'Selected source account was not found in your workspace.' });
      return;
    }
    if (newToAccountId && !accountMap.has(newToAccountId)) {
      res.status(403).json({ error: 'Selected destination account was not found in your workspace.' });
      return;
    }

    const ownedCategoryIds = getOwnedCategoryIds(userId);
    if (categoryId && !ownedCategoryIds.has(categoryId)) {
      res.status(403).json({ error: 'Selected category was not found in your workspace.' });
      return;
    }

    const isSplit = Array.isArray(splits) && splits.length > 1;
    if (isSplit) {
      for (const s of splits) {
        if (s.categoryId && !ownedCategoryIds.has(s.categoryId)) {
          res.status(403).json({ error: 'One or more split categories do not belong to your workspace.' });
          return;
        }
      }
      const splitItems = splits.map((s: any) => ({
        amountMinor: toMinorUnits(s.amount, currency),
        categoryId: s.categoryId,
        notes: s.notes,
      }));
      const validation = validateTransactionSplits(newAmountMinor, splitItems);
      if (!validation.valid) {
        res.status(400).json({
          error: `Split amounts do not match transaction total. Difference: ${validation.differenceMinor / 100}.`,
        });
        return;
      }
    }

    const oldDeltas = calculateBalanceDeltas(
      {
        accountId: oldTx.account_id,
        toAccountId: oldTx.to_account_id,
        type: oldTx.type,
        amountMinor: oldTx.amount_minor,
      },
      accountMap
    );

    const newDeltas = calculateBalanceDeltas(
      {
        accountId: newAccountId,
        toAccountId: newToAccountId,
        type: newType as any,
        amountMinor: newAmountMinor,
      },
      accountMap
    );

    const now = new Date().toISOString();
    const tagsJson =
      tags !== undefined
        ? Array.isArray(tags)
          ? JSON.stringify(
              tags
                .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                .slice(0, 20)
                .map(t => t.trim().slice(0, 40))
            )
          : null
        : oldTx.tags;

    const finalDate = date && isValidIsoDate(date) ? date.trim() : oldTx.date;

    transaction(() => {
      // 1. Revert old owned balances
      for (const [accId, delta] of oldDeltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor - ?, updated_at = ? WHERE id = ? AND user_id = ?', [
          delta,
          now,
          accId,
          userId,
        ]);
      }

      // 2. Apply new owned balances
      for (const [accId, delta] of newDeltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ? AND user_id = ?', [
          delta,
          now,
          accId,
          userId,
        ]);
      }

      // 3. Update transaction record
      run(
        `UPDATE transactions
         SET account_id = ?, to_account_id = ?, category_id = ?, type = ?,
             amount_minor = ?, merchant = ?, date = ?, notes = ?, tags = ?,
             is_split = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [
          newAccountId,
          newToAccountId || null,
          isSplit ? null : categoryId !== undefined ? categoryId || null : oldTx.category_id,
          newType,
          newAmountMinor,
          typeof merchant === 'string' && merchant.trim() ? merchant.trim().slice(0, 160) : oldTx.merchant,
          finalDate,
          notes !== undefined ? (typeof notes === 'string' && notes.trim() ? notes.trim().slice(0, 500) : null) : oldTx.notes,
          tagsJson,
          splits !== undefined ? (isSplit ? 1 : 0) : oldTx.is_split,
          now,
          txId,
          userId,
        ]
      );

      // 4. Update splits if provided
      if (splits !== undefined) {
        run('DELETE FROM transaction_splits WHERE transaction_id = ?', [txId]);
        if (isSplit) {
          for (const s of splits) {
            const splitId = `sp_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
            const sMinor = toMinorUnits(s.amount, currency);
            run(
              `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [splitId, txId, s.categoryId || null, sMinor, typeof s.notes === 'string' ? s.notes.trim().slice(0, 200) : null, now]
            );
          }
        }
      }
    });

    const updated = queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    res.json({ message: 'Transaction updated successfully.', transaction: updated });
  } catch (err: any) {
    console.error('Error updating transaction:', err?.message || err);
    res.status(500).json({ error: 'Could not update transaction.' });
  }
});

// DELETE /api/transactions/:id
transactionsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const txId = req.params.id;

    const oldTx = queryOne<any>('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    if (!oldTx) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    let deltas = new Map<string, number>();
    try {
      const accountMap = getAccountMap(userId);
      deltas = calculateBalanceDeltas(
        {
          accountId: oldTx.account_id,
          toAccountId: oldTx.to_account_id,
          type: oldTx.type,
          amountMinor: oldTx.amount_minor,
        },
        accountMap
      );
    } catch (calcErr) {
      console.warn('Could not calculate balance deltas for deleting tx:', calcErr);
    }

    const now = new Date().toISOString();

    transaction(() => {
      // 1. Revert owned balance deltas
      for (const [accId, delta] of deltas.entries()) {
        if (accId) {
          run(
            'UPDATE accounts SET current_balance_minor = current_balance_minor - ?, updated_at = ? WHERE id = ? AND user_id = ?',
            [delta, now, accId, userId]
          );
        }
      }

      // 2. Delete splits and receipts owned by this user
      run('DELETE FROM transaction_splits WHERE transaction_id = ?', [txId]);
      run('DELETE FROM receipts WHERE transaction_id = ? AND user_id = ?', [txId, userId]);

      // 3. Delete transaction
      run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    });

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting transaction:', err?.message || err);
    res.status(500).json({ error: 'Could not delete transaction.' });
  }
});

// POST /api/transactions/:id/duplicate
transactionsRouter.post('/:id/duplicate', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const txId = req.params.id;

    const source = queryOne<any>('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    if (!source) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    const newId = `tx_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const accountMap = getAccountMap(userId);
    const deltas = calculateBalanceDeltas(
      {
        accountId: source.account_id,
        toAccountId: source.to_account_id,
        type: source.type,
        amountMinor: source.amount_minor,
      },
      accountMap
    );

    const sourceSplits =
      source.is_split === 1
        ? query<any>('SELECT category_id, amount_minor, notes FROM transaction_splits WHERE transaction_id = ?', [txId])
        : [];

    transaction(() => {
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type,
                                   amount_minor, currency, merchant, date, notes, tags, receipt_url,
                                   recurring_rule_id, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
        [
          newId,
          userId,
          source.account_id,
          source.to_account_id,
          source.category_id,
          source.type,
          source.amount_minor,
          source.currency,
          source.merchant,
          today,
          source.notes ? `(Copy) ${source.notes}` : null,
          source.tags,
          sourceSplits.length > 1 ? 1 : 0,
          now,
          now,
        ]
      );

      for (const s of sourceSplits) {
        const splitId = `sp_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
        run(
          `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [splitId, newId, s.category_id || null, s.amount_minor, s.notes || null, now]
        );
      }

      for (const [accId, delta] of deltas.entries()) {
        run(
          'UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ? AND user_id = ?',
          [delta, now, accId, userId]
        );
      }
    });

    const created = queryOne('SELECT * FROM transactions WHERE id = ? AND user_id = ?', [newId, userId]);
    res.status(201).json({ message: 'Transaction duplicated successfully.', transaction: created });
  } catch (err) {
    console.error('Error duplicating transaction:', err);
    res.status(500).json({ error: 'Could not duplicate transaction.' });
  }
});

// GET /api/transactions/:id/receipt
transactionsRouter.get('/:id/receipt', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const txId = req.params.id;

    const receipt = queryOne<any>(
      'SELECT id, file_name, mime_type, data_base64, file_size, created_at FROM receipts WHERE transaction_id = ? AND user_id = ?',
      [txId, userId]
    );

    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found.' });
      return;
    }

    res.json({ receipt });
  } catch {
    res.status(500).json({ error: 'Could not retrieve receipt.' });
  }
});
