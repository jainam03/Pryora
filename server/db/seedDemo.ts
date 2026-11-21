/**
 * PRYORA Demo Workspace Seeder
 *
 * Seeds a realistic Indian early-career financial dataset for demo@pryora.app
 * with double-entry transactions, accounts, budgets, goals, and recurring rules.
 */

import { queryOne, run, transaction, seedDefaultCategories, query } from './database.js';
import { hashPassword } from '../auth.js';

export function ensureDemoWorkspace(): string {
  const demoEmail = 'demo@pryora.app';
  const existing = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [demoEmail]);

  if (existing) {
    return existing.id;
  }

  const userId = `usr_demo_${Date.now().toString(36)}`;
  const { salt, hash } = hashPassword('password123');
  const now = new Date();
  const nowIso = now.toISOString();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const prevMonth = String(now.getMonth() === 0 ? 12 : now.getMonth()).padStart(2, '0');
  const prevYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;

  const upcomingDay = String(Math.min(28, now.getDate() + 3)).padStart(2, '0');
  const upcomingDay2 = String(Math.min(28, now.getDate() + 5)).padStart(2, '0');

  transaction(() => {
    // 1. Create Demo User (Relatable Indian early-career professional persona)
    run(
      `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Aarav Sharma', 'INR', 'en-IN', 'DD/MM/YYYY', 1, ?, ?)`,
      [userId, demoEmail, hash, salt, nowIso, nowIso]
    );

    // 2. Categories
    seedDefaultCategories(userId);

    const categories = query<{ id: string; name: string; type: string }>(
      'SELECT id, name, type FROM categories WHERE user_id = ?',
      [userId]
    );
    const catMap: Record<string, string> = {};
    for (const c of categories) {
      catMap[c.name] = c.id;
    }

    // 3. Accounts
    const accCheckingId = `acc_demo_checking_${userId}`;
    const accSavingsId = `acc_demo_savings_${userId}`;
    const accCreditCardId = `acc_demo_card_${userId}`;
    const accCashId = `acc_demo_cash_${userId}`;

    // HDFC Salary / UPI Account: ₹54,200
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'HDFC Bank (UPI)', 'checking', 'INR', 5420000, 5420000, 'HDFC Bank', '#2563EB', 'Landmark', 0, ?, ?)`,
      [accCheckingId, userId, nowIso, nowIso]
    );

    // SBI Savings Reserve: ₹1,15,000
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'SBI Savings Account', 'savings', 'INR', 11500000, 11500000, 'State Bank of India', '#059669', 'PiggyBank', 0, ?, ?)`,
      [accSavingsId, userId, nowIso, nowIso]
    );

    // ICICI Amazon Pay Credit Card: ₹8,450 owed, limit ₹60,000
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, credit_limit_minor, statement_day, due_day, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'ICICI Amazon Pay Card', 'credit_card', 'INR', 845000, 845000, 6000000, 18, 5, 'ICICI Bank', '#E11D48', 'CreditCard', 0, ?, ?)`,
      [accCreditCardId, userId, nowIso, nowIso]
    );

    // Cash Wallet: ₹2,400
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'Cash Wallet', 'cash', 'INR', 240000, 240000, 'Cash', '#D97706', 'Wallet', 0, ?, ?)`,
      [accCashId, userId, nowIso, nowIso]
    );

    // 4. Budgets (Realistic monthly early-career limits in INR)
    if (catMap['Food & Dining']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 800000, 'monthly', ?, ?)`,
        [`bg_1_${userId}`, userId, catMap['Food & Dining'], nowIso, nowIso]
      );
    }
    if (catMap['Shopping & Essentials']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 600000, 'monthly', ?, ?)`,
        [`bg_2_${userId}`, userId, catMap['Shopping & Essentials'], nowIso, nowIso]
      );
    }
    if (catMap['Utilities & Bills']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 350000, 'monthly', ?, ?)`,
        [`bg_3_${userId}`, userId, catMap['Utilities & Bills'], nowIso, nowIso]
      );
    }
    if (catMap['Transportation']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 400000, 'monthly', ?, ?)`,
        [`bg_4_${userId}`, userId, catMap['Transportation'], nowIso, nowIso]
      );
    }

    // 5. Recurring Rules / Subscriptions
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Shared Flat Rent (2BHK)', 1450000, 'monthly', ?, 1, 0, 'Monthly rent via UPI', ?, ?)`,
      [`rec_1_${userId}`, userId, accCheckingId, catMap['Housing & Rent'] || null, `${currentYear}-${currentMonth}-01`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Airtel Xstream Fiber', 94300, 'monthly', ?, 1, 1, 'Home Wi-Fi plan', ?, ?)`,
      [`rec_2_${userId}`, userId, accCheckingId, catMap['Utilities & Bills'] || null, `${currentYear}-${currentMonth}-${upcomingDay}`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Spotify & YouTube Premium', 26800, 'monthly', ?, 1, 1, 'Music & ad-free video', ?, ?)`,
      [`rec_3_${userId}`, userId, accCreditCardId, catMap['Subscriptions'] || null, `${currentYear}-${currentMonth}-${upcomingDay2}`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Nifty 50 Index SIP', 800000, 'monthly', ?, 1, 0, 'Monthly mutual fund SIP', ?, ?)`,
      [`rec_4_${userId}`, userId, accCheckingId, catMap['Investments & Savings'] || null, `${currentYear}-${currentMonth}-10`, nowIso, nowIso]
    );

    // 6. Goals (Relatable Indian goals)
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, 'Emergency Fund (3 Months)', 15000000, 9600000, ?, 'emergency_fund', '#059669', 'ShieldCheck', 0, ?, ?)`,
      [`goal_1_${userId}`, userId, `${currentYear}-12-31`, nowIso, nowIso]
    );
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, 'Laptop Upgrade Fund', 6500000, 3200000, ?, 'major_purchase', '#2563EB', 'Laptop', 0, ?, ?)`,
      [`goal_2_${userId}`, userId, `${currentYear}-11-15`, nowIso, nowIso]
    );
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, 'Goa Trip with Friends', 2500000, 1450000, ?, 'vacation', '#7C3AED', 'Plane', 0, ?, ?)`,
      [`goal_3_${userId}`, userId, `${currentYear}-10-20`, nowIso, nowIso]
    );

    // 7. Realistic Transactions (Current & Previous Month)
    const txs = [
      {
        id: `tx_1_${userId}`,
        acc: accCheckingId,
        cat: catMap['Salary'],
        type: 'income',
        amt: 6800000,
        merchant: 'Monthly Salary Credit',
        date: `${currentYear}-${currentMonth}-01`,
        notes: 'In-hand salary credit',
      },
      {
        id: `tx_2_${userId}`,
        acc: accCheckingId,
        cat: catMap['Housing & Rent'],
        type: 'expense',
        amt: 1450000,
        merchant: 'Shared Flat Rent (UPI)',
        date: `${currentYear}-${currentMonth}-02`,
        notes: 'Rent share + society maintenance',
      },
      {
        id: `tx_3_${userId}`,
        acc: accCheckingId,
        cat: catMap['Food & Dining'],
        type: 'expense',
        amt: 64500,
        merchant: 'Swiggy — Late Night Dinner',
        date: `${currentYear}-${currentMonth}-03`,
        notes: 'UPI AutoPay order',
      },
      {
        id: `tx_4_${userId}`,
        acc: accCheckingId,
        cat: null,
        type: 'expense',
        amt: 285000,
        merchant: 'Zepto & DMart Weekly Run',
        date: `${currentYear}-${currentMonth}-04`,
        notes: 'Split between groceries and household supplies',
        split: [
          { cat: catMap['Food & Dining'], amt: 195000, notes: 'Fresh veggies, milk & pantry' },
          { cat: catMap['Shopping & Essentials'], amt: 90000, notes: 'Toiletries & cleaning items' },
        ],
      },
      {
        id: `tx_5_${userId}`,
        acc: accCheckingId,
        cat: catMap['Utilities & Bills'],
        type: 'expense',
        amt: 164000,
        merchant: 'BESCOM Electricity & Jio Recharge',
        date: `${currentYear}-${currentMonth}-05`,
        notes: 'Monthly power bill + mobile prepaid',
      },
      {
        id: `tx_6_${userId}`,
        acc: accCheckingId,
        cat: catMap['Transportation'],
        type: 'expense',
        amt: 142000,
        merchant: 'Metro Card & Rapido Commute',
        date: `${currentYear}-${currentMonth}-06`,
        notes: 'Office commute for the week',
      },
      {
        id: `tx_7_${userId}`,
        acc: accCheckingId,
        cat: catMap['Investments & Savings'],
        type: 'expense',
        amt: 800000,
        merchant: 'Groww — Nifty 50 Index SIP',
        date: `${currentYear}-${currentMonth}-07`,
        notes: 'Monthly automated SIP',
      },
      {
        id: `tx_8_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Food & Dining'],
        type: 'expense',
        amt: 189000,
        merchant: 'Zomato & Third Wave Coffee',
        date: `${currentYear}-${currentMonth}-08`,
        notes: 'Weekend brunch & coffee catchup',
      },
      {
        id: `tx_9_${userId}`,
        acc: accCheckingId,
        toAcc: accCreditCardId,
        cat: null,
        type: 'transfer',
        amt: 500000,
        merchant: 'Credit Card Bill Payment',
        date: `${currentYear}-${currentMonth}-09`,
        notes: 'Transfer from HDFC Bank to ICICI Card (excluded from expenses)',
      },
      // Previous month baseline for trend comparisons
      {
        id: `tx_10_${userId}`,
        acc: accCheckingId,
        cat: catMap['Salary'],
        type: 'income',
        amt: 6800000,
        merchant: 'Monthly Salary Credit',
        date: `${prevYear}-${prevMonth}-01`,
        notes: 'Previous month salary',
      },
      {
        id: `tx_11_${userId}`,
        acc: accCheckingId,
        cat: catMap['Housing & Rent'],
        type: 'expense',
        amt: 1450000,
        merchant: 'Shared Flat Rent (UPI)',
        date: `${prevYear}-${prevMonth}-02`,
        notes: 'Previous month rent',
      },
      {
        id: `tx_12_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Food & Dining'],
        type: 'expense',
        amt: 310000,
        merchant: 'Swiggy & Dining Out',
        date: `${prevYear}-${prevMonth}-14`,
        notes: 'Previous month dining baseline',
      },
      {
        id: `tx_13_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Shopping & Essentials'],
        type: 'expense',
        amt: 420000,
        merchant: 'Myntra & Amazon Essentials',
        date: `${prevYear}-${prevMonth}-18`,
        notes: 'Work shirts and headphones',
      },
    ];

    for (const t of txs) {
      const isSplit = t.split && t.split.length > 0 ? 1 : 0;
      run(
        `INSERT INTO transactions (id, user_id, account_id, to_account_id, category_id, type, amount_minor, currency, merchant, date, notes, is_split, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          userId,
          t.acc,
          t.toAcc || null,
          t.cat || null,
          t.type,
          t.amt,
          t.merchant,
          t.date,
          t.notes || null,
          isSplit,
          nowIso,
          nowIso,
        ]
      );

      if (isSplit && t.split) {
        for (let i = 0; i < t.split.length; i++) {
          const s = t.split[i];
          run(
            `INSERT INTO transaction_splits (id, transaction_id, category_id, amount_minor, notes, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [`sp_${t.id}_${i}`, t.id, s.cat || null, s.amt, s.notes || null, nowIso]
          );
        }
      }
    }
  });

  return userId;
}
