/**
 * PRYORA Accounts API Routes
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';

export const accountsRouter = Router();

// GET /api/accounts
accountsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const accounts = query<any>(
      `SELECT id, name, type, currency, initial_balance_minor, current_balance_minor,
              institution, color, icon, credit_limit_minor, statement_day, due_day, 
              minimum_payment_minor, is_archived, created_at, updated_at
       FROM accounts
       WHERE user_id = ?
       ORDER BY is_archived ASC, created_at ASC`,
      [userId]
    );

    // Enhance credit cards with calculated metrics
    const enhanced = accounts.map(acc => {
      if (acc.type === 'credit_card') {
        const creditLimit = acc.credit_limit_minor || 0;
        const balance = acc.current_balance_minor || 0;
        const availableCredit = Math.max(0, creditLimit - balance);
        const utilizationPct = creditLimit > 0 ? Math.round((balance / creditLimit) * 100) : 0;

        return {
          ...acc,
          available_credit_minor: availableCredit,
          utilization_percentage: utilizationPct,
        };
      }
      return acc;
    });

    res.json({ accounts: enhanced });
  } catch (err) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: 'Could not retrieve accounts.' });
  }
});

// POST /api/accounts
accountsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, type, initialBalance, institution, color, icon, creditLimit, statementDay, dueDay, minimumPayment } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Account name is required.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const initialMinor = toMinorUnits(initialBalance || 0, currency);
    const limitMinor = creditLimit ? toMinorUnits(creditLimit, currency) : 0;
    const minPayMinor = minimumPayment ? toMinorUnits(minimumPayment, currency) : 0;
    const accId = `acc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor,
                             institution, color, icon, credit_limit_minor, statement_day, due_day, minimum_payment_minor,
                             is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        accId,
        userId,
        name.trim(),
        type || 'checking',
        currency,
        initialMinor,
        initialMinor,
        institution?.trim() || '',
        color || '#3B82F6',
        icon || 'Wallet',
        limitMinor,
        statementDay || null,
        dueDay || null,
        minPayMinor,
        now,
        now,
      ]
    );

    const created = queryOne('SELECT * FROM accounts WHERE id = ?', [accId]);
    res.status(201).json({ message: 'Account created successfully.', account: created });
  } catch (err) {
    console.error('Error creating account:', err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

// PUT /api/accounts/:id
accountsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const accId = req.params.id;
    const { name, institution, color, icon, creditLimit, statementDay, dueDay, minimumPayment, isArchived } = req.body;

    const existing = queryOne('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const limitMinor = creditLimit !== undefined ? toMinorUnits(creditLimit, currency) : existing.credit_limit_minor;
    const minPayMinor = minimumPayment !== undefined ? toMinorUnits(minimumPayment, currency) : existing.minimum_payment_minor;
    const now = new Date().toISOString();

    run(
      `UPDATE accounts 
       SET name = COALESCE(?, name),
           institution = COALESCE(?, institution),
           color = COALESCE(?, color),
           icon = COALESCE(?, icon),
           credit_limit_minor = ?,
           statement_day = ?,
           due_day = ?,
           minimum_payment_minor = ?,
           is_archived = COALESCE(?, is_archived),
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        name?.trim(),
        institution?.trim(),
        color,
        icon,
        limitMinor,
        statementDay ?? existing.statement_day,
        dueDay ?? existing.due_day,
        minPayMinor,
        isArchived !== undefined ? (isArchived ? 1 : 0) : existing.is_archived,
        now,
        accId,
        userId,
      ]
    );

    const updated = queryOne('SELECT * FROM accounts WHERE id = ?', [accId]);
    res.json({ message: 'Account updated successfully.', account: updated });
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ error: 'Could not update account.' });
  }
});

// DELETE /api/accounts/:id
accountsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const accId = req.params.id;

    const existing = queryOne('SELECT * FROM accounts WHERE id = ? AND user_id = ?', [accId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    // Check if transactions reference this account
    const txCount = queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id = ? OR to_account_id = ?',
      [accId, accId]
    );

    if (txCount && txCount.count > 0) {
      // Archive rather than delete to preserve historical integrity
      run('UPDATE accounts SET is_archived = 1, updated_at = ? WHERE id = ?', [new Date().toISOString(), accId]);
      res.json({ message: `Account has ${txCount.count} existing transactions. It was archived to preserve your financial history.` });
      return;
    }

    run('DELETE FROM accounts WHERE id = ? AND user_id = ?', [accId, userId]);
    res.json({ message: 'Account removed successfully.' });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Could not delete account.' });
  }
});

// POST /api/accounts/:id/pay-credit-card
// Specific domain helper to pay credit card without double counting expenses!
accountsRouter.post('/:id/pay-credit-card', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const creditCardId = req.params.id;
    const { fromAccountId, amount, date, notes } = req.body;

    const creditCard = queryOne<{ id: string; type: string; current_balance_minor: number; name: string }>(
      'SELECT id, type, current_balance_minor, name FROM accounts WHERE id = ? AND user_id = ?',
      [creditCardId, userId]
    );

    if (!creditCard || creditCard.type !== 'credit_card') {
      res.status(400).json({ error: 'Target account is not a valid credit card.' });
      return;
    }

    const fromAccount = queryOne<{ id: string; current_balance_minor: number; name: string }>(
      'SELECT id, current_balance_minor, name FROM accounts WHERE id = ? AND user_id = ?',
      [fromAccountId, userId]
    );

    if (!fromAccount) {
      res.status(400).json({ error: 'Source bank account not found.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Payment amount must be greater than zero.' });
      return;
    }

    const txId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const txDate = date || now.slice(0, 10);

    transaction(() => {
      // 1. Record transfer transaction (TRANSFER is explicitly NOT an expense or income)
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, type, amount_minor, currency, 
                                   merchant, date, notes, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'transfer', ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          txId,
          userId,
          fromAccountId,
          creditCardId,
          amountMinor,
          currency,
          `Credit Card Payment: ${creditCard.name}`,
          txDate,
          notes || `Payment from ${fromAccount.name} to ${creditCard.name}`,
          now,
          now,
        ]
      );

      // 2. Reduce bank account balance
      run(
        'UPDATE accounts SET current_balance_minor = current_balance_minor - ?, updated_at = ? WHERE id = ?',
        [amountMinor, now, fromAccountId]
      );

      // 3. Reduce credit card liability balance
      run(
        'UPDATE accounts SET current_balance_minor = current_balance_minor - ?, updated_at = ? WHERE id = ?',
        [amountMinor, now, creditCardId]
      );
    });

    res.json({
      message: 'Credit card payment recorded successfully. Balances updated without double counting expenses.',
    });
  } catch (err: any) {
    console.error('Error paying credit card:', err);
    res.status(500).json({ error: 'Could not process credit card payment. Your accounts remain safe.' });
  }
});
