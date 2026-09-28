/**
 * PRYORA Financial Domain - Core Financial Invariants & Calculations
 * 
 * Rules:
 * 1. Transfers NEVER count as income or expenses.
 * 2. Credit card purchases increase liability; credit card payments decrease liability
 *    and are represented as transfers from bank to credit card.
 * 3. Split transactions must sum exactly to the parent transaction amount.
 * 4. Net worth = Sum(Asset Balances) - Sum(Liability Balances).
 */

export type AccountType = 
  | 'checking' 
  | 'savings' 
  | 'cash' 
  | 'credit_card' 
  | 'wallet' 
  | 'investment' 
  | 'loan' 
  | 'other';

export type TransactionType = 
  | 'expense' 
  | 'income' 
  | 'transfer' 
  | 'refund' 
  | 'reimbursement';

export interface AccountBalanceState {
  id: string;
  type: AccountType;
  currentBalanceMinor: number;
}

export interface TransactionDomainRecord {
  id?: string;
  accountId: string;
  toAccountId?: string | null;
  type: TransactionType;
  amountMinor: number;
}

/**
 * Validates that split amounts match parent transaction amount exactly.
 */
export function validateTransactionSplits(
  parentAmountMinor: number,
  splits: Array<{ amountMinor: number; categoryId?: string | null; notes?: string }>
): { valid: boolean; differenceMinor: number } {
  if (!splits || splits.length === 0) {
    return { valid: true, differenceMinor: 0 };
  }

  const totalSplits = splits.reduce((sum, s) => sum + s.amountMinor, 0);
  const diff = parentAmountMinor - totalSplits;
  return {
    valid: diff === 0,
    differenceMinor: diff,
  };
}

/**
 * Calculates account balance adjustments for applying a transaction.
 * Returns a map of accountId -> balance delta (in minor units).
 */
export function calculateBalanceDeltas(
  tx: TransactionDomainRecord,
  accountMap: Map<string, { type: AccountType }>
): Map<string, number> {
  const deltas = new Map<string, number>();

  const primaryAccount = accountMap.get(tx.accountId);
  const isPrimaryLiability = primaryAccount?.type === 'credit_card' || primaryAccount?.type === 'loan';

  switch (tx.type) {
    case 'expense':
      if (isPrimaryLiability) {
        // Credit card purchase: liability increases (higher debt)
        deltas.set(tx.accountId, tx.amountMinor);
      } else {
        // Asset account: balance decreases
        deltas.set(tx.accountId, -tx.amountMinor);
      }
      break;

    case 'income':
      if (isPrimaryLiability) {
        // Credit applied directly to credit card / loan
        deltas.set(tx.accountId, -tx.amountMinor);
      } else {
        // Asset account: balance increases
        deltas.set(tx.accountId, tx.amountMinor);
      }
      break;

    case 'refund':
    case 'reimbursement':
      if (isPrimaryLiability) {
        deltas.set(tx.accountId, -tx.amountMinor);
      } else {
        deltas.set(tx.accountId, tx.amountMinor);
      }
      break;

    case 'transfer':
      if (!tx.toAccountId) {
        throw new Error('Transfer transaction requires a destination account (toAccountId)');
      }
      if (tx.accountId === tx.toAccountId) {
        throw new Error('Transfer source and destination accounts must be different');
      }

      // Source account: funds leave
      if (isPrimaryLiability) {
        // Drawing cash advance or borrowing from credit card/loan
        deltas.set(tx.accountId, tx.amountMinor);
      } else {
        deltas.set(tx.accountId, -tx.amountMinor);
      }

      // Destination account: funds arrive
      const toAccount = accountMap.get(tx.toAccountId);
      const isToLiability = toAccount?.type === 'credit_card' || toAccount?.type === 'loan';

      if (isToLiability) {
        // Paying off credit card or loan: reduces liability
        deltas.set(tx.toAccountId, -tx.amountMinor);
      } else {
        // Depositing into asset account
        deltas.set(tx.toAccountId, tx.amountMinor);
      }
      break;
  }

  return deltas;
}

/**
 * Calculates Net Worth from a list of accounts.
 */
export function calculateNetWorth(accounts: Array<any>): {
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  netWorthMinor: number;
} {
  let totalAssetsMinor = 0;
  let totalLiabilitiesMinor = 0;

  for (const acc of accounts) {
    if (acc.isArchived || acc.is_archived) continue;
    const balance = acc.currentBalanceMinor !== undefined 
      ? acc.currentBalanceMinor 
      : (acc.current_balance_minor !== undefined ? acc.current_balance_minor : 0);
    if (acc.type === 'credit_card' || acc.type === 'loan') {
      totalLiabilitiesMinor += Math.max(0, balance);
    } else {
      totalAssetsMinor += balance;
    }
  }

  return {
    totalAssetsMinor,
    totalLiabilitiesMinor,
    netWorthMinor: totalAssetsMinor - totalLiabilitiesMinor,
  };
}

/**
 * Calculates Cash Flow (Income, Expenses, Net Flow, Savings Rate).
 * TRANSFERS ARE STRICTLY EXCLUDED.
 */
export function calculateCashFlow(transactions: Array<any>): {
  totalIncomeMinor: number;
  totalExpensesMinor: number;
  netCashFlowMinor: number;
  savingsRatePercentage: number;
} {
  let totalIncomeMinor = 0;
  let totalExpensesMinor = 0;

  for (const tx of transactions) {
    const amt = tx.amountMinor !== undefined 
      ? tx.amountMinor 
      : (tx.amount_minor !== undefined ? tx.amount_minor : 0);
    if (tx.type === 'income') {
      totalIncomeMinor += amt;
    } else if (tx.type === 'expense') {
      totalExpensesMinor += amt;
    } else if (tx.type === 'refund' || tx.type === 'reimbursement') {
      // Refunds offset expenses
      totalExpensesMinor = Math.max(0, totalExpensesMinor - amt);
    }
    // Transfers are explicitly ignored!
  }

  const netCashFlowMinor = totalIncomeMinor - totalExpensesMinor;
  let savingsRatePercentage = 0;
  if (totalIncomeMinor > 0) {
    savingsRatePercentage = Math.round((netCashFlowMinor / totalIncomeMinor) * 100);
  }

  return {
    totalIncomeMinor,
    totalExpensesMinor,
    netCashFlowMinor,
    savingsRatePercentage,
  };
}

/**
 * Calculates Budget Pacing.
 */
export function calculateBudgetPacing(
  budgetAmountMinor: number,
  spentAmountMinor: number,
  nowDate: Date = new Date()
): {
  spentMinor: number;
  remainingMinor: number;
  percentageUsed: number;
  projectedMonthEndSpendMinor: number;
  paceStatus: 'on_track' | 'caution' | 'over_budget';
  daysElapsed: number;
  daysRemaining: number;
  summaryMessage: string;
} {
  const year = nowDate.getFullYear();
  const month = nowDate.getMonth(); // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.min(daysInMonth, Math.max(1, nowDate.getDate()));
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  const remainingMinor = budgetAmountMinor - spentAmountMinor;
  const percentageUsed = budgetAmountMinor > 0 ? Math.round((spentAmountMinor / budgetAmountMinor) * 100) : 100;

  // Projected spend at end of month based on daily velocity
  const dailyVelocity = spentAmountMinor / daysElapsed;
  const projectedMonthEndSpendMinor = Math.round(dailyVelocity * daysInMonth);

  let paceStatus: 'on_track' | 'caution' | 'over_budget' = 'on_track';
  if (spentAmountMinor > budgetAmountMinor) {
    paceStatus = 'over_budget';
  } else if (projectedMonthEndSpendMinor > budgetAmountMinor || percentageUsed > (daysElapsed / daysInMonth) * 100 + 15) {
    paceStatus = 'caution';
  }

  let summaryMessage = '';
  if (spentAmountMinor > budgetAmountMinor) {
    summaryMessage = `Budget exceeded by ${percentageUsed - 100}% with ${daysRemaining} days remaining.`;
  } else if (paceStatus === 'caution') {
    summaryMessage = `Used ${percentageUsed}% of budget with ${daysRemaining} days remaining; trending over target.`;
  } else {
    summaryMessage = `On track: ${percentageUsed}% used with ${daysRemaining} days left.`;
  }

  return {
    spentMinor: spentAmountMinor,
    remainingMinor,
    percentageUsed,
    projectedMonthEndSpendMinor,
    paceStatus,
    daysElapsed,
    daysRemaining,
    summaryMessage,
  };
}
