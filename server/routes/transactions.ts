/**
 * PRYORA Transactions API Routes
 * 
 * Implements:
 * - Atomic balance adjustments using domain invariants
 * - Split transactions validation and persistence
 * - Smart natural-language filter parser
 * - Duplicate transaction detection
 * - Receipt attachments
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';
import { calculateBalanceDeltas, validateTransactionSplits, AccountType } from '../domain/finance.js';

export const transactionsRouter = Router();

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

    if (type) {
      whereClause += ' AND t.type = ?';
      params.push(type);
    }

    if (accountId) {
      whereClause += ' AND (t.account_id = ? OR t.to_account_id = ?)';
      params.push(accountId, accountId);
    }

    if (categoryId) {
      whereClause += ' AND (t.category_id = ? OR EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.transaction_id = t.id AND ts.category_id = ?))';
      params.push(categoryId, categoryId);
    }

    if (startDate) {
      whereClause += ' AND t.date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND t.date <= ?';
      params.push(endDate);
    }

    if (tag) {
      whereClause += ' AND t.tags LIKE ?';
      params.push(`%"${tag}"%`);
    }

    // Natural Language Search Handling
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      // Check for numeric search, e.g. "above 500" or "below 1000" or direct number
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

    // Count total matching
    const countSql = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN accounts a ON a.id = t.account_id
      ${whereClause}
    `;
    const countResult = queryOne<{ total: number }>(countSql, params);
    const totalCount = countResult ? countResult.total : 0;

    // Fetch transactions
    const sql = `
      SELECT t.id, t.account_id, t.to_account_id, t.category_id, t.type,
             t.amount_minor, t.currency, t.merchant, t.date, t.notes, t.tags,
             t.receipt_url, t.recurring_rule_id, t.is_split, t.created_at,
             a.name as account_name, a.type as account_type, a.color as account_color,
             to_a.name as to_account_name, to_a.type as to_account_type,
             c.name as category_name, c.icon as category_icon, c.color as category_color,
             (SELECT COUNT(*) FROM receipts r WHERE r.transaction_id = t.id) as receipt_count
      FROM transactions t
      LEFT JOIN accounts a ON a.id = t.account_id
      LEFT JOIN accounts to_a ON to_a.id = t.to_account_id
      LEFT JOIN categories c ON c.id = t.category_id
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
    // Find transactions with identical amount_minor and merchant within ±2 days of each other
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
       LEFT JOIN accounts a ON a.id = t1.account_id
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
       LEFT JOIN categories c ON c.id = s.category_id
       WHERE s.transaction_id = ? AND t.user_id = ?`,
      [txId, userId]
    );

    res.json({ splits });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch splits.' });
  }
});

// Helper: load account map for balance recalculation
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
    } = req.body;

    if (!accountId) {
      res.status(400).json({ error: 'Please select an account for this transaction.' });
      return;
    }

    if (!merchant || !merchant.trim()) {
      res.status(400).json({ error: 'Merchant or source description is required.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Transaction amount must be greater than zero.' });
      return;
    }

    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      res.status(400).json({ error: 'Transfers require a distinct destination account.' });
      return;
    }

    // Validate splits if present
    const isSplit = Array.isArray(splits) && splits.length > 1;
    if (isSplit) {
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

    const accountMap = getAccountMap(userId);
    const deltas = calculateBalanceDeltas(
      {
        accountId,
        toAccountId,
        type: type || 'expense',
        amountMinor,
      },
      accountMap
    );

    const txId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const txDate = date || now.slice(0, 10);
    const tagsJson = Array.isArray(tags) ? JSON.stringify(tags) : null;

    transaction(() => {
      // 1. Insert transaction
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type,
                                   amount_minor, currency, merchant, date, notes, tags, receipt_url,
                                   recurring_rule_id, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          userId,
          accountId,
          toAccountId || null,
          categoryId || null,
          type || 'expense',
          amountMinor,
          currency,
          merchant.trim(),
          txDate,
          notes?.trim() || null,
          tagsJson,
          receiptDataUrl ? `receipt_${txId}` : null,
          recurringRuleId || null,
          isSplit ? 1 : 0,
          now,
          now,
        ]
      );

      // 2. Insert splits if any
      if (isSplit) {
        for (const s of splits) {
          const splitId = `sp_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
          const sMinor = toMinorUnits(s.amount, currency);
          run(
            `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [splitId, txId, s.categoryId || null, sMinor, s.notes || null, now]
          );
        }
      }

      // 3. Attach receipt if provided
      if (receiptDataUrl) {
        const receiptId = `rc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
        run(
          `INSERT INTO receipts (id, user_id, transaction_id, file_name, mime_type, data_base64, file_size, created_at)
           VALUES (?, ?, ?, ?, 'image/jpeg', ?, ?, ?)`,
          [
            receiptId,
            userId,
            txId,
            receiptFileName || 'receipt.jpg',
            receiptDataUrl,
            receiptDataUrl.length,
            now,
          ]
        );
      }

      // 4. Update account balances atomically
      for (const [accId, delta] of deltas.entries()) {
        run(
          'UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ?',
          [delta, now, accId]
        );
      }
    });

    const created = queryOne('SELECT * FROM transactions WHERE id = ?', [txId]);
    res.status(201).json({ message: 'Transaction recorded successfully.', transaction: created });
  } catch (err: any) {
    console.error('Error creating transaction:', err);
    res.status(500).json({ error: err.message || 'Could not record transaction. Existing data is safe.' });
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
    } = req.body;

    const currency = req.user!.currency || 'INR';
    const newAmountMinor = amount !== undefined ? toMinorUnits(amount, currency) : oldTx.amount_minor;
    const newType = type || oldTx.type;
    const newAccountId = accountId || oldTx.account_id;
    const newToAccountId = toAccountId !== undefined ? toAccountId : oldTx.to_account_id;
    const isSplit = Array.isArray(splits) && splits.length > 1;

    const accountMap = getAccountMap(userId);

    // Revert old transaction balance impact
    const oldDeltas = calculateBalanceDeltas(
      {
        accountId: oldTx.account_id,
        toAccountId: oldTx.to_account_id,
        type: oldTx.type,
        amountMinor: oldTx.amount_minor,
      },
      accountMap
    );

    // Calculate new transaction balance impact
    const newDeltas = calculateBalanceDeltas(
      {
        accountId: newAccountId,
        toAccountId: newToAccountId,
        type: newType,
        amountMinor: newAmountMinor,
      },
      accountMap
    );

    const now = new Date().toISOString();
    const tagsJson = tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : null) : oldTx.tags;

    transaction(() => {
      // 1. Revert old balances
      for (const [accId, delta] of oldDeltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor - ? WHERE id = ?', [delta, accId]);
      }

      // 2. Apply new balances
      for (const [accId, delta] of newDeltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor + ? WHERE id = ?', [delta, accId]);
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
          categoryId || null,
          newType,
          newAmountMinor,
          merchant?.trim() || oldTx.merchant,
          date || oldTx.date,
          notes !== undefined ? (notes?.trim() || null) : oldTx.notes,
          tagsJson,
          isSplit ? 1 : 0,
          now,
          txId,
          userId,
        ]
      );

      // 4. Update splits if provided
      if (splits) {
        run('DELETE FROM transaction_splits WHERE transaction_id = ?', [txId]);
        if (isSplit) {
          for (const s of splits) {
            const splitId = `sp_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
            const sMinor = toMinorUnits(s.amount, currency);
            run(
              `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [splitId, txId, s.categoryId || null, sMinor, s.notes || null, now]
            );
          }
        }
      }
    });

    const updated = queryOne('SELECT * FROM transactions WHERE id = ?', [txId]);
    res.json({ message: 'Transaction updated successfully.', transaction: updated });
  } catch (err: any) {
    console.error('Error updating transaction:', err);
    res.status(500).json({ error: err.message || 'Could not update transaction.' });
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
      // 1. Revert balance deltas
      for (const [accId, delta] of deltas.entries()) {
        if (accId) {
          run('UPDATE accounts SET current_balance_minor = current_balance_minor - ?, updated_at = ? WHERE id = ?', [delta, now, accId]);
        }
      }

      // 2. Delete splits and receipts
      run('DELETE FROM transaction_splits WHERE transaction_id = ?', [txId]);
      run('DELETE FROM receipts WHERE transaction_id = ?', [txId]);

      // 3. Delete transaction
      run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
    });

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err: any) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ error: err.message || 'Could not delete transaction.' });
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

    const newId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
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

    transaction(() => {
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type,
                                   amount_minor, currency, merchant, date, notes, tags, receipt_url,
                                   recurring_rule_id, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)`,
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
          now,
          now,
        ]
      );

      for (const [accId, delta] of deltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ?', [delta, now, accId]);
      }
    });

    const created = queryOne('SELECT * FROM transactions WHERE id = ?', [newId]);
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
  } catch (err) {
    res.status(500).json({ error: 'Could not retrieve receipt.' });
  }
});
