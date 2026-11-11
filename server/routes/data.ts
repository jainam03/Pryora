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
import { heuristicMatch } from '../services/geminiService.js';

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

// Alias GET /api/data/backup/json -> same handler as /export/json
dataRouter.get('/backup/json', requireAuth, (req: AuthenticatedRequest, res) => {
  res.redirect('/api/data/export/json');
});

// POST /api/data/import/csv/preview - Step 1: Parse, Detect, Auto-Categorize & Validate (supports CSV text or Excel sheet rows)
dataRouter.post('/import/csv/preview', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      csvText,
      headers: inputHeaders,
      rows: inputRows,
      mapping: customMapping,
      defaultAccountId,
      fallbackDate,
      useFallbackDateForInvalid = true,
    } = req.body;

    let parsedHeaders: string[] = [];
    let parsedRows: string[][] = [];
    let delimiter = ',';

    if (Array.isArray(inputHeaders) && Array.isArray(inputRows)) {
      parsedHeaders = inputHeaders.map((h: any) => String(h ?? '').trim());
      parsedRows = inputRows
        .map((r: any) => (Array.isArray(r) ? r.map((cell: any) => String(cell ?? '').trim()) : []))
        .filter((r: string[]) => r.some(cell => cell.length > 0));
    } else if (csvText && typeof csvText === 'string' && csvText.trim()) {
      const parsed = parseCsvString(csvText);
      parsedHeaders = parsed.headers;
      parsedRows = parsed.rows;
      delimiter = parsed.delimiter;
    } else {
      res.status(400).json({ error: 'Please provide valid Excel or CSV file content.' });
      return;
    }

    if (parsedHeaders.length === 0 || parsedRows.length === 0) {
      res.status(400).json({ error: 'The selected sheet or file contains no readable columns or transaction rows.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const parseAmountCell = (val?: string): number => {
      if (!val) return 0;
      const trimmed = String(val).trim();
      if (!trimmed || trimmed === '-' || trimmed === '--' || /^n\/?a$/i.test(trimmed)) return 0;
      // Must contain at least one digit to be a numeric amount
      if (!/\d/.test(trimmed)) return 0;
      // Reject strings that look like dates (e.g. 2026-11-01 or 12/11/2026)
      if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(trimmed)) return 0;
      const isParenNegative = /^\(.*\)$/.test(trimmed);
      const cleaned = trimmed
        .replace(/[()]/g, '')
        .replace(/\/-$/g, '')
        .replace(/\b(rs\.?|inr|usd|eur|gbp|dr\.?|cr\.?|debit|credit)\b/gi, '')
        .trim();
      const minor = toMinorUnits(cleaned, currency);
      return isParenNegative ? -Math.abs(minor) : minor;
    };

    // Start from header-based guess if customMapping is not provided, then refine using actual data rows!
    const mapping = customMapping ? { ...customMapping } : guessColumnMapping(parsedHeaders);

    if (!customMapping && parsedRows.length > 0) {
      const sampleRows = parsedRows.slice(0, 25);

      // Verify if dateCol actually contains dates; if not, scan all columns for a column with valid dates
      const currentDateIdx = mapping.dateCol ? parsedHeaders.indexOf(mapping.dateCol) : -1;
      const currentDateHits =
        currentDateIdx >= 0
          ? sampleRows.filter(r => normalizeDate(r[currentDateIdx], 'auto') !== null).length
          : 0;

      if (currentDateHits === 0) {
        let bestDateCol = '';
        let bestDateHits = 0;
        for (let c = 0; c < parsedHeaders.length; c++) {
          const hits = sampleRows.filter(r => normalizeDate(r[c], 'auto') !== null).length;
          if (hits > bestDateHits) {
            bestDateHits = hits;
            bestDateCol = parsedHeaders[c];
          }
        }
        if (bestDateHits > 0) {
          mapping.dateCol = bestDateCol;
        }
      }

      // Verify if amountCol / debitCol / creditCol actually contains numbers; if not, scan columns for numeric values
      const currentAmtIdx = mapping.amountCol ? parsedHeaders.indexOf(mapping.amountCol) : -1;
      const currentDebitIdx = mapping.debitCol ? parsedHeaders.indexOf(mapping.debitCol) : -1;
      const currentCreditIdx = mapping.creditCol ? parsedHeaders.indexOf(mapping.creditCol) : -1;

      const hasValidAmtCol =
        (currentAmtIdx >= 0 && sampleRows.some(r => Math.abs(parseAmountCell(r[currentAmtIdx])) > 0)) ||
        (currentDebitIdx >= 0 && sampleRows.some(r => Math.abs(parseAmountCell(r[currentDebitIdx])) > 0)) ||
        (currentCreditIdx >= 0 && sampleRows.some(r => Math.abs(parseAmountCell(r[currentCreditIdx])) > 0));

      if (!hasValidAmtCol) {
        let bestAmtCol = '';
        let bestAmtHits = 0;
        for (let c = 0; c < parsedHeaders.length; c++) {
          if (parsedHeaders[c] === mapping.dateCol) continue;
          const hits = sampleRows.filter(r => Math.abs(parseAmountCell(r[c])) > 0).length;
          if (hits > bestAmtHits) {
            bestAmtHits = hits;
            bestAmtCol = parsedHeaders[c];
          }
        }
        if (bestAmtHits > 0) {
          mapping.amountCol = bestAmtCol;
        }
      }

      // Ensure merchantCol is distinct from dateCol and amountCol and contains text
      if (!mapping.merchantCol || mapping.merchantCol === mapping.dateCol || mapping.merchantCol === mapping.amountCol) {
        let bestTextCol = '';
        let bestTextHits = 0;
        for (let c = 0; c < parsedHeaders.length; c++) {
          const h = parsedHeaders[c];
          if (h === mapping.dateCol || h === mapping.amountCol || h === mapping.debitCol || h === mapping.creditCol) {
            continue;
          }
          const hits = sampleRows.filter(r => {
            const val = (r[c] || '').trim();
            return val.length > 1 && isNaN(Number(val));
          }).length;
          if (hits > bestTextHits) {
            bestTextHits = hits;
            bestTextCol = h;
          }
        }
        if (bestTextCol) {
          mapping.merchantCol = bestTextCol;
        }
      }
    }

    // Fetch existing accounts and categories for mapping
    const accounts = query<any>('SELECT id, name, type FROM accounts WHERE user_id = ? AND is_archived = 0', [userId]);
    const categories = query<any>('SELECT id, name, type FROM categories WHERE user_id = ? AND is_archived = 0', [userId]);

    const colIndex = (colName?: string) => (colName ? parsedHeaders.indexOf(colName) : -1);

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
    const existingSet = new Set(
      existingTxs.map(t => `${t.date}|${t.merchant.toLowerCase().trim()}|${t.amount_minor}`)
    );

    const defaultFallbackDate =
      normalizeDate(fallbackDate, 'auto') || new Date().toISOString().slice(0, 10);

    const previewRows: any[] = [];
    let validCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let autoCategorizedCount = 0;

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      const errors: string[] = [];

      // 1. Date (with forgiving fallback when date column is not present or cell is non-date text)
      const rawDate = dateIdx >= 0 ? row[dateIdx]?.trim() : '';
      let normalizedDate = normalizeDate(rawDate, mapping.dateFormat || 'auto');

      // If dateIdx wasn't mapped or didn't parse, check if any other cell in the row is an obvious ISO/slash date
      if (!normalizedDate) {
        for (let c = 0; c < row.length; c++) {
          if (c === amountIdx || c === debitIdx || c === creditIdx || c === merchantIdx) continue;
          const candidateDate = normalizeDate(row[c], mapping.dateFormat || 'auto');
          if (candidateDate) {
            normalizedDate = candidateDate;
            break;
          }
        }
      }

      let usedFallbackDate = false;
      if (!normalizedDate && useFallbackDateForInvalid) {
        normalizedDate = defaultFallbackDate;
        usedFallbackDate = true;
      }

      if (!normalizedDate) {
        errors.push(rawDate ? `Invalid date: "${rawDate}"` : 'Missing date');
      }

      // 2. Merchant / Description
      let rawMerchant = merchantIdx >= 0 ? row[merchantIdx]?.trim() : '';
      // If merchant is empty, pick the first non-empty text cell in the row
      if (!rawMerchant) {
        for (let c = 0; c < row.length; c++) {
          if (c === dateIdx || c === amountIdx || c === debitIdx || c === creditIdx) continue;
          const cellVal = row[c]?.trim();
          if (cellVal && isNaN(Number(cellVal))) {
            rawMerchant = cellVal;
            break;
          }
        }
      }
      // If rawDate was actually a text label (when fallback date was used) and rawMerchant was empty, use rawDate as merchant
      if (!rawMerchant && usedFallbackDate && rawDate && isNaN(Number(rawDate))) {
        rawMerchant = rawDate;
      }
      const merchant = rawMerchant || `Expense Row #${i + 1}`;

      // 3. Amount and Type
      let amountMinor = 0;
      let txType: 'expense' | 'income' = 'expense';

      if (debitIdx >= 0 && creditIdx >= 0) {
        const rawDebit = row[debitIdx]?.trim();
        const rawCredit = row[creditIdx]?.trim();
        const debitMinor = Math.abs(parseAmountCell(rawDebit));
        const creditMinor = Math.abs(parseAmountCell(rawCredit));

        if (creditMinor > 0 && debitMinor === 0) {
          amountMinor = creditMinor;
          txType = 'income';
        } else if (debitMinor > 0) {
          amountMinor = debitMinor;
          txType = 'expense';
        }
      } else if (debitIdx >= 0 && amountIdx < 0) {
        amountMinor = Math.abs(parseAmountCell(row[debitIdx]));
        txType = 'expense';
      } else if (creditIdx >= 0 && amountIdx < 0) {
        amountMinor = Math.abs(parseAmountCell(row[creditIdx]));
        txType = 'income';
      } else if (amountIdx >= 0) {
        const rawAmount = row[amountIdx]?.trim() || '';
        const parsedMinor = parseAmountCell(rawAmount);
        if (parsedMinor < 0) {
          amountMinor = Math.abs(parsedMinor);
          txType = 'expense';
        } else {
          amountMinor = parsedMinor;
          if (typeIdx >= 0 && row[typeIdx]) {
            const tVal = row[typeIdx].toLowerCase().trim();
            if (
              tVal === 'cr' ||
              tVal === 'c' ||
              tVal.includes('credit') ||
              tVal.includes('income') ||
              tVal.includes('deposit') ||
              tVal.includes('inflow')
            ) {
              txType = 'income';
            } else {
              txType = 'expense';
            }
          } else if (/\bcr\b/i.test(rawAmount)) {
            txType = 'income';
          }
        }
      }

      // Fallback: if mapped amount column yielded 0, scan other columns in this row for a numeric amount
      if (amountMinor === 0) {
        for (let c = 0; c < row.length; c++) {
          if (c === dateIdx || c === merchantIdx) continue;
          const candidateMinor = parseAmountCell(row[c]);
          if (Math.abs(candidateMinor) > 0) {
            amountMinor = Math.abs(candidateMinor);
            if (candidateMinor < 0) txType = 'expense';
            break;
          }
        }
      }

      if (amountMinor <= 0) {
        errors.push('Enter an amount > 0 (or skip non-transaction row)');
      }

      // Check Duplicate
      const dupKey = `${normalizedDate}|${merchant.toLowerCase()}|${amountMinor}`;
      const isDuplicate = Boolean(normalizedDate && amountMinor > 0 && existingSet.has(dupKey));
      if (isDuplicate) duplicateCount++;

      // Category match or keyword heuristic fallback
      const rawCat = categoryIdx >= 0 ? row[categoryIdx]?.trim() : '';
      const matchedCat = rawCat
        ? categories.find(
            c =>
              c.name.toLowerCase() === rawCat.toLowerCase() ||
              c.name.toLowerCase().includes(rawCat.toLowerCase()) ||
              rawCat.toLowerCase().includes(c.name.toLowerCase())
          )
        : null;

      let categorySource: 'column' | 'auto' | 'new' | 'none' = 'none';
      let resolvedCategoryId: string | null = null;
      let resolvedCategoryName = '';

      if (matchedCat) {
        resolvedCategoryId = matchedCat.id;
        resolvedCategoryName = matchedCat.name;
        categorySource = 'column';
      } else if (rawCat) {
        resolvedCategoryId = null;
        resolvedCategoryName = rawCat;
        categorySource = 'new';
      } else if (merchant) {
        const candidatePool = categories.filter(c => c.type === txType);
        const heuristic = heuristicMatch(
          merchant,
          candidatePool.length > 0 ? candidatePool : categories
        );
        if (heuristic.categoryId) {
          resolvedCategoryId = heuristic.categoryId;
          resolvedCategoryName = heuristic.categoryName;
          categorySource = 'auto';
          autoCategorizedCount++;
        }
      }

      // Account match
      const rawAcc = accountIdx >= 0 ? row[accountIdx]?.trim() : '';
      const matchedAcc = rawAcc
        ? accounts.find(
            a =>
              a.name.toLowerCase() === rawAcc.toLowerCase() ||
              a.name.toLowerCase().includes(rawAcc.toLowerCase())
          )
        : null;

      const resolvedAccountId = matchedAcc
        ? matchedAcc.id
        : defaultAccountId || (accounts[0] ? accounts[0].id : null);
      const resolvedAccountName = matchedAcc
        ? matchedAcc.name
        : accounts.find(a => a.id === resolvedAccountId)?.name || rawAcc || 'Default Account';

      const isValid = errors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      previewRows.push({
        rowIndex: i + 1,
        date: normalizedDate || defaultFallbackDate,
        usedFallbackDate,
        merchant,
        type: txType,
        amountMinor,
        amountDisplay: toMajorUnits(amountMinor, currency),
        categoryId: resolvedCategoryId,
        categoryName: resolvedCategoryName,
        categorySource,
        accountId: resolvedAccountId,
        accountName: resolvedAccountName,
        notes: notesIdx >= 0 ? row[notesIdx]?.trim() : '',
        isValid,
        errors,
        isDuplicate,
      });
    }

    res.json({
      headers: parsedHeaders,
      detectedMapping: mapping,
      delimiter,
      totalRows: parsedRows.length,
      validCount,
      duplicateCount,
      errorCount,
      autoCategorizedCount,
      preview: previewRows.slice(0, 500),
      accounts,
      categories,
    });
  } catch (err: any) {
    console.error('Spreadsheet preview error:', err);
    res.status(500).json({ error: 'Could not parse file. Please verify the spreadsheet or CSV structure.' });
  }
});

// POST /api/data/import/csv/commit - Step 2: Safe Commit in an ACID Transaction
dataRouter.post('/import/csv/commit', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      rows,
      defaultAccountId,
      skipDuplicates = true,
      createMissingCategories = true,
      sourceFileName,
    } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'No transaction rows provided for commit.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const accounts = query<{ id: string; name: string; type: AccountType }>(
      'SELECT id, name, type FROM accounts WHERE user_id = ?',
      [userId]
    );
    const accountMap = new Map(accounts.map(a => [a.id, { type: a.type }]));

    const fallbackAccountId = defaultAccountId || (accounts[0] ? accounts[0].id : null);
    if (!fallbackAccountId) {
      res.status(400).json({ error: 'You must have at least one account created before importing transactions.' });
      return;
    }

    const existingCategories = query<{ id: string; name: string; type: string }>(
      'SELECT id, name, type FROM categories WHERE user_id = ?',
      [userId]
    );
    const categoryByName = new Map(
      existingCategories.map(c => [c.name.toLowerCase().trim(), c.id])
    );

    let importedCount = 0;
    let skippedDuplicateCount = 0;
    let skippedInvalidCount = 0;
    let createdCategoriesCount = 0;
    const now = new Date().toISOString();
    const importSourceTag = sourceFileName ? `[Import: ${sourceFileName}]` : '[Spreadsheet Import]';

    transaction(() => {
      for (const row of rows) {
        if (!row.isValid || !row.amountMinor || row.amountMinor <= 0) {
          skippedInvalidCount++;
          continue;
        }
        if (skipDuplicates && row.isDuplicate) {
          skippedDuplicateCount++;
          continue;
        }

        const targetAccountId =
          row.accountId && accountMap.has(row.accountId) ? row.accountId : fallbackAccountId;
        const txId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
        const txType = row.type === 'income' ? 'income' : 'expense';

        // Resolve or auto-create category if requested
        let targetCategoryId: string | null = row.categoryId || null;
        if (!targetCategoryId && row.categoryName && typeof row.categoryName === 'string') {
          const cleanCatName = row.categoryName.trim();
          const existingCatId = categoryByName.get(cleanCatName.toLowerCase());
          if (existingCatId) {
            targetCategoryId = existingCatId;
          } else if (createMissingCategories && cleanCatName.length > 0 && cleanCatName.length <= 60) {
            const newCatId = `cat_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
            run(
              `INSERT INTO categories (id, user_id, name, type, icon, color, is_archived, created_at)
               VALUES (?, ?, ?, ?, 'Tag', ?, 0, ?)`,
              [newCatId, userId, cleanCatName, txType, txType === 'income' ? '#10B981' : '#6366F1', now]
            );
            categoryByName.set(cleanCatName.toLowerCase(), newCatId);
            targetCategoryId = newCatId;
            createdCategoriesCount++;
          }
        }

        const cleanDate = normalizeDate(row.date) || new Date().toISOString().slice(0, 10);

        // Insert transaction
        run(
          `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_minor, currency,
                                     merchant, date, notes, is_split, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            txId,
            userId,
            targetAccountId,
            targetCategoryId,
            txType,
            Math.round(Number(row.amountMinor)),
            currency,
            row.merchant?.trim() || 'Imported Expense',
            cleanDate,
            row.notes ? `${importSourceTag} ${row.notes}` : importSourceTag,
            now,
            now,
          ]
        );

        // Adjust account balance
        const deltas = calculateBalanceDeltas(
          {
            accountId: targetAccountId,
            type: txType,
            amountMinor: Math.round(Number(row.amountMinor)),
          },
          accountMap
        );

        for (const [accId, delta] of deltas.entries()) {
          run(
            'UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ?',
            [delta, now, accId]
          );
        }

        importedCount++;
      }
    });

    res.json({
      message: `Successfully imported ${importedCount} transaction(s). Account balances have been updated.`,
      importedCount,
      skippedDuplicateCount,
      skippedInvalidCount,
      createdCategoriesCount,
    });
  } catch (err: any) {
    console.error('Error committing spreadsheet import:', err);
    res.status(500).json({
      error: 'Could not complete import. Your existing data remains completely safe and untouched.',
    });
  }
});

// Alias POST /api/data/restore/json -> delegates to /restore logic
dataRouter.post('/restore/json', requireAuth, (req: AuthenticatedRequest, res) => {
  req.body = { backupData: req.body?.backupData || req.body };
  // Forward to restore handler below
  const userId = req.user!.id;
  const { backupData } = req.body;
  if (!backupData || !backupData.pryora_version) {
    res.status(400).json({ error: 'Invalid PRYORA backup file format.' });
    return;
  }
  res.redirect(307, '/api/data/restore');
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
