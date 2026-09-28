/**
 * PRYORA Recurring Expenses & Subscriptions API Routes
 * 
 * Supports:
 * - Weekly, monthly, quarterly, annual recurring frequencies
 * - Monthly & annual equivalent calculations
 * - Instant "Record Now" which records the transaction and advances next expected date
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';
import { calculateBalanceDeltas } from '../domain/finance.js';

export const recurringRouter = Router();

function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);

  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

function calculateEquivalents(amountMinor: number, frequency: string): { monthlyMinor: number; annualMinor: number } {
  switch (frequency) {
    case 'weekly':
      return {
        monthlyMinor: Math.round(amountMinor * (52 / 12)),
        annualMinor: amountMinor * 52,
      };
    case 'monthly':
      return {
        monthlyMinor: amountMinor,
        annualMinor: amountMinor * 12,
      };
    case 'quarterly':
      return {
        monthlyMinor: Math.round(amountMinor / 3),
        annualMinor: amountMinor * 4,
      };
    case 'yearly':
      return {
        monthlyMinor: Math.round(amountMinor / 12),
        annualMinor: amountMinor,
      };
    default:
      return {
        monthlyMinor: amountMinor,
        annualMinor: amountMinor * 12,
      };
  }
}

// GET /api/recurring
recurringRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const rules = query<any>(
      `SELECT r.id, r.account_id, r.category_id, r.type, r.merchant,
              r.amount_minor, r.frequency, r.next_expected_date, r.is_active,
              r.is_subscription, r.notes, r.created_at,
              a.name as account_name, a.type as account_type,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM recurring_rules r
       LEFT JOIN accounts a ON a.id = r.account_id
       LEFT JOIN categories c ON c.id = r.category_id
       WHERE r.user_id = ?
       ORDER BY r.is_subscription DESC, r.next_expected_date ASC`,
      [userId]
    );

    let totalMonthlySubscriptionMinor = 0;
    let totalAnnualSubscriptionMinor = 0;
    let totalMonthlyRecurringExpenseMinor = 0;

    const enhanced = rules.map(rule => {
      const eq = calculateEquivalents(rule.amount_minor, rule.frequency);

      if (rule.is_active) {
        if (rule.is_subscription) {
          totalMonthlySubscriptionMinor += eq.monthlyMinor;
          totalAnnualSubscriptionMinor += eq.annualMinor;
        }
        if (rule.type === 'expense') {
          totalMonthlyRecurringExpenseMinor += eq.monthlyMinor;
        }
      }

      return {
        ...rule,
        monthly_equivalent_minor: eq.monthlyMinor,
        annual_equivalent_minor: eq.annualMinor,
      };
    });

    res.json({
      rules: enhanced,
      subscriptions: enhanced.filter(r => r.is_subscription === 1),
      summary: {
        total_monthly_subscription_minor: totalMonthlySubscriptionMinor,
        total_annual_subscription_minor: totalAnnualSubscriptionMinor,
        total_monthly_recurring_expense_minor: totalMonthlyRecurringExpenseMinor,
        active_subscriptions_count: enhanced.filter(r => r.is_subscription === 1 && r.is_active === 1).length,
      },
    });
  } catch (err) {
    console.error('Error fetching recurring rules:', err);
    res.status(500).json({ error: 'Could not fetch recurring rules.' });
  }
});

// POST /api/recurring
recurringRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      accountId,
      categoryId,
      type,
      merchant,
      amount,
      frequency,
      nextExpectedDate,
      isSubscription,
      notes,
    } = req.body;

    if (!merchant || !merchant.trim()) {
      res.status(400).json({ error: 'Merchant or description is required.' });
      return;
    }

    if (!accountId) {
      res.status(400).json({ error: 'Account assignment is required.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Amount must be greater than zero.' });
      return;
    }

    const ruleId = `rec_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const nextDate = nextExpectedDate || now.slice(0, 10);

    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant,
                                    amount_minor, frequency, next_expected_date, is_active,
                                    is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        ruleId,
        userId,
        accountId,
        categoryId || null,
        type || 'expense',
        merchant.trim(),
        amountMinor,
        frequency || 'monthly',
        nextDate,
        isSubscription ? 1 : 0,
        notes?.trim() || null,
        now,
        now,
      ]
    );

    const created = queryOne('SELECT * FROM recurring_rules WHERE id = ?', [ruleId]);
    res.status(201).json({ message: 'Recurring obligation created successfully.', rule: created });
  } catch (err) {
    console.error('Error creating recurring rule:', err);
    res.status(500).json({ error: 'Could not create recurring rule.' });
  }
});

// PUT /api/recurring/:id
recurringRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ruleId = req.params.id;

    const existing = queryOne('SELECT * FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Recurring rule not found.' });
      return;
    }

    const {
      accountId,
      categoryId,
      type,
      merchant,
      amount,
      frequency,
      nextExpectedDate,
      isActive,
      isSubscription,
      notes,
    } = req.body;

    const currency = req.user!.currency || 'INR';
    const amountMinor = amount !== undefined ? toMinorUnits(amount, currency) : existing.amount_minor;
    const now = new Date().toISOString();

    run(
      `UPDATE recurring_rules 
       SET account_id = COALESCE(?, account_id),
           category_id = COALESCE(?, category_id),
           type = COALESCE(?, type),
           merchant = COALESCE(?, merchant),
           amount_minor = ?,
           frequency = COALESCE(?, frequency),
           next_expected_date = COALESCE(?, next_expected_date),
           is_active = COALESCE(?, is_active),
           is_subscription = COALESCE(?, is_subscription),
           notes = COALESCE(?, notes),
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        accountId,
        categoryId,
        type,
        merchant?.trim(),
        amountMinor,
        frequency,
        nextExpectedDate,
        isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
        isSubscription !== undefined ? (isSubscription ? 1 : 0) : existing.is_subscription,
        notes !== undefined ? notes?.trim() : existing.notes,
        now,
        ruleId,
        userId,
      ]
    );

    const updated = queryOne('SELECT * FROM recurring_rules WHERE id = ?', [ruleId]);
    res.json({ message: 'Recurring rule updated.', rule: updated });
  } catch (err) {
    res.status(500).json({ error: 'Could not update recurring rule.' });
  }
});

// DELETE /api/recurring/:id
recurringRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ruleId = req.params.id;

    run('DELETE FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, userId]);
    res.json({ message: 'Recurring rule deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete recurring rule.' });
  }
});

// POST /api/recurring/:id/record-now
// Records this recurring payment right now as a transaction and advances the next date!
recurringRouter.post('/:id/record-now', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const ruleId = req.params.id;

    const rule = queryOne<any>('SELECT * FROM recurring_rules WHERE id = ? AND user_id = ?', [ruleId, userId]);
    if (!rule) {
      res.status(404).json({ error: 'Recurring rule not found.' });
      return;
    }

    const txId = `tx_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const nextDate = advanceDate(rule.next_expected_date, rule.frequency);

    const accounts = query<{ id: string; type: any }>('SELECT id, type FROM accounts WHERE user_id = ?', [userId]);
    const accountMap = new Map(accounts.map(a => [a.id, { type: a.type }]));

    const deltas = calculateBalanceDeltas(
      {
        accountId: rule.account_id,
        type: rule.type,
        amountMinor: rule.amount_minor,
      },
      accountMap
    );

    transaction(() => {
      // 1. Insert transaction
      run(
        `INSERT INTO transactions (id, user_id, account_id, category_id, type, amount_minor, currency,
                                   merchant, date, notes, recurring_rule_id, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          txId,
          userId,
          rule.account_id,
          rule.category_id,
          rule.type,
          rule.amount_minor,
          req.user!.currency || 'INR',
          rule.merchant,
          today,
          rule.notes ? `[Recurring] ${rule.notes}` : '[Recurring auto-entry]',
          rule.id,
          now,
          now,
        ]
      );

      // 2. Adjust account balance
      for (const [accId, delta] of deltas.entries()) {
        run('UPDATE accounts SET current_balance_minor = current_balance_minor + ?, updated_at = ? WHERE id = ?', [delta, now, accId]);
      }

      // 3. Advance next date
      run('UPDATE recurring_rules SET next_expected_date = ?, updated_at = ? WHERE id = ?', [nextDate, now, ruleId]);
    });

    res.json({
      message: `Transaction recorded for ${rule.merchant}. Next charge scheduled for ${nextDate}.`,
      nextExpectedDate: nextDate,
    });
  } catch (err: any) {
    console.error('Error recording recurring payment:', err);
    res.status(500).json({ error: 'Could not record recurring payment.' });
  }
});
