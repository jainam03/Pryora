/**
 * PRYORA Financial Goals API Routes
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query, queryOne, run, transaction } from '../db/database.js';
import { toMinorUnits } from '../domain/money.js';

export const goalsRouter = Router();

// GET /api/goals
goalsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const goals = query<any>(
      `SELECT g.id, g.name, g.target_amount_minor, g.current_amount_minor,
              g.target_date, g.category, g.color, g.icon, g.is_completed,
              g.created_at, g.updated_at,
              (SELECT COUNT(*) FROM goal_contributions gc WHERE gc.goal_id = g.id) as contributions_count,
              (SELECT MAX(gc.date) FROM goal_contributions gc WHERE gc.goal_id = g.id) as last_contribution_date
       FROM goals g
       WHERE g.user_id = ?
       ORDER BY g.is_completed ASC, g.target_date ASC`,
      [userId]
    );

    const enhanced = goals.map(g => {
      const target = g.target_amount_minor || 0;
      const current = g.current_amount_minor || 0;
      const remaining = Math.max(0, target - current);
      const percentage = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;

      // Project completion based on timeline
      let projectedMonthsRemaining: number | null = null;
      if (g.target_date && !g.is_completed) {
        const targetD = new Date(g.target_date);
        const now = new Date();
        const diffMonths = (targetD.getFullYear() - now.getFullYear()) * 12 + (targetD.getMonth() - now.getMonth());
        projectedMonthsRemaining = Math.max(0, diffMonths);
      }

      return {
        ...g,
        remaining_minor: remaining,
        percentage_completed: percentage,
        months_to_deadline: projectedMonthsRemaining,
      };
    });

    res.json({ goals: enhanced });
  } catch (err) {
    console.error('Error fetching goals:', err);
    res.status(500).json({ error: 'Could not fetch goals.' });
  }
});

// POST /api/goals
goalsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, targetAmount, currentAmount, targetDate, category, color, icon } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Goal name is required.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const targetMinor = toMinorUnits(targetAmount || 0, currency);
    const currentMinor = currentAmount ? toMinorUnits(currentAmount, currency) : 0;

    if (targetMinor <= 0) {
      res.status(400).json({ error: 'Target amount must be greater than zero.' });
      return;
    }

    const goalId = `goal_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor,
                          target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        goalId,
        userId,
        name.trim(),
        targetMinor,
        currentMinor,
        targetDate || null,
        category || 'savings_target',
        color || '#10B981',
        icon || 'Target',
        now,
        now,
      ]
    );

    const created = queryOne('SELECT * FROM goals WHERE id = ?', [goalId]);
    res.status(201).json({ message: 'Goal created successfully.', goal: created });
  } catch (err) {
    console.error('Error creating goal:', err);
    res.status(500).json({ error: 'Could not create goal.' });
  }
});

// POST /api/goals/:id/contribute
goalsRouter.post('/:id/contribute', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const goalId = req.params.id;
    const { amount, notes, date } = req.body;

    const goal = queryOne<any>('SELECT * FROM goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    if (!goal) {
      res.status(404).json({ error: 'Goal not found.' });
      return;
    }

    const currency = req.user!.currency || 'INR';
    const amountMinor = toMinorUnits(amount, currency);

    if (amountMinor <= 0) {
      res.status(400).json({ error: 'Contribution amount must be greater than zero.' });
      return;
    }

    const contribId = `gc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const contribDate = date || now.slice(0, 10);

    transaction(() => {
      // 1. Insert contribution log
      run(
        `INSERT INTO goal_contributions (id, goal_id, user_id, amount_minor, date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [contribId, goalId, userId, amountMinor, contribDate, notes?.trim() || null, now]
      );

      // 2. Update goal current amount
      const newTotal = goal.current_amount_minor + amountMinor;
      const isCompleted = newTotal >= goal.target_amount_minor ? 1 : 0;

      run(
        `UPDATE goals SET current_amount_minor = ?, is_completed = ?, updated_at = ? WHERE id = ?`,
        [newTotal, isCompleted, now, goalId]
      );
    });

    const updated = queryOne('SELECT * FROM goals WHERE id = ?', [goalId]);
    res.json({ message: 'Contribution recorded successfully.', goal: updated });
  } catch (err) {
    console.error('Error contributing to goal:', err);
    res.status(500).json({ error: 'Could not record contribution.' });
  }
});

// DELETE /api/goals/:id
goalsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const goalId = req.params.id;

    run('DELETE FROM goals WHERE id = ? AND user_id = ?', [goalId, userId]);
    res.json({ message: 'Goal removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete goal.' });
  }
});
