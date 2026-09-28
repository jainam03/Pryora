/**
 * PRYORA Shared Frontend TypeScript Types
 */

export interface User {
  id: string;
  email: string;
  display_name: string;
  currency: string;
  locale: string;
  date_format: string;
  onboarding_completed: number;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  currency: string;
  locale: string;
  dateFormat: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AccountType = 
  | 'checking' 
  | 'savings' 
  | 'cash' 
  | 'credit_card' 
  | 'wallet' 
  | 'investment' 
  | 'loan' 
  | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  initial_balance_minor: number;
  current_balance_minor: number;
  institution?: string;
  color?: string;
  icon?: string;
  credit_limit_minor?: number;
  statement_day?: number;
  due_day?: number;
  minimum_payment_minor?: number;
  is_archived: number;
  available_credit_minor?: number;
  utilization_percentage?: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  parent_id?: string | null;
  name: string;
  type: 'expense' | 'income';
  icon?: string;
  color?: string;
  is_archived: number;
  transaction_count?: number;
  created_at: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'reimbursement';

export interface TransactionSplit {
  id?: string;
  category_id?: string | null;
  amount_minor: number;
  notes?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  to_account_id?: string | null;
  category_id?: string | null;
  type: TransactionType;
  amount_minor: number;
  currency: string;
  merchant: string;
  date: string;
  notes?: string | null;
  tags?: string | null;
  receipt_url?: string | null;
  receipt_count?: number;
  recurring_rule_id?: string | null;
  is_split: number;
  created_at: string;
  account_name?: string;
  account_type?: string;
  account_color?: string;
  to_account_name?: string;
  to_account_type?: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount_minor: number;
  period: string;
  month?: string | null;
  category_name: string;
  category_icon?: string;
  category_color?: string;
  spent_minor: number;
  remaining_minor: number;
  percentage_used: number;
  projected_spend_minor: number;
  pace_status: 'on_track' | 'caution' | 'over_budget';
  days_remaining: number;
  summary_message: string;
}

export interface RecurringRule {
  id: string;
  account_id: string;
  category_id?: string | null;
  type: 'expense' | 'income';
  merchant: string;
  amount_minor: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_expected_date: string;
  is_active: number;
  is_subscription: number;
  notes?: string | null;
  account_name?: string;
  category_name?: string;
  monthly_equivalent_minor: number;
  annual_equivalent_minor: number;
}

export interface Goal {
  id: string;
  name: string;
  target_amount_minor: number;
  current_amount_minor: number;
  target_date?: string | null;
  category?: string;
  color?: string;
  icon?: string;
  is_completed: number;
  remaining_minor: number;
  percentage_completed: number;
  months_to_deadline?: number | null;
  contributions_count?: number;
  last_contribution_date?: string | null;
  created_at: string;
}

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

export interface DailySpendingPoint {
  date: string;
  day_name: string;
  day_short: string;
  amount_minor: number;
  is_today: boolean;
}

export interface WeeklySpendingSummary {
  days: DailySpendingPoint[];
  total_minor: number;
  average_minor: number;
  peak_day: string;
  peak_amount_minor: number;
  change_vs_last_week_pct?: number | null;
}

export interface DashboardData {
  summary: {
    total_assets_minor: number;
    total_liabilities_minor: number;
    net_worth_minor: number;
    income_minor: number;
    expenses_minor: number;
    net_cash_flow_minor: number;
    savings_rate_pct: number;
    prev_month_income_minor: number;
    prev_month_expenses_minor: number;
    prev_month_net_cash_flow_minor: number;
  };
  accounts: Account[];
  recent_transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  upcoming_obligations: RecurringRule[];
  insights: FinancialInsight[];
  has_transactions: boolean;
  total_transactions_count: number;
  weekly_spending?: WeeklySpendingSummary;
}
