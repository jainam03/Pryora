/**
 * PRYORA Financial Domain - Evidence-Based Financial Feedback & Insights
 * 
 * Rules:
 * 1. Must be strictly derived from actual recorded transactions and rules.
 * 2. Cautious, clear, actionable, and non-prescriptive (no fake predictions).
 */

export interface FinancialInsight {
  id: string;
  type: 'spending_anomaly' | 'budget_alert' | 'upcoming_obligation' | 'savings_milestone' | 'credit_utilization' | 'positive_trend';
  severity: 'info' | 'warning' | 'alert' | 'positive';
  title: string;
  message: string;
  actionLabel?: string;
  actionTab?: string;
  metric?: string;
}

export interface InsightContext {
  currencyCode: string;
  nowDate: Date;
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currentBalanceMinor: number;
    creditLimitMinor?: number;
  }>;
  categories: Array<{ id: string; name: string }>;
  currentMonthTransactions: Array<{
    id: string;
    type: string;
    amountMinor: number;
    categoryId?: string | null;
    date: string;
    merchant: string;
  }>;
  previousMonthTransactions: Array<{
    id: string;
    type: string;
    amountMinor: number;
    categoryId?: string | null;
    date: string;
    merchant: string;
  }>;
  budgets: Array<{
    id: string;
    categoryId: string;
    amountMinor: number;
  }>;
  recurringRules: Array<{
    id: string;
    merchant: string;
    amountMinor: number;
    frequency: string;
    nextExpectedDate: string;
    isActive: number;
  }>;
}

import { formatMoney } from './money.js';

export function generateEvidenceBasedInsights(ctx: InsightContext): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
  const categoryMap = new Map(ctx.categories.map(c => [c.id, c.name]));

  // 1. Credit Utilization Warning
  for (const acc of ctx.accounts) {
    if (acc.type === 'credit_card' && acc.creditLimitMinor && acc.creditLimitMinor > 0) {
      const utilization = (acc.currentBalanceMinor / acc.creditLimitMinor) * 100;
      if (utilization >= 70) {
        insights.push({
          id: `credit-util-${acc.id}`,
          type: 'credit_utilization',
          severity: utilization > 90 ? 'alert' : 'warning',
          title: 'High Credit Utilization',
          message: `${acc.name} is at ${Math.round(utilization)}% of its ${formatMoney(acc.creditLimitMinor, ctx.currencyCode)} credit limit. Outstanding balance: ${formatMoney(acc.currentBalanceMinor, ctx.currencyCode)}.`,
          actionLabel: 'Pay Credit Card',
          actionTab: 'accounts',
          metric: `${Math.round(utilization)}%`,
        });
      }
    }
  }

  // 2. Budget Alerts
  const currentMonthSpentByCategory = new Map<string, number>();
  for (const tx of ctx.currentMonthTransactions) {
    if (tx.type === 'expense' && tx.categoryId) {
      const current = currentMonthSpentByCategory.get(tx.categoryId) || 0;
      currentMonthSpentByCategory.set(tx.categoryId, current + tx.amountMinor);
    }
  }

  const daysInMonth = new Date(ctx.nowDate.getFullYear(), ctx.nowDate.getMonth() + 1, 0).getDate();
  const dayOfMonth = Math.max(1, ctx.nowDate.getDate());
  const monthProgressPct = (dayOfMonth / daysInMonth) * 100;

  for (const b of ctx.budgets) {
    const spent = currentMonthSpentByCategory.get(b.categoryId) || 0;
    const catName = categoryMap.get(b.categoryId) || 'Category';
    const percentUsed = b.amountMinor > 0 ? (spent / b.amountMinor) * 100 : 100;

    if (spent > b.amountMinor) {
      const overBy = spent - b.amountMinor;
      insights.push({
        id: `budget-over-${b.id}`,
        type: 'budget_alert',
        severity: 'alert',
        title: 'Budget Exceeded',
        message: `${catName} budget is exceeded by ${formatMoney(overBy, ctx.currencyCode)} (${Math.round(percentUsed)}% used) with ${daysInMonth - dayOfMonth} days remaining.`,
        actionLabel: 'Review Budget',
        actionTab: 'budgets',
        metric: `${Math.round(percentUsed)}%`,
      });
    } else if (percentUsed > monthProgressPct + 25 && percentUsed >= 75) {
      insights.push({
        id: `budget-pacing-${b.id}`,
        type: 'budget_alert',
        severity: 'warning',
        title: 'Pacing Alert',
        message: `You've used ${Math.round(percentUsed)}% of your ${catName} budget with ${daysInMonth - dayOfMonth} days left in the month.`,
        actionLabel: 'Check Spending',
        actionTab: 'budgets',
        metric: `${Math.round(percentUsed)}%`,
      });
    }
  }

  // 3. Upcoming Recurring Obligations (next 7 days)
  const nowIso = ctx.nowDate.toISOString().slice(0, 10);
  const next7Days = new Date(ctx.nowDate);
  next7Days.setDate(next7Days.getDate() + 7);
  const next7DaysIso = next7Days.toISOString().slice(0, 10);

  const upcomingBills = ctx.recurringRules.filter(r => 
    r.isActive === 1 && 
    r.nextExpectedDate >= nowIso && 
    r.nextExpectedDate <= next7DaysIso
  );

  if (upcomingBills.length > 0) {
    const totalUpcomingMinor = upcomingBills.reduce((s, b) => s + b.amountMinor, 0);
    insights.push({
      id: 'upcoming-bills-7d',
      type: 'upcoming_obligation',
      severity: 'info',
      title: 'Upcoming Obligations',
      message: `You have ${upcomingBills.length} recurring payment${upcomingBills.length > 1 ? 's' : ''} scheduled in the next 7 days totaling ${formatMoney(totalUpcomingMinor, ctx.currencyCode)}.`,
      actionLabel: 'View Subscriptions',
      actionTab: 'subscriptions',
      metric: formatMoney(totalUpcomingMinor, ctx.currencyCode),
    });
  }

  // 4. Category Spending Anomalies (comparing current month to previous month)
  const prevMonthSpentByCategory = new Map<string, number>();
  for (const tx of ctx.previousMonthTransactions) {
    if (tx.type === 'expense' && tx.categoryId) {
      const cur = prevMonthSpentByCategory.get(tx.categoryId) || 0;
      prevMonthSpentByCategory.set(tx.categoryId, cur + tx.amountMinor);
    }
  }

  for (const [catId, currentSpent] of currentMonthSpentByCategory.entries()) {
    const prevSpent = prevMonthSpentByCategory.get(catId);
    // Only analyze if baseline had at least minor spending
    if (prevSpent && prevSpent >= 10000 && currentSpent >= 15000) {
      const increaseRatio = (currentSpent - prevSpent) / prevSpent;
      if (increaseRatio >= 0.35) {
        const catName = categoryMap.get(catId) || 'Category';
        insights.push({
          id: `anomaly-${catId}`,
          type: 'spending_anomaly',
          severity: 'warning',
          title: 'Spending Acceleration',
          message: `${catName} spending is ${Math.round(increaseRatio * 100)}% higher than last month (${formatMoney(currentSpent, ctx.currencyCode)} vs ${formatMoney(prevSpent, ctx.currencyCode)}).`,
          actionLabel: 'View Category',
          actionTab: 'analytics',
          metric: `+${Math.round(increaseRatio * 100)}%`,
        });
      }
    }
  }

  // 5. Positive Savings Rate Check
  let currIncome = 0;
  let currExpense = 0;
  for (const tx of ctx.currentMonthTransactions) {
    if (tx.type === 'income') currIncome += tx.amountMinor;
    else if (tx.type === 'expense') currExpense += tx.amountMinor;
  }

  if (currIncome > 0 && currIncome > currExpense) {
    const savingsRate = Math.round(((currIncome - currExpense) / currIncome) * 100);
    if (savingsRate >= 20) {
      insights.push({
        id: 'positive-savings-rate',
        type: 'positive_trend',
        severity: 'positive',
        title: 'Strong Cash Retention',
        message: `Your savings rate is currently ${savingsRate}% this month, retaining ${formatMoney(currIncome - currExpense, ctx.currencyCode)} of income.`,
        actionLabel: 'View Cash Flow',
        actionTab: 'cashflow',
        metric: `${savingsRate}%`,
      });
    }
  }

  return insights;
}
