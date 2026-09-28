/**
 * PRYORA Budgets API Routes
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';
import { calculateBudgetPacing } from '../domain/finance.js';

export const budgetsRouter = Router();

// GET /api/budgets
budgetsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = `${currentMonth}-01`;
    const endOfMonth = `${currentMonth}-31`;

    const budgets = query<any>(
      `SELECT b.id, b.category_id, b.amount_minor, b.period, b.month,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ?
       ORDER BY c.name ASC`,
      [userId]
    );

    // Get current month's expenses per category (including direct and splits)
    const directExpenses = query<{ category_id: string; total_spent: number }>(
      `SELECT category_id, SUM(amount_minor) as total_spent
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? AND category_id IS NOT NULL
       GROUP BY category_id`,
      [userId, startOfMonth, endOfMonth]
    );

    const splitExpenses = query<{ category_id: string; total_spent: number }>(
      `SELECT ts.category_id, SUM(ts.amount_minor) as total_spent
       FROM transaction_splits ts
       JOIN transactions t ON t.id = ts.transaction_id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ? AND ts.category_id IS NOT NULL
       GROUP BY ts.category_id`,
      [userId, startOfMonth, endOfMonth]
    );

    const spentMap = new Map<string, number>();
    for (const row of directExpenses) {
      spentMap.set(row.category_id, (spentMap.get(row.category_id) || 0) + (row.total_spent || 0));
    }
    for (const row of splitExpenses) {
      spentMap.set(row.category_id, (spentMap.get(row.category_id) || 0) + (row.total_spent || 0));
    }

    const enhancedBudgets = budgets.map(b => {
      const spent = spentMap.get(b.category_id) || 0;
      const pacing = calculateBudgetPacing(b.amount_minor, spent, now);

      return {
        ...b,
        spent_minor: spent,
        remaining_minor: pacing.remainingMinor,
        percentage_used: pacing.percentageUsed,
        projected_spend_minor: pacing.projectedMonthEndSpendMinor,
        pace_status: pacing.paceStatus,
        days_remaining: pacing.daysRemaining,
        summary_message: pacing.summaryMessage,
      };
    });

    const totalBudgetedMinor = enhancedBudgets.reduce((s, b) => s + b.amount_minor, 0);
    const totalSpentMinor = enhancedBudgets.reduce((s, b) => s + b.spent_minor, 0);
    const overallPacing = calculateBudgetPacing(totalBudgetedMinor, totalSpentMinor, now);

    res.json({
      budgets: enhancedBudgets,
      summary: {
        total_budgeted_minor: totalBudgetedMinor,
        total_spent_minor: totalSpentMinor,
        total_remaining_minor: Math.max(0, totalBudgetedMinor - totalSpentMinor),
        overall_percentage_used: overallPacing.percentageUsed,
        overall_pace_status: overallPacing.paceStatus,
        days_remaining: overallPacing.daysRemaining,
      },
    });
  } catch (err) {
    console.error('Error fetching budgets:', err);
    res.status(500).json({ error: 'Could not fetch budgets.' });
  }
});

// POST /api/budgets
budgetsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { categoryId, amount, period, month } = req.body;

    if (!categoryId) {
      res.status(400).json({ error: 'Please select a category.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Budget amount must be greater than zero.' });
      return;
    }

    // Check if budget already exists for this category
    const existing = queryOne('SELECT id FROM budgets WHERE user_id = ? AND category_id = ?', [userId, categoryId]);
    const now = new Date().toISOString();

    if (existing) {
      run(
        `UPDATE budgets SET amount_minor = ?, period = ?, updated_at = ? WHERE id = ?`,
        [amountMinor, period || 'monthly', now, existing.id]
      );
      const updated = queryOne('SELECT * FROM budgets WHERE id = ?', [existing.id]);
      res.json({ message: 'Budget updated successfully.', budget: updated });
      return;
    }

    const budgetId = `bgt_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    run(
      `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, month, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [budgetId, userId, categoryId, amountMinor, period || 'monthly', month || null, now, now]
    );

    const created = queryOne('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    res.status(201).json({ message: 'Budget created successfully.', budget: created });
  } catch (err) {
    console.error('Error creating budget:', err);
    res.status(500).json({ error: 'Could not create budget.' });
  }
});

// DELETE /api/budgets/:id
budgetsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const budgetId = req.params.id;

    run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [budgetId, userId]);
    res.json({ message: 'Budget removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete budget.' });
  }
});
