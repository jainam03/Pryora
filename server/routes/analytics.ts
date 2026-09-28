/**
 * PRYORA Analytics & Dashboard API Routes
 * 
 * Provides:
 * - Executive dashboard summary
 * - Net worth calculations (Assets vs Liabilities)
 * - Monthly Cash Flow (strictly excluding transfers)
 * - Category spending distribution
 * - Merchant analytics
 * - Evidence-based insights
 */

import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { query } from '../db/database.js';
import { calculateNetWorth, calculateCashFlow } from '../domain/finance.js';
import { generateEvidenceBasedInsights } from '../domain/insights.js';

export const analyticsRouter = Router();

// GET /api/analytics/dashboard
analyticsRouter.get('/dashboard', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const currency = req.user!.currency || 'INR';
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
    const startOfMonth = `${currentMonthStr}-01`;
    const endOfMonth = `${currentMonthStr}-31`;

    // 1. Accounts & Net Worth
    const accounts = query<any>(
      `SELECT id, name, type, current_balance_minor, credit_limit_minor, color, icon, is_archived
       FROM accounts
       WHERE user_id = ? AND is_archived = 0
       ORDER BY type ASC, name ASC`,
      [userId]
    );
    const netWorthData = calculateNetWorth(accounts);

    // 2. Current Month Transactions
    const currentMonthTxs = query<any>(
      `SELECT id, account_id, to_account_id, category_id, type, amount_minor, date, merchant
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ?`,
      [userId, startOfMonth, endOfMonth]
    );

    // 3. Previous Month Transactions (for comparisons and insights)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const startOfPrevMonth = `${prevMonthStr}-01`;
    const endOfPrevMonth = `${prevMonthStr}-31`;

    const prevMonthTxs = query<any>(
      `SELECT id, type, amount_minor, category_id, date, merchant
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ?`,
      [userId, startOfPrevMonth, endOfPrevMonth]
    );

    // 4. Cash Flow Calculations
    const cashFlow = calculateCashFlow(currentMonthTxs);
    const prevCashFlow = calculateCashFlow(prevMonthTxs);

    // 5. Recent Transactions (last 10)
    const recentTransactions = query<any>(
      `SELECT t.id, t.type, t.amount_minor, t.currency, t.merchant, t.date, t.notes,
              a.name as account_name, a.color as account_color,
              c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ?
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT 8`,
      [userId]
    );

    // 6. Budgets
    const budgets = query<any>(
      `SELECT b.id, b.category_id, b.amount_minor, c.name as category_name, c.icon as category_icon, c.color as category_color
       FROM budgets b
       JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = ?`,
      [userId]
    );

    // Calculate budget spending
    const spentByCategory = new Map<string, number>();
    for (const tx of currentMonthTxs) {
      const catId = tx.category_id || tx.categoryId;
      const amt = tx.amount_minor !== undefined ? tx.amount_minor : (tx.amountMinor || 0);
      if (tx.type === 'expense' && catId) {
        spentByCategory.set(catId, (spentByCategory.get(catId) || 0) + amt);
      }
    }
    const enhancedBudgets = budgets.map(b => {
      const spent = spentByCategory.get(b.category_id) || 0;
      return {
        ...b,
        spent_minor: spent,
        percentage: b.amount_minor > 0 ? Math.round((spent / b.amount_minor) * 100) : 0,
      };
    });

    // 7. Goals
    const goals = query<any>(
      `SELECT id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed
       FROM goals
       WHERE user_id = ? AND is_completed = 0
       ORDER BY target_date ASC
       LIMIT 4`,
      [userId]
    );

    // 8. Recurring Rules & Upcoming Bills
    const recurringRules = query<any>(
      `SELECT id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription
       FROM recurring_rules
       WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    const todayStr = now.toISOString().slice(0, 10);
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);
    const in14DaysStr = in14Days.toISOString().slice(0, 10);

    const upcomingObligations = recurringRules
      .filter(r => r.next_expected_date >= todayStr && r.next_expected_date <= in14DaysStr)
      .sort((a, b) => a.next_expected_date.localeCompare(b.next_expected_date))
      .slice(0, 5);

    // 9. Categories map
    const categories = query<any>('SELECT id, name FROM categories WHERE user_id = ?', [userId]);

    // 10. Generate Evidence-based insights
    const insights = generateEvidenceBasedInsights({
      currencyCode: currency,
      nowDate: now,
      accounts,
      categories,
      currentMonthTransactions: currentMonthTxs,
      previousMonthTransactions: prevMonthTxs,
      budgets,
      recurringRules,
    });

    // 11. Current Week Daily Spending Trends (Monday to Sunday)
    const dayOfWeek = (now.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const startOfWeekStr = monday.toISOString().slice(0, 10);
    const endOfWeekStr = sunday.toISOString().slice(0, 10);

    // Previous week for comparison
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevSunday = new Date(monday);
    prevSunday.setDate(monday.getDate() - 1);
    const startOfPrevWeekStr = prevMonday.toISOString().slice(0, 10);
    const endOfPrevWeekStr = prevSunday.toISOString().slice(0, 10);

    const currentWeekExpenses = query<{ date: string; total_minor: number }>(
      `SELECT date, SUM(amount_minor) as total_minor
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?
       GROUP BY date`,
      [userId, startOfWeekStr, endOfWeekStr]
    );

    const prevWeekExpenses = query<{ total_minor: number }>(
      `SELECT SUM(amount_minor) as total_minor
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`,
      [userId, startOfPrevWeekStr, endOfPrevWeekStr]
    );

    const expMap = new Map<string, number>();
    for (const row of currentWeekExpenses) {
      expMap.set(row.date, row.total_minor || 0);
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayShorts = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const weekDays: Array<{ date: string; day_name: string; day_short: string; amount_minor: number; is_today: boolean }> = [];

    let weekTotalMinor = 0;
    let peakAmountMinor = 0;
    let peakDay = 'Mon';

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      const amt = expMap.get(dStr) || 0;
      weekTotalMinor += amt;
      if (amt >= peakAmountMinor) {
        peakAmountMinor = amt;
        peakDay = dayNames[i];
      }
      weekDays.push({
        date: dStr,
        day_name: dayNames[i],
        day_short: dayShorts[i],
        amount_minor: amt,
        is_today: dStr === todayStr,
      });
    }

    const elapsedDays = dayOfWeek + 1;
    const averageDailyMinor = elapsedDays > 0 ? Math.round(weekTotalMinor / elapsedDays) : 0;
    const prevWeekTotalMinor = prevWeekExpenses[0]?.total_minor || 0;
    let changeVsLastWeekPct: number | null = null;
    if (prevWeekTotalMinor > 0) {
      changeVsLastWeekPct = Math.round(((weekTotalMinor - prevWeekTotalMinor) / prevWeekTotalMinor) * 100);
    }

    const weeklySpending = {
      days: weekDays,
      total_minor: weekTotalMinor,
      average_minor: averageDailyMinor,
      peak_day: peakAmountMinor > 0 ? peakDay : dayNames[dayOfWeek],
      peak_amount_minor: peakAmountMinor,
      change_vs_last_week_pct: changeVsLastWeekPct,
    };

    // Total transaction count to determine empty-state vs populated dashboard
    const txTotalCount = query<any>('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?', [userId])[0]?.count || 0;

    res.json({
      summary: {
        total_assets_minor: netWorthData.totalAssetsMinor,
        total_liabilities_minor: netWorthData.totalLiabilitiesMinor,
        net_worth_minor: netWorthData.netWorthMinor,
        income_minor: cashFlow.totalIncomeMinor,
        expenses_minor: cashFlow.totalExpensesMinor,
        net_cash_flow_minor: cashFlow.netCashFlowMinor,
        savings_rate_pct: cashFlow.savingsRatePercentage,
        prev_month_income_minor: prevCashFlow.totalIncomeMinor,
        prev_month_expenses_minor: prevCashFlow.totalExpensesMinor,
        prev_month_net_cash_flow_minor: prevCashFlow.netCashFlowMinor,
      },
      accounts,
      recent_transactions: recentTransactions,
      budgets: enhancedBudgets,
      goals,
      upcoming_obligations: upcomingObligations,
      insights,
      has_transactions: txTotalCount > 0,
      total_transactions_count: txTotalCount,
      weekly_spending: weeklySpending,
    });
  } catch (err) {
    console.error('Error generating dashboard analytics:', err);
    res.status(500).json({ error: 'Could not generate dashboard summary.' });
  }
});

// GET /api/analytics/cashflow - Monthly trends over past 6 months
analyticsRouter.get('/cashflow', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const months: Array<{ monthStr: string; label: string }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months.push({ monthStr: mStr, label });
    }

    const history = months.map(m => {
      const txs = query<{ type: string; amount_minor: number }>(
        `SELECT type, amount_minor FROM transactions 
         WHERE user_id = ? AND date >= ? AND date <= ?`,
        [userId, `${m.monthStr}-01`, `${m.monthStr}-31`]
      );

      let income = 0;
      let expenses = 0;
      for (const t of txs) {
        if (t.type === 'income') income += t.amount_minor;
        else if (t.type === 'expense') expenses += t.amount_minor;
        else if (t.type === 'refund' || t.type === 'reimbursement') {
          expenses = Math.max(0, expenses - t.amount_minor);
        }
      }

      return {
        month: m.monthStr,
        label: m.label,
        income_minor: income,
        expenses_minor: expenses,
        net_flow_minor: income - expenses,
      };
    });

    res.json({ history });
  } catch (err) {
    console.error('Error fetching cashflow history:', err);
    res.status(500).json({ error: 'Could not fetch cashflow trends.' });
  }
});

// GET /api/analytics/spending - Category & merchant breakdown
analyticsRouter.get('/spending', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { period = 'current_month' } = req.query as Record<string, string>;

    const now = new Date();
    let startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    let endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

    if (period === 'last_30_days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
    } else if (period === 'this_year') {
      startDate = `${now.getFullYear()}-01-01`;
      endDate = `${now.getFullYear()}-12-31`;
    }

    // Direct category expenses
    const directCategories = query<any>(
      `SELECT c.id, c.name, c.icon, c.color, SUM(t.amount_minor) as total_minor, COUNT(t.id) as count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
       GROUP BY c.id
       ORDER BY total_minor DESC`,
      [userId, startDate, endDate]
    );

    // Top merchants
    const merchants = query<any>(
      `SELECT t.merchant, SUM(t.amount_minor) as total_minor, COUNT(t.id) as count
       FROM transactions t
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
       GROUP BY t.merchant
       ORDER BY total_minor DESC
       LIMIT 10`,
      [userId, startDate, endDate]
    );

    const totalExpenseMinor = directCategories.reduce((sum: number, c: any) => sum + (c.total_minor || 0), 0);

    const categoriesWithShare = directCategories.map((c: any) => ({
      ...c,
      share_percentage: totalExpenseMinor > 0 ? Math.round((c.total_minor / totalExpenseMinor) * 100) : 0,
    }));

    res.json({
      categories: categoriesWithShare,
      merchants,
      total_expense_minor: totalExpenseMinor,
      period: { startDate, endDate },
    });
  } catch (err) {
    console.error('Error fetching spending breakdown:', err);
    res.status(500).json({ error: 'Could not fetch spending analytics.' });
  }
});
