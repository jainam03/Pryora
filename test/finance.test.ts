/**
 * PRYORA Automated Test Suite: Financial Domain Logic & Invariants
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toMinorUnits, toMajorUnits, formatMoney } from '../server/domain/money.js';
import {
  calculateBalanceDeltas,
  validateTransactionSplits,
  calculateNetWorth,
  calculateCashFlow,
  calculateBudgetPacing,
  AccountType,
} from '../server/domain/finance.js';
import { parseCsvString, exportTransactionsToCsv, normalizeDate } from '../server/domain/csv.js';

describe('PRYORA Money Domain', () => {
  test('Exact integer conversion prevents floating-point inaccuracies', () => {
    // 0.1 + 0.2 floating point check
    const m1 = toMinorUnits('0.10', 'INR'); // 10 paise
    const m2 = toMinorUnits('0.20', 'INR'); // 20 paise
    const sum = m1 + m2;
    assert.equal(sum, 30);
    assert.equal(toMajorUnits(sum, 'INR'), 0.3);

    // Large amount conversion (₹1,50,000 -> 15000000 minor units)
    assert.equal(toMinorUnits('150000', 'INR'), 15000000);
    assert.equal(toMinorUnits('450.50', 'INR'), 45050);
  });

  test('Format money with Indian numbering for INR', () => {
    const formatted = formatMoney(15000000, 'INR');
    assert.equal(formatted, '₹1,50,000.00');

    const formattedSmall = formatMoney(45000, 'INR');
    assert.equal(formattedSmall, '₹450.00');
  });

  test('Format money with standard international formatting for USD', () => {
    const formatted = formatMoney(250000, 'USD');
    assert.equal(formatted, '$2,500.00');
  });
});

describe('PRYORA Financial Invariants', () => {
  test('Transfers do NOT count as income or expenses in Cash Flow', () => {
    const txs = [
      { type: 'income' as const, amountMinor: 10000000 }, // ₹1,00,000 income
      { type: 'expense' as const, amountMinor: 3000000 }, // ₹30,000 expense
      { type: 'transfer' as const, amountMinor: 2000000 }, // ₹20,000 transfer
    ];

    const flow = calculateCashFlow(txs);
    assert.equal(flow.totalIncomeMinor, 10000000);
    assert.equal(flow.totalExpensesMinor, 3000000);
    assert.equal(flow.netCashFlowMinor, 7000000);
    assert.equal(flow.savingsRatePercentage, 70);
  });

  test('Credit Card purchases increase liability, payments reduce liability and are not expenses', () => {
    const accountMap = new Map<string, { type: AccountType }>([
      ['acc_bank', { type: 'checking' }],
      ['acc_cc', { type: 'credit_card' }],
    ]);

    // 1. Purchase of ₹1,500 on credit card
    const purchaseDeltas = calculateBalanceDeltas(
      {
        accountId: 'acc_cc',
        type: 'expense',
        amountMinor: 150000,
      },
      accountMap
    );
    // Liability increases
    assert.equal(purchaseDeltas.get('acc_cc'), 150000);

    // 2. Payment of ₹1,500 from bank to credit card
    const paymentDeltas = calculateBalanceDeltas(
      {
        accountId: 'acc_bank',
        toAccountId: 'acc_cc',
        type: 'transfer',
        amountMinor: 150000,
      },
      accountMap
    );
    // Bank decreases
    assert.equal(paymentDeltas.get('acc_bank'), -150000);
    // Credit card liability decreases
    assert.equal(paymentDeltas.get('acc_cc'), -150000);
  });

  test('Deleting a transaction reverts balance deltas with exact inverse effect', () => {
    const accountMap = new Map<string, { type: AccountType }>([
      ['acc_cash', { type: 'cash' }],
      ['acc_bank', { type: 'checking' }],
    ]);

    // An expense of ₹500 on cash wallet
    const expenseDeltas = calculateBalanceDeltas(
      {
        accountId: 'acc_cash',
        type: 'expense',
        amountMinor: 50000,
      },
      accountMap
    );
    assert.equal(expenseDeltas.get('acc_cash'), -50000);

    // Deleting the expense subtracts the delta, which increases the balance
    const currentBalance = 100000; // was ₹1000
    const delta = expenseDeltas.get('acc_cash')!;
    const afterDeleteBalance = currentBalance - delta;
    assert.equal(afterDeleteBalance, 150000); // balance correctly restored by ₹500
  });

  test('Split transaction validation enforces exact mathematical equality', () => {
    const parentAmount = 50000; // ₹500

    // Exact match
    const validSplits = [
      { amountMinor: 30000, categoryId: 'cat1' },
      { amountMinor: 20000, categoryId: 'cat2' },
    ];
    const check1 = validateTransactionSplits(parentAmount, validSplits);
    assert.equal(check1.valid, true);
    assert.equal(check1.differenceMinor, 0);

    // Under match
    const invalidSplits = [
      { amountMinor: 25000, categoryId: 'cat1' },
      { amountMinor: 20000, categoryId: 'cat2' },
    ];
    const check2 = validateTransactionSplits(parentAmount, invalidSplits);
    assert.equal(check2.valid, false);
    assert.equal(check2.differenceMinor, 5000);
  });

  test('Net worth correctly computes Assets minus Liabilities', () => {
    const accounts = [
      { type: 'checking' as const, currentBalanceMinor: 5000000 },  // ₹50,000
      { type: 'savings' as const, currentBalanceMinor: 20000000 },  // ₹2,00,000
      { type: 'investment' as const, currentBalanceMinor: 50000000 }, // ₹5,00,000
      { type: 'credit_card' as const, currentBalanceMinor: 1500000 }, // ₹15,000 debt
      { type: 'loan' as const, currentBalanceMinor: 10000000 },       // ₹1,00,000 loan
    ];

    const nw = calculateNetWorth(accounts);
    assert.equal(nw.totalAssetsMinor, 75000000); // ₹7,50,000
    assert.equal(nw.totalLiabilitiesMinor, 11500000); // ₹1,15,000
    assert.equal(nw.netWorthMinor, 63500000); // ₹6,35,000
  });

  test('Budget pacing calculates spending velocity and alert states', () => {
    // 15th of 30-day month (50% elapsed)
    const midMonth = new Date(2026, 8, 15); // Sep 15, 2026

    // Budget: ₹10,000. Spent: ₹8,000 (80% used on day 15) -> caution / trending over
    const pacingCaution = calculateBudgetPacing(1000000, 800000, midMonth);
    assert.equal(pacingCaution.percentageUsed, 80);
    assert.equal(pacingCaution.paceStatus, 'caution');
    assert.equal(pacingCaution.projectedMonthEndSpendMinor, 1600000); // ₹16,000 projected

    // Budget: ₹10,000. Spent: ₹11,000 -> over_budget
    const pacingOver = calculateBudgetPacing(1000000, 1100000, midMonth);
    assert.equal(pacingOver.paceStatus, 'over_budget');
  });
});

describe('PRYORA RFC-4180 CSV Engine', () => {
  test('Parses CSV with quoted fields and embedded commas', () => {
    const raw = `Date,Merchant,Amount,Notes\n2026-09-01,"Coffee, Inc.",250.00,"Latte, muffin"\n2026-09-02,Supermarket,1500.50,Grocery`;
    const parsed = parseCsvString(raw);

    assert.equal(parsed.headers.length, 4);
    assert.equal(parsed.rows.length, 2);
    assert.equal(parsed.rows[0][1], 'Coffee, Inc.');
    assert.equal(parsed.rows[0][3], 'Latte, muffin');
  });

  test('Exports transactions to valid CSV format', () => {
    const txs = [
      {
        date: '2026-09-01',
        type: 'expense',
        merchant: 'Dinner Place, LLC',
        categoryName: 'Food & Dining',
        accountName: 'HDFC Bank',
        amountDisplay: 450.0,
        notes: 'Good food',
      },
    ];
    const csv = exportTransactionsToCsv(txs);
    assert.ok(csv.includes('"Dinner Place, LLC"'));
    assert.ok(csv.includes('450.00'));
  });

  test('Normalizes various date formats', () => {
    assert.equal(normalizeDate('2026-09-04'), '2026-09-04');
    assert.equal(normalizeDate('04/09/2026', 'DD/MM/YYYY'), '2026-09-04');
    assert.equal(normalizeDate('09/04/2026', 'MM/DD/YYYY'), '2026-09-04');
  });
});
