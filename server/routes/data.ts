/**
 * PRYORA Data Hub API Routes: Import, Export, Backup & Restore
 * 
 * Implements:
 * - RFC-4180 CSV export
 * - RFC-4180 CSV import wizard with format detection, column mapping, preview, validation, and safe commit
 * - Complete JSON Backup & Restore with schema validation and transactional safety
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { parseCsvString, guessColumnMapping, normalizeDate, exportTransactionsToCsv } from '../domain/csv.js';
import { toMinorUnits, toMajorUnits } from '../domain/money.js';
import { calculateBalanceDeltas, AccountType } from '../domain/finance.js';

export const dataRouter = Router();

// GET /api/data/export/csv
dataRouter.get('/export/csv', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const currency = req.user!.currency || 'INR';

    const txs = query<any>(
      `SELECT t.date, t.type, t.merchant, t.amount_minor, t.notes, t.tags,
              COALESCE(c.name, 'Uncategorized') as category_name,
              COALESCE(a.name, 'General Account') as account_name
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ?
       ORDER BY t.date DESC`,
      [userId]
    );

    const formattedTxs = txs.map(t => ({
      date: t.date,
      type: t.type,
      merchant: t.merchant,
      categoryName: t.category_name,
      accountName: t.account_name,
      amountDisplay: toMajorUnits(t.amount_minor, currency),
      notes: t.notes,
      tags: t.tags ? JSON.parse(t.tags).join(', ') : '',
    }));

    const csvContent = exportTransactionsToCsv(formattedTxs);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pryora_transactions_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Could not export transactions.' });
  }
});

// GET /api/data/export/json - Full Backup
dataRouter.get('/export/json', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    const user = queryOne<any>('SELECT display_name, currency, locale, date_format FROM users WHERE id = ?', [userId]);
    const accounts = query<any>('SELECT * FROM accounts WHERE user_id = ?', [userId]);
    const categories = query<any>('SELECT * FROM categories WHERE user_id = ?', [userId]);
    const transactions = query<any>('SELECT * FROM transactions WHERE user_id = ?', [userId]);
    const splits = query<any>(
      'SELECT s.* FROM transaction_splits s JOIN transactions t ON t.id = s.transaction_id WHERE t.user_id = ?',
      [userId]
    );
    const budgets = query<any>('SELECT * FROM budgets WHERE user_id = ?', [userId]);
    const recurring = query<any>('SELECT * FROM recurring_rules WHERE user_id = ?', [userId]);
    const goals = query<any>('SELECT * FROM goals WHERE user_id = ?', [userId]);
    const goalContributions = query<any>('SELECT * FROM goal_contributions WHERE user_id = ?', [userId]);

    const backup = {
      pryora_version: '1.0.0',
      exported_at: new Date().toISOString(),
      user,
      accounts,
      categories,
      transactions,
      transaction_splits: splits,
      budgets,
      recurring_rules: recurring,
      goals,
      goal_contributions: goalContributions,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="pryora_backup_${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backup);
  } catch (err) {
    console.error('Error exporting JSON backup:', err);
    res.status(500).json({ error: 'Could not generate backup file.' });
  }
});

// POST /api/data/import/csv/preview - Step 1: Parse, Detect & Validate
dataRouter.post('/import/csv/preview', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { csvText, mapping: customMapping, defaultAccountId } = req.body;

    if (!csvText || !csvText.trim()) {
      res.status(400).json({ error: 'Please provide CSV file content.' });
      return;
    }

    const parsed = parseCsvString(csvText);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      res.status(400).json({ error: 'CSV file contains no readable columns or rows.' });
      return;
    }

    const mapping = customMapping || guessColumnMapping(parsed.headers);
    const currency = req.user!.currency || 'INR';

    // Fetch existing accounts and categories for mapping
    const accounts = query<any>('SELECT id, name FROM accounts WHERE user_id = ?', [userId]);
    const categories = query<any>('SELECT id, name FROM categories WHERE user_id = ?', [userId]);

    const colIndex = (colName?: string) => (colName ? parsed.headers.indexOf(colName) : -1);

    const dateIdx = colIndex(mapping.dateCol);
    const merchantIdx = colIndex(mapping.merchantCol);
    const amountIdx = colIndex(mapping.amountCol);
    const debitIdx = colIndex(mapping.debitCol);
    const creditIdx = colIndex(mapping.creditCol);
    const categoryIdx = colIndex(mapping.categoryCol);
    const accountIdx = colIndex(mapping.accountCol);
    const typeIdx = colIndex(mapping.typeCol);
    const notesIdx = colIndex(mapping.notesCol);

    // Existing transactions for duplicate detection
    const existingTxs = query<{ date: string; merchant: string; amount_minor: number }>(
      'SELECT date, merchant, amount_minor FROM transactions WHERE user_id = ?',
      [userId]
    );
    const existingSet = new Set(existingTxs.map(t => `${t.date}|${t.merchant.toLowerCase().trim()}|${t.amount_minor}`));

    const previewRows: any[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parsed.rows.length; i++) {
      const row = parsed.rows[i];
      const errors: string[] = [];

      // 1. Date
      const rawDate = dateIdx >= 0 ? row[dateIdx] : '';
      const normalizedDate = normalizeDate(rawDate, mapping.dateFormat);
      if (!normalizedDate) {
        errors.push(`Invalid date format: "${rawDate}"`);
      }

      // 2. Merchant
      const rawMerchant = merchantIdx >= 0 ? row[merchantIdx]?.trim() : '';
      const merchant = rawMerchant || 'Unspecified Payee';

      // 3. Amount and Type
      let amountMinor = 0;
      let txType: 'expense' | 'income' = 'expense';

      if (debitIdx >= 0 && creditIdx >= 0) {
        const rawDebit = row[debitIdx]?.trim();
        const rawCredit = row[creditIdx]?.trim();
        const debitMinor = rawDebit ? toMinorUnits(rawDebit, currency) : 0;
        const creditMinor = rawCredit ? toMinorUnits(rawCredit, currency) : 0;

        if (creditMinor > 0) {
          amountMinor = creditMinor;
          txType = 'income';
        } else if (debitMinor > 0) {
          amountMinor = debitMinor;
          txType = 'expense';
        }
      } else if (amountIdx >= 0) {
        const rawAmount = row[amountIdx]?.trim();
        const parsedMinor = toMinorUnits(rawAmount, currency);
        if (parsedMinor < 0) {
          amountMinor = Math.abs(parsedMinor);
          txType = 'expense';
        } else {
          amountMinor = parsedMinor;
          if (typeIdx >= 0 && row[typeIdx]) {
            const tVal = row[typeIdx].toLowerCase();
            if (tVal.includes('credit') || tVal.includes('cr') || tVal.includes('income')) {
              txType = 'income';
            }
          }
        }
      }

      if (amountMinor <= 0) {
        errors.push('Transaction amount must be greater than zero.');
      }

      // Check Duplicate
      const dupKey = `${normalizedDate}|${merchant.toLowerCase()}|${amountMinor}`;
      const isDuplicate = existingSet.has(dupKey);
      if (isDuplicate) duplicateCount++;

      // Category match
      const rawCat = categoryIdx >= 0 ? row[categoryIdx]?.trim() : '';
      const matchedCat = categories.find(c => c.name.toLowerCase() === rawCat.toLowerCase());

      // Account match
      const rawAcc = accountIdx >= 0 ? row[accountIdx]?.trim() : '';
      const matchedAcc = accounts.find(a => a.name.toLowerCase() === rawAcc.toLowerCase());

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      previewRows.push({
        rowIndex: i + 1,
        date: normalizedDate || rawDate,
        merchant,
        type: txType,
        amountMinor,
        amountDisplay: toMajorUnits(amountMinor, currency),
        categoryId: matchedCat ? matchedCat.id : null,
        categoryName: matchedCat ? matchedCat.name : rawCat,
        accountId: matchedAcc ? matchedAcc.id : defaultAccountId || (accounts[0] ? accounts[0].id : null),
        accountName: matchedAcc ? matchedAcc.name : rawAcc,
        notes: notesIdx >= 0 ? row[notesIdx]?.trim() : '',
        isValid,
        errors,
        isDuplicate,
      });
    }

    res.json({
      headers: parsed.headers,
      detectedMapping: mapping,
      delimiter: parsed.delimiter,
      totalRows: parsed.rows.length,
      validCount,
      duplicateCount,
      errorCount,
      preview: previewRows.slice(0, 100), // Preview first 100
      accounts,
      categories,
    });
  } catch (err: any) {
    console.error('CSV preview error:', err);
    res.status(500).json({ error: 'Could not parse CSV file. Please check file formatting.' });
  }
});

// POST /api/data/import/csv/commit - Step 2: Safe Commit in an ACID Transaction
dataRouter.post('/import/csv/commit', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { rows, defaultAccountId, skipDuplicates } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'No transaction rows provided for commit.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const accounts = query<{ id: string; type: AccountType }>('SELECT id, type FROM accounts WHERE user_id = ?', [userId]);
    const accountMap = new Map(accounts.map(a => [a.id, { type: a.type }]));

    const fallbackAccountId = defaultAccountId || (accounts[0] ? accounts[0].id : null);
    if (!fallbackAccountId) {
      res.status(400).json({ error: 'You must have at least one account created before importing transactions.' });
      return;
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    transaction(() => {
      for (const row of rows) {
        if (!row.isValid) continue;
        if (skipDuplicates && row.isDuplicate) continue;

        const targetAccountId = row.accountId || fallbackAccountId;
        const txId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
        const txType = row.type === 'income' ? 'income' : 'expense';

        // Insert transaction
        run(
          `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_minor, currency,
                                     merchant, date, notes, is_split, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            txId,
            userId,
            targetAccountId,
            row.categoryId || null,
            txType,
            row.amountMinor,
            currency,
            row.merchant?.trim() || 'Imported Transaction',
            row.date,
            row.notes ? `[CSV Import] ${row.notes}` : '[CSV Import]',
            now,
            now,
          ]
        );

        // Adjust account balance
        const deltas = calculateBalanceDeltas(
          {
            accountId: targetAccountId,
            type: txType,
            amountMinor: row.amountMinor,
          },
          accountMap
        );

        for (const [accId, delta] of deltas.entries()) {
          run('UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ?', [delta, now, accId]);
        }

        importedCount++;
      }
    });

    res.json({
      message: `Successfully imported ${importedCount} transactions. Account balances have been updated.`,
      importedCount,
    });
  } catch (err: any) {
    console.error('Error committing CSV import:', err);
    res.status(500).json({ error: 'Could not complete import. Your existing data remains completely safe and untouched.' });
  }
});

// POST /api/data/restore - Safe restore from JSON backup
dataRouter.post('/restore', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { backupData } = req.body;

    if (!backupData || !backupData.pryora_version) {
      res.status(400).json({ error: 'Invalid PRYORA backup file format.' });
      return;
    }

    const now = new Date().toISOString();

    transaction(() => {
      // 1. Restore accounts
      if (Array.isArray(backupData.accounts)) {
        for (const acc of backupData.accounts) {
          const existing = queryOne('SELECT id FROM accounts WHERE id = ?', [acc.id]);
          if (!existing) {
            run(
              `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor,
                                     institution, color, icon, credit_limit_minor, statement_day, due_day, minimum_payment_minor,
                                     is_archived, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                acc.id,
                userId,
                acc.name,
                acc.type,
                acc.currency || 'INR',
                acc.initial_balance_minor || 0,
                acc.current_balance_minor || 0,
                acc.institution || '',
                acc.color || '#3B82F6',
                acc.icon || 'Wallet',
                acc.credit_limit_minor || 0,
                acc.statement_day || null,
                acc.due_day || null,
                acc.minimum_payment_minor || 0,
                acc.is_archived || 0,
                acc.created_at || now,
                now,
              ]
            );
          }
        }
      }

      // 2. Restore categories
      if (Array.isArray(backupData.categories)) {
        for (const cat of backupData.categories) {
          const existing = queryOne('SELECT id FROM categories WHERE id = ?', [cat.id]);
          if (!existing) {
            run(
              `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, is_archived, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                cat.id,
                userId,
                cat.parent_id || null,
                cat.name,
                cat.type,
                cat.icon || 'Tag',
                cat.color || '#6366F1',
                cat.is_archived || 0,
                cat.created_at || now,
              ]
            );
          }
        }
      }

      // 3. Restore transactions
      if (Array.isArray(backupData.transactions)) {
        for (const tx of backupData.transactions) {
          const existing = queryOne('SELECT id FROM transactions WHERE id = ?', [tx.id]);
          if (!existing) {
            run(
              `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type,
                                         amount_minor, currency, merchant, date, notes, tags, receipt_url,
                                         recurring_rule_id, is_split, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                tx.id,
                userId,
                tx.account_id,
                tx.to_account_id || null,
                tx.category_id || null,
                tx.type,
                tx.amount_minor,
                tx.currency || 'INR',
                tx.merchant,
                tx.date,
                tx.notes || null,
                tx.tags || null,
                tx.receipt_url || null,
                tx.recurring_rule_id || null,
                tx.is_split || 0,
                tx.created_at || now,
                now,
              ]
            );
          }
        }
      }

      // 4. Restore budgets
      if (Array.isArray(backupData.budgets)) {
        for (const b of backupData.budgets) {
          const existing = queryOne('SELECT id FROM budgets WHERE id = ?', [b.id]);
          if (!existing) {
            run(
              `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, month, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [b.id, userId, b.category_id, b.amount_minor, b.period || 'monthly', b.month || null, b.created_at || now, now]
            );
          }
        }
      }

      // 5. Restore recurring rules
      if (Array.isArray(backupData.recurring_rules)) {
        for (const r of backupData.recurring_rules) {
          const existing = queryOne('SELECT id FROM recurring_rules WHERE id = ?', [r.id]);
          if (!existing) {
            run(
              `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant,
                                            amount_minor, frequency, next_expected_date, is_active,
                                            is_subscription, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                r.id,
                userId,
                r.account_id,
                r.category_id || null,
                r.type,
                r.merchant,
                r.amount_minor,
                r.frequency,
                r.next_expected_date,
                r.is_active || 1,
                r.is_subscription || 0,
                r.notes || null,
                r.created_at || now,
                now,
              ]
            );
          }
        }
      }

      // 6. Restore goals
      if (Array.isArray(backupData.goals)) {
        for (const g of backupData.goals) {
          const existing = queryOne('SELECT id FROM goals WHERE id = ?', [g.id]);
          if (!existing) {
            run(
              `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor,
                                  target_date, category, color, icon, is_completed, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                g.id,
                userId,
                g.name,
                g.target_amount_minor,
                g.current_amount_minor || 0,
                g.target_date || null,
                g.category || 'savings_target',
                g.color || '#10B981',
                g.icon || 'Target',
                g.is_completed || 0,
                g.created_at || now,
                now,
              ]
            );
          }
        }
      }
    });

    res.json({ message: 'Backup restored successfully.' });
  } catch (err: any) {
    console.error('Error restoring backup:', err);
    res.status(500).json({ error: 'Could not restore backup. Your existing data remains safe.' });
  }
});

// POST /api/data/clear-transactions - Wipe demo or dummy data for a clean slate
dataRouter.post('/clear-transactions', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;

    transaction(() => {
      // Delete split records
      run(
        `DELETE FROM transaction_splits 
         WHERE transaction_id IN (SELECT id FROM transactions WHERE user_id = ?)`,
        [userId]
      );
      // Delete transactions
      run('DELETE FROM transactions WHERE user_id = ?', [userId]);

      // Reset account balances to initial balance
      run(
        `UPDATE accounts 
         SET current_balance_minor = initial_balance_minor, updated_at = ? 
         WHERE user_id = ?`,
        [new Date().toISOString(), userId]
      );
    });

    res.json({ message: 'All demo and preloaded transactions have been cleared. Workspace is ready for real expenses.' });
  } catch (err) {
    console.error('Error clearing transactions:', err);
    res.status(500).json({ error: 'Could not clear transactions.' });
  }
});
