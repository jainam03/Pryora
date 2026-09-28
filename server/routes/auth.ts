/**
 * PRYORA Auth API Routes
 */

import { Router } from 'express';
import { hashPassword, verifyPassword, createSession, requireAuth, AuthenticatedRequest } from '../auth.js';
import { queryOne, run, transaction, seedDefaultCategories } from '../db/database.js';
import { ensureDemoWorkspace } from '../db/seedDemo.js';
import { toMinorUnits } from '../domain/money.js';

export const authRouter = Router();

// POST /api/auth/demo - Instant 1-click Demo Workspace access
authRouter.post('/demo', (req, res) => {
  try {
    const userId = ensureDemoWorkspace();
    const token = createSession(userId);
    const user = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      message: 'Demo workspace ready.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Demo workspace access error:', err);
    res.status(500).json({ error: 'Could not launch demo workspace.' });
  }
});

// POST /api/auth/quick-start - Frictionless, silent account creation
authRouter.post('/quick-start', (req, res) => {
  try {
    const { email, displayName, currency } = req.body;
    const now = new Date().toISOString();
    const prefCurrency = currency || 'INR';

    let userEmail: string;
    let name: string;

    if (email && typeof email === 'string' && email.includes('@')) {
      userEmail = email.trim().toLowerCase();
      name = displayName?.trim() || userEmail.split('@')[0];
    } else {
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      userEmail = `user_${Date.now().toString(36)}_${randomSuffix}@pryora.local`;
      name = displayName?.trim() || 'Workspace Owner';
    }

    // Check if user already exists
    const existing = queryOne<any>('SELECT * FROM users WHERE email = ?', [userEmail]);
    if (existing) {
      const token = createSession(existing.id);
      const { password_hash, salt, ...safeUser } = existing;
      res.json({
        message: 'Signed in successfully.',
        user: safeUser,
        token,
      });
      return;
    }

    const userId = `usr_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const { salt, hash } = hashPassword(Math.random().toString(36).substring(2, 12));

    transaction(() => {
      run(
        `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
        [userId, userEmail, hash, salt, name, prefCurrency, now, now]
      );

      seedDefaultCategories(userId);
    });

    const token = createSession(userId);
    const user = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.status(201).json({
      message: 'Workspace initialized.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Quick-start error:', err);
    res.status(500).json({ error: 'Could not initialize workspace.' });
  }
});

// POST /api/auth/register
authRouter.post('/register', (req, res) => {
  try {
    const { email, password, displayName, currency } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    const userId = `usr_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();
    const prefCurrency = currency || 'INR';
    const name = displayName?.trim() || normalizedEmail.split('@')[0];

    transaction(() => {
      run(
        `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
        [userId, normalizedEmail, hash, salt, name, prefCurrency, now, now]
      );

      // Seed standard categories for new user
      seedDefaultCategories(userId);
    });

    const token = createSession(userId);
    const user = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.status(201).json({
      message: 'Account created successfully.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'We could not complete your registration. Please try again.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === 'demo@pryora.app') {
      ensureDemoWorkspace();
    }

    const userWithCreds = queryOne<{
      id: string;
      email: string;
      password_hash: string;
      salt: string;
      display_name: string;
      currency: string;
      locale: string;
      date_format: string;
      onboarding_completed: number;
      created_at: string;
    }>('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!userWithCreds) {
      res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
      return;
    }

    const isValid = verifyPassword(password, userWithCreds.salt, userWithCreds.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password. Please verify your credentials.' });
      return;
    }

    const token = createSession(userWithCreds.id);

    const { password_hash, salt, ...safeUser } = userWithCreds;

    res.json({
      message: 'Signed in successfully.',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'We encountered an error during sign in. Please try again.' });
  }
});

// POST /api/auth/firebase-login - Sync Firebase authenticated users (Google Login)
authRouter.post('/firebase-login', (req, res) => {
  try {
    const { uid, email, displayName, currency } = req.body;

    if (!uid || !email) {
      res.status(400).json({ error: 'UID and email are required.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = queryOne<any>('SELECT * FROM users WHERE id = ? OR email = ?', [uid, normalizedEmail]);

    let userId = uid;
    const now = new Date().toISOString();

    if (!existing) {
      // Create user record for Firebase user
      const name = displayName?.trim() || normalizedEmail.split('@')[0];
      const prefCurrency = currency || 'INR';

      transaction(() => {
        run(
          `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
           VALUES (?, ?, 'firebase_managed', 'firebase_managed', ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
          [uid, normalizedEmail, name, prefCurrency, now, now]
        );

        seedDefaultCategories(uid);
      });
    } else {
      userId = existing.id;
    }

    const token = createSession(userId);
    const user = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      message: 'Signed in with Firebase successfully.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Firebase sign-in error:', err);
    res.status(500).json({ error: 'Could not complete Firebase sign in.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.token) {
      run('DELETE FROM sessions WHERE token = ?', [req.token]);
    }
    res.json({ message: 'Signed out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Error signing out.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { displayName, currency, locale, dateFormat } = req.body;
    const userId = req.user!.id;
    const now = new Date().toISOString();

    run(
      `UPDATE users 
       SET display_name = COALESCE(?, display_name),
           currency = COALESCE(?, currency),
           locale = COALESCE(?, locale),
           date_format = COALESCE(?, date_format),
           updated_at = ?
       WHERE id = ?`,
      [displayName?.trim(), currency, locale, dateFormat, now, userId]
    );

    const updated = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({ message: 'Profile updated successfully.', user: updated });
  } catch (err) {
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// POST /api/auth/onboarding - Complete onboarding step
authRouter.post('/onboarding', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { profile, accounts, income, goals, currency } = req.body;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const userCurrency = currency || profile?.currency || req.user!.currency || 'INR';

    transaction(() => {
      // 1. Update user preferences
      if (profile) {
        run(
          `UPDATE users 
           SET display_name = COALESCE(?, display_name),
               currency = COALESCE(?, currency),
               locale = COALESCE(?, locale),
               date_format = COALESCE(?, date_format),
               onboarding_completed = 1,
               updated_at = ?
           WHERE id = ?`,
          [
            profile.displayName?.trim() || profile.display_name?.trim(),
            userCurrency,
            profile.locale || 'en-IN',
            profile.dateFormat || profile.date_format || 'DD/MM/YYYY',
            now,
            userId,
          ]
        );
      } else {
        run(`UPDATE users SET currency = ?, onboarding_completed = 1, updated_at = ? WHERE id = ?`, [userCurrency, now, userId]);
      }

      // 2. Create accounts
      let createdAccountsCount = 0;
      if (Array.isArray(accounts) && accounts.length > 0) {
        for (const acc of accounts) {
          if (!acc.name?.trim()) continue;
          const accId = `acc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
          const rawBal = acc.initialBalance !== undefined ? acc.initialBalance : (acc.balance !== undefined ? acc.balance : 0);
          const initialBalanceMinor = toMinorUnits(rawBal || 0, userCurrency);
          const creditLimitMinor = acc.creditLimit ? toMinorUnits(acc.creditLimit, userCurrency) : 0;

          run(
            `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, 
                                   institution, color, icon, credit_limit_minor, statement_day, due_day, minimum_payment_minor, 
                                   is_archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
              accId,
              userId,
              acc.name.trim(),
              acc.type || 'checking',
              userCurrency,
              initialBalanceMinor,
              initialBalanceMinor,
              acc.institution || '',
              acc.color || (acc.type === 'cash' ? '#EAB308' : acc.type === 'credit_card' ? '#F43F5E' : '#3B82F6'),
              acc.icon || (acc.type === 'cash' ? 'Wallet' : acc.type === 'credit_card' ? 'CreditCard' : 'Landmark'),
              creditLimitMinor,
              acc.statementDay || null,
              acc.dueDay || null,
              acc.minimumPaymentMinor || 0,
              now,
              now,
            ]
          );
          createdAccountsCount++;
        }
      }

      // If user had no accounts created and has none in database, create clean starter accounts
      const existingAccounts = queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM accounts WHERE user_id = ? AND is_archived = 0',
        [userId]
      );

      if ((!existingAccounts || existingAccounts.count === 0) && createdAccountsCount === 0) {
        const cashId = `acc_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
        const checkingId = `acc_${Math.random().toString(36).substring(2, 11)}_${(Date.now() + 1).toString(36)}`;

        run(
          `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, 
                                 institution, color, icon, is_archived, created_at, updated_at)
           VALUES (?, ?, 'Cash Wallet', 'cash', ?, 0, 0, 'Cash', '#EAB308', 'Wallet', 0, ?, ?)`,
          [cashId, userId, userCurrency, now, now]
        );

        run(
          `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor, 
                                 institution, color, icon, is_archived, created_at, updated_at)
           VALUES (?, ?, 'Primary Checking', 'checking', ?, 0, 0, 'Bank', '#3B82F6', 'Landmark', 0, ?, ?)`,
          [checkingId, userId, userCurrency, now, now]
        );
      }

      // 3. Optional income rule if explicitly provided
      if (income && income.amount && income.name) {
        const incomeAmountMinor = toMinorUnits(income.amount, userCurrency);
        const primaryAcc = queryOne<{ id: string }>('SELECT id FROM accounts WHERE user_id = ? LIMIT 1', [userId]);
        const primaryCat = queryOne<{ id: string }>('SELECT id FROM categories WHERE user_id = ? AND type = "income" LIMIT 1', [userId]);

        if (primaryAcc && incomeAmountMinor > 0) {
          const ruleId = `rec_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
          run(
            `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'income', ?, ?, ?, ?, 1, 0, 'Configured during onboarding', ?, ?)`,
            [
              ruleId,
              userId,
              primaryAcc.id,
              primaryCat ? primaryCat.id : null,
              income.name.trim(),
              incomeAmountMinor,
              income.frequency || 'monthly',
              income.expectedDate || today,
              now,
              now,
            ]
          );
        }
      }

      // 4. Optional initial goals if explicitly provided
      if (Array.isArray(goals) && goals.length > 0) {
        for (const g of goals) {
          if (!g.name?.trim() || !g.targetAmount) continue;
          const goalId = `goal_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
          const targetMinor = toMinorUnits(g.targetAmount, userCurrency);
          const currentMinor = g.currentAmount ? toMinorUnits(g.currentAmount, userCurrency) : 0;

          run(
            `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
              goalId,
              userId,
              g.name.trim(),
              targetMinor,
              currentMinor,
              g.targetDate || null,
              g.category || 'emergency_fund',
              g.color || '#10B981',
              g.icon || 'Target',
              now,
              now,
            ]
          );
        }
      }
    });

    const updatedUser = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({
      message: 'Onboarding completed successfully. Welcome to PRYORA!',
      user: updatedUser,
    });
  } catch (err: any) {
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Could not complete onboarding. Your data is safe; please retry.' });
  }
});
