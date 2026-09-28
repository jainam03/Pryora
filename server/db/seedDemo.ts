/**
 * PRYORA Demo Workspace Seeder
 * 
 * Seeds a full-fledged, realistic financial dataset for demo@pryora.app
 * with proper double-entry transactions, accounts, budgets, goals, and recurring rules.
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

  transaction(() => {
    // 1. Create Demo User
    run(
      `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Alex Chen', 'INR', 'en-IN', 'DD/MM/YYYY', 1, ?, ?)`,
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

    // HDFC Checking: Initial 1,45,000
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'HDFC Salary Checking', 'checking', 'INR', 14500000, 14500000, 'HDFC Bank', '#3B82F6', 'Landmark', 0, ?, ?)`,
      [accCheckingId, userId, nowIso, nowIso]
    );

    // ICICI Savings Reserve: Initial 3,20,000
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'ICICI Savings Reserve', 'savings', 'INR', 32000000, 32000000, 'ICICI Bank', '#10B981', 'PiggyBank', 0, ?, ?)`,
      [accSavingsId, userId, nowIso, nowIso]
    );

    // Coral Credit Card: Initial 24,500 owed, limit 1,50,000
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, credit_limit_minor, statement_day, due_day, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'ICICI Coral Credit Card', 'credit_card', 'INR', 2450000, 2450000, 15000000, 15, 5, 'ICICI Bank', '#F43F5E', 'CreditCard', 0, ?, ?)`,
      [accCreditCardId, userId, nowIso, nowIso]
    );

    // Cash Wallet: Initial 5,500
    run(
      `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, institution, color, icon, is_archived, created_at, updated_at)
       VALUES (?, ?, 'Cash Wallet', 'cash', 'INR', 550000, 550000, 'Cash', '#EAB308', 'Wallet', 0, ?, ?)`,
      [accCashId, userId, nowIso, nowIso]
    );

    // 4. Budgets
    if (catMap['Food & Dining']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 1500000, 'monthly', ?, ?)`,
        [`bg_1_${userId}`, userId, catMap['Food & Dining'], nowIso, nowIso]
      );
    }
    if (catMap['Shopping & Essentials']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 2000000, 'monthly', ?, ?)`,
        [`bg_2_${userId}`, userId, catMap['Shopping & Essentials'], nowIso, nowIso]
      );
    }
    if (catMap['Utilities & Bills']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 800000, 'monthly', ?, ?)`,
        [`bg_3_${userId}`, userId, catMap['Utilities & Bills'], nowIso, nowIso]
      );
    }
    if (catMap['Entertainment & Leisure']) {
      run(
        `INSERT INTO budgets (id, user_id, category_id, amount_minor, period, created_at, updated_at)
         VALUES (?, ?, ?, 600000, 'monthly', ?, ?)`,
        [`bg_4_${userId}`, userId, catMap['Entertainment & Leisure'], nowIso, nowIso]
      );
    }

    // 5. Recurring Rules / Subscriptions
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Netflix 4K UHD', 64900, 'monthly', ?, 1, 1, 'Entertainment streaming', ?, ?)`,
      [`rec_1_${userId}`, userId, accCreditCardId, catMap['Subscriptions'] || null, `${currentYear}-${currentMonth}-18`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Spotify Family', 17900, 'monthly', ?, 1, 1, 'Music streaming', ?, ?)`,
      [`rec_2_${userId}`, userId, accCreditCardId, catMap['Subscriptions'] || null, `${currentYear}-${currentMonth}-22`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Apartment Rent', 3200000, 'monthly', ?, 1, 0, 'Monthly lease', ?, ?)`,
      [`rec_3_${userId}`, userId, accCheckingId, catMap['Housing & Rent'] || null, `${currentYear}-${currentMonth}-01`, nowIso, nowIso]
    );
    run(
      `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'expense', 'Airtel Fiber Broadband', 99900, 'monthly', ?, 1, 1, 'Gigabit internet', ?, ?)`,
      [`rec_4_${userId}`, userId, accCheckingId, catMap['Utilities & Bills'] || null, `${currentYear}-${currentMonth}-12`, nowIso, nowIso]
    );

    // 6. Goals
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, '6-Month Emergency Fund', 30000000, 21000000, ?, 'emergency_fund', '#10B981', 'ShieldCheck', 0, ?, ?)`,
      [`goal_1_${userId}`, userId, `${currentYear}-12-31`, nowIso, nowIso]
    );
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, 'Tokyo & Kyoto Vacation', 18000000, 9500000, ?, 'vacation', '#3B82F6', 'Plane', 0, ?, ?)`,
      [`goal_2_${userId}`, userId, `${currentYear}-10-15`, nowIso, nowIso]
    );
    run(
      `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
       VALUES (?, ?, 'MacBook Pro M3 Reserve', 12000000, 7500000, ?, 'major_purchase', '#8B5CF6', 'Laptop', 0, ?, ?)`,
      [`goal_3_${userId}`, userId, `${currentYear}-11-30`, nowIso, nowIso]
    );

    // 7. Recent Transactions (Current month and previous month)
    const txs = [
      {
        id: `tx_1_${userId}`,
        acc: accCheckingId,
        cat: catMap['Salary'],
        type: 'income',
        amt: 12500000,
        merchant: 'Google Asia Pacific Salary',
        date: `${currentYear}-${currentMonth}-01`,
        notes: 'Monthly engineering compensation',
      },
      {
        id: `tx_2_${userId}`,
        acc: accCheckingId,
        cat: catMap['Housing & Rent'],
        type: 'expense',
        amt: 3200000,
        merchant: 'Apartment Rent Transfer',
        date: `${currentYear}-${currentMonth}-02`,
        notes: 'NEFT Transfer to landlord',
      },
      {
        id: `tx_3_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Food & Dining'],
        type: 'expense',
        amt: 345000,
        merchant: 'Trattoria Bella Roma',
        date: `${currentYear}-${currentMonth}-03`,
        notes: 'Weekend dinner with team',
      },
      {
        id: `tx_4_${userId}`,
        acc: accCheckingId,
        cat: catMap['Shopping & Essentials'],
        type: 'expense',
        amt: 520000,
        merchant: 'Nature Basket Supermarket',
        date: `${currentYear}-${currentMonth}-04`,
        notes: 'Weekly groceries & household consumables',
        split: [
          { cat: catMap['Food & Dining'], amt: 380000, notes: 'Fresh groceries & dairy' },
          { cat: catMap['Shopping & Essentials'], amt: 140000, notes: 'Eco cleaners & toiletries' },
        ],
      },
      {
        id: `tx_5_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Utilities & Bills'],
        type: 'expense',
        amt: 185000,
        merchant: 'State Electricity Board',
        date: `${currentYear}-${currentMonth}-05`,
        notes: 'Monthly power consumption',
      },
      {
        id: `tx_6_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Subscriptions'],
        type: 'expense',
        amt: 64900,
        merchant: 'Netflix 4K UHD',
        date: `${currentYear}-${currentMonth}-06`,
        notes: 'Family digital plan',
      },
      {
        id: `tx_7_${userId}`,
        acc: accCheckingId,
        toAcc: accCreditCardId,
        cat: null,
        type: 'transfer',
        amt: 1500000,
        merchant: 'Credit Card Bill Payment',
        date: `${currentYear}-${currentMonth}-07`,
        notes: 'Partial payment from checking to credit card (reduces debt liability)',
      },
      // Previous month records for trends
      {
        id: `tx_8_${userId}`,
        acc: accCheckingId,
        cat: catMap['Salary'],
        type: 'income',
        amt: 12500000,
        merchant: 'Google Asia Pacific Salary',
        date: `${prevYear}-${prevMonth}-01`,
        notes: 'Previous month salary',
      },
      {
        id: `tx_9_${userId}`,
        acc: accCheckingId,
        cat: catMap['Housing & Rent'],
        type: 'expense',
        amt: 3200000,
        merchant: 'Apartment Rent Transfer',
        date: `${prevYear}-${prevMonth}-02`,
        notes: 'Previous month lease',
      },
      {
        id: `tx_10_${userId}`,
        acc: accCreditCardId,
        cat: catMap['Shopping & Essentials'],
        type: 'expense',
        amt: 890000,
        merchant: 'IKEA Furnishing',
        date: `${prevYear}-${prevMonth}-15`,
        notes: 'Desk ergonomic chair and lamp',
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
