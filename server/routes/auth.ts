/**
 * PRYORA Auth API Routes
 *
 * Security controls:
 * - Rate-limited authentication endpoints
 * - PBKDF2-SHA512 salted password hashing with length bounds
 * - Cryptographic RS256 verification of Firebase ID tokens before session issuance
 * - No passwordless account takeover on quick-start
 * - Session revocation on logout & full account/data deletion endpoint
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  createSession,
  revokeSession,
  deleteUserSessions,
  verifyFirebaseIdToken,
  requireAuth,
  AuthenticatedRequest,
} from '../auth.js';
import {
  queryOne,
  run,
  transaction,
  seedDefaultCategories,
  deleteUserAccountData,
} from '../db/database.js';
import { ensureDemoWorkspace } from '../db/seedDemo.js';
import { toMinorUnits } from '../domain/money.js';
import { createRateLimiter } from '../middleware/security.js';

export const authRouter = Router();

const ALLOWED_CURRENCIES = new Set(['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY']);
const ALLOWED_LOCALES = new Set(['en-IN', 'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-SG', 'de-DE', 'fr-FR', 'ja-JP']);
const ALLOWED_DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function loadFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (typeof parsed.projectId === 'string') return parsed.projectId.trim();
    }
  } catch {
    // Fallback empty
  }
  return '';
}

const FIREBASE_PROJECT_ID = loadFirebaseProjectId();

// Rate limiters (relaxed slightly in test env unless overridden)
const isTestEnv = process.env.NODE_ENV === 'test';
const authAttemptLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 200 : 25,
  keyPrefix: 'auth_attempt',
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 200 : 15,
  keyPrefix: 'auth_register',
  message: 'Too many account creation requests. Please try again later.',
});

function sanitizeCurrency(val: unknown): string {
  if (typeof val === 'string' && ALLOWED_CURRENCIES.has(val.toUpperCase())) {
    return val.toUpperCase();
  }
  return 'INR';
}

function sanitizeLocale(val: unknown): string {
  if (typeof val === 'string' && ALLOWED_LOCALES.has(val)) {
    return val;
  }
  return 'en-IN';
}

function sanitizeDateFormat(val: unknown): string {
  if (typeof val === 'string' && ALLOWED_DATE_FORMATS.has(val)) {
    return val;
  }
  return 'DD/MM/YYYY';
}

// POST /api/auth/demo - Instant 1-click Demo Workspace access
authRouter.post('/demo', authAttemptLimiter, (_req, res) => {
  try {
    const userId = ensureDemoWorkspace();
    const token = createSession(userId, 7);
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
    console.error('Demo workspace access error:', err?.message || err);
    res.status(500).json({ error: 'Could not launch demo workspace.' });
  }
});

// POST /api/auth/quick-start - Create a brand-new guest workspace (NEVER signs into an existing email)
authRouter.post('/quick-start', registerLimiter, (req, res) => {
  try {
    const { email, displayName, currency } = req.body || {};
    const now = new Date().toISOString();
    const prefCurrency = sanitizeCurrency(currency);

    let userEmail: string;
    let name: string;

    if (email && typeof email === 'string' && email.trim()) {
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalized) || normalized.length > 254) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      // Security: Never allow passwordless sign-in into an existing account!
      const existing = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [normalized]);
      if (existing) {
        res.status(409).json({
          error: 'An account with this email already exists. Please sign in with your password or Google.',
          code: 'ACCOUNT_EXISTS',
        });
        return;
      }
      userEmail = normalized;
      name = (typeof displayName === 'string' && displayName.trim().slice(0, 80)) || userEmail.split('@')[0];
    } else {
      const randomSuffix = crypto.randomBytes(6).toString('hex');
      userEmail = `guest_${Date.now().toString(36)}_${randomSuffix}@pryora.local`;
      name = (typeof displayName === 'string' && displayName.trim().slice(0, 80)) || 'Guest User';
    }

    const userId = `usr_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    // Cryptographically strong random password for guest workspace
    const { salt, hash } = hashPassword(crypto.randomBytes(24).toString('hex'));

    transaction(() => {
      run(
        `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
        [userId, userEmail, hash, salt, name, prefCurrency, now, now]
      );

      seedDefaultCategories(userId);
    });

    const token = createSession(userId, 14);
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
    console.error('Quick-start error:', err?.message || err);
    res.status(500).json({ error: 'Could not initialize workspace.' });
  }
});

// POST /api/auth/register
authRouter.post('/register', registerLimiter, (req, res) => {
  try {
    const { email, password, displayName, currency } = req.body || {};

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim()) || email.trim().length > 254) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const passwordErr = validatePasswordStrength(password);
    if (passwordErr) {
      res.status(400).json({ error: passwordErr });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = queryOne('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    const userId = `usr_${crypto.randomBytes(6).toString('hex')}_${Date.now().toString(36)}`;
    const { salt, hash } = hashPassword(password);
    const now = new Date().toISOString();
    const prefCurrency = sanitizeCurrency(currency);
    const name =
      (typeof displayName === 'string' && displayName.trim().slice(0, 80)) ||
      normalizedEmail.split('@')[0];

    transaction(() => {
      run(
        `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
        [userId, normalizedEmail, hash, salt, name, prefCurrency, now, now]
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
      message: 'Account created successfully.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Registration error:', err?.message || err);
    res.status(500).json({ error: 'We could not complete your registration. Please try again.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', authAttemptLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
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
    const { password_hash: _ph, salt: _s, ...safeUser } = userWithCreds;

    res.json({
      message: 'Signed in successfully.',
      user: safeUser,
      token,
    });
  } catch (err: any) {
    console.error('Login error:', err?.message || err);
    res.status(500).json({ error: 'We encountered an error during sign in. Please try again.' });
  }
});

// POST /api/auth/firebase-login - Cryptographically verified Google Sign-In via Firebase ID token
authRouter.post('/firebase-login', authAttemptLimiter, async (req, res) => {
  try {
    const { idToken, currency } = req.body || {};

    if (!idToken || typeof idToken !== 'string') {
      res.status(401).json({
        error: 'A valid Google / Firebase authentication token is required.',
        code: 'INVALID_FIREBASE_TOKEN',
      });
      return;
    }

    if (!FIREBASE_PROJECT_ID) {
      res.status(503).json({ error: 'Google Sign-In is not configured on this server.' });
      return;
    }

    let claims;
    try {
      claims = await verifyFirebaseIdToken(idToken, FIREBASE_PROJECT_ID);
    } catch (verifyErr: any) {
      console.warn('Rejected unverified Firebase login attempt:', verifyErr?.message);
      res.status(401).json({
        error: 'Could not verify your Google Sign-In session. Please sign in again.',
        code: 'INVALID_FIREBASE_TOKEN',
      });
      return;
    }

    // Match by Firebase UID first; only link to an existing email account when email is verified by Google
    let existing = queryOne<any>('SELECT * FROM users WHERE id = ?', [claims.uid]);
    if (!existing && claims.emailVerified) {
      existing = queryOne<any>('SELECT * FROM users WHERE email = ?', [claims.email]);
    }

    let userId = claims.uid;
    const now = new Date().toISOString();

    if (!existing) {
      const name = (claims.name && claims.name.slice(0, 80)) || claims.email.split('@')[0];
      const prefCurrency = sanitizeCurrency(currency);

      transaction(() => {
        run(
          `INSERT INTO users (id, email, password_hash, salt, display_name, currency, locale, date_format, onboarding_completed, created_at, updated_at)
           VALUES (?, ?, 'firebase_managed', 'firebase_managed', ?, ?, 'en-IN', 'DD/MM/YYYY', 0, ?, ?)`,
          [claims.uid, claims.email, name, prefCurrency, now, now]
        );

        seedDefaultCategories(claims.uid);
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
      message: 'Signed in with Google successfully.',
      user,
      token,
    });
  } catch (err: any) {
    console.error('Firebase sign-in error:', err?.message || err);
    res.status(500).json({ error: 'Could not complete Google sign in.' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    if (req.token) {
      revokeSession(req.token);
    }
    res.json({ message: 'Signed out successfully.' });
  } catch {
    res.status(500).json({ error: 'Error signing out.' });
  }
});

// POST /api/auth/logout-all
authRouter.post('/logout-all', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    deleteUserSessions(req.user!.id);
    res.json({ message: 'Signed out from all devices.' });
  } catch {
    res.status(500).json({ error: 'Error signing out all sessions.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const { displayName, currency, locale, dateFormat } = req.body || {};
    const userId = req.user!.id;
    const now = new Date().toISOString();

    const safeName =
      typeof displayName === 'string' && displayName.trim()
        ? displayName.trim().slice(0, 80)
        : undefined;
    const safeCurrency = currency !== undefined ? sanitizeCurrency(currency) : undefined;
    const safeLocale = locale !== undefined ? sanitizeLocale(locale) : undefined;
    const safeDateFormat = dateFormat !== undefined ? sanitizeDateFormat(dateFormat) : undefined;

    run(
      `UPDATE users
       SET display_name = COALESCE(?, display_name),
           currency = COALESCE(?, currency),
           locale = COALESCE(?, locale),
           date_format = COALESCE(?, date_format),
           updated_at = ?
       WHERE id = ?`,
      [safeName, safeCurrency, safeLocale, safeDateFormat, now, userId]
    );

    const updated = queryOne(
      `SELECT id, email, display_name, currency, locale, date_format, onboarding_completed, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    res.json({ message: 'Profile updated successfully.', user: updated });
  } catch {
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, authAttemptLimiter, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    if (req.user!.email === 'demo@pryora.app') {
      res.status(403).json({ error: 'The shared demo account password cannot be changed.' });
      return;
    }

    const { currentPassword, newPassword } = req.body || {};
    const strengthErr = validatePasswordStrength(newPassword);
    if (strengthErr) {
      res.status(400).json({ error: strengthErr });
      return;
    }

    const record = queryOne<{ password_hash: string; salt: string }>(
      'SELECT password_hash, salt FROM users WHERE id = ?',
      [userId]
    );
    if (!record || record.password_hash === 'firebase_managed') {
      res.status(400).json({ error: 'Password changes are managed through your Google account.' });
      return;
    }

    if (!verifyPassword(currentPassword, record.salt, record.password_hash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    const now = new Date().toISOString();
    transaction(() => {
      run('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?', [
        hash,
        salt,
        now,
        userId,
      ]);
      // Invalidate other sessions while keeping current session active
      if (req.token) {
        run('DELETE FROM sessions WHERE user_id = ? AND token != ?', [userId, req.token]);
      }
    });

    res.json({ message: 'Password updated successfully.' });
  } catch {
    res.status(500).json({ error: 'Could not update password.' });
  }
});

// DELETE /api/auth/account - Permanently delete account & all associated financial records
authRouter.delete('/account', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    if (req.user!.email === 'demo@pryora.app') {
      res.status(403).json({
        error: 'The shared demo workspace cannot be deleted. You can clear transactions inside Data Hub instead.',
      });
      return;
    }

    deleteUserAccountData(userId);
    res.json({ message: 'Your account and all associated financial data have been permanently deleted.' });
  } catch (err: any) {
    console.error('Account deletion error:', err?.message || err);
    res.status(500).json({ error: 'Could not delete account. Please try again.' });
  }
});

// POST /api/auth/onboarding - Complete onboarding step
authRouter.post('/onboarding', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { profile, accounts, income, goals, currency } = req.body || {};
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const userCurrency = sanitizeCurrency(currency || profile?.currency || req.user!.currency);

    transaction(() => {
      // 1. Update user preferences
      if (profile) {
        const safeName =
          (typeof profile.displayName === 'string' && profile.displayName.trim().slice(0, 80)) ||
          (typeof profile.display_name === 'string' && profile.display_name.trim().slice(0, 80)) ||
          undefined;
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
            safeName,
            userCurrency,
            sanitizeLocale(profile.locale),
            sanitizeDateFormat(profile.dateFormat || profile.date_format),
            now,
            userId,
          ]
        );
      } else {
        run(`UPDATE users SET currency = ?, onboarding_completed = 1, updated_at = ? WHERE id = ?`, [
          userCurrency,
          now,
          userId,
        ]);
      }

      // 2. Create accounts
      let createdAccountsCount = 0;
      const allowedTypes = new Set(['checking', 'savings', 'cash', 'credit_card', 'investment', 'loan', 'digital_wallet']);
      if (Array.isArray(accounts) && accounts.length > 0) {
        for (const acc of accounts.slice(0, 15)) {
          if (!acc?.name || typeof acc.name !== 'string' || !acc.name.trim()) continue;
          const accId = `acc_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
          const rawBal =
            acc.initialBalance !== undefined
              ? acc.initialBalance
              : acc.balance !== undefined
                ? acc.balance
                : 0;
          const initialBalanceMinor = toMinorUnits(rawBal || 0, userCurrency);
          const creditLimitMinor = acc.creditLimit ? toMinorUnits(acc.creditLimit, userCurrency) : 0;
          const accType = allowedTypes.has(acc.type) ? acc.type : 'checking';

          run(
            `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor,
                                   institution, color, icon, credit_limit_minor, statement_day, due_day, minimum_payment_minor,
                                   is_archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
              accId,
              userId,
              acc.name.trim().slice(0, 80),
              accType,
              userCurrency,
              initialBalanceMinor,
              initialBalanceMinor,
              typeof acc.institution === 'string' ? acc.institution.trim().slice(0, 80) : '',
              acc.color || (accType === 'cash' ? '#EAB308' : accType === 'credit_card' ? '#F43F5E' : '#3B82F6'),
              acc.icon || (accType === 'cash' ? 'Wallet' : accType === 'credit_card' ? 'CreditCard' : 'Landmark'),
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
        const cashId = `acc_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
        const checkingId = `acc_${crypto.randomBytes(5).toString('hex')}_${(Date.now() + 1).toString(36)}`;

        run(
          `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor,
                                 institution, color, icon, is_archived, created_at, updated_at)
           VALUES (?, ?, 'Cash Wallet', 'cash', ?, 0, 0, 'Cash', '#EAB308', 'Wallet', 0, ?, ?)`,
          [cashId, userId, userCurrency, now, now]
        );

        run(
          `INSERT INTO accounts (id, user_id, name, type, currency, initial_balance_minor, current_balance_minor,
                                 institution, color, icon, is_archived, created_at, updated_at)
           VALUES (?, ?, 'Bank Account / UPI', 'checking', ?, 0, 0, 'Primary Bank', '#3B82F6', 'Landmark', 0, ?, ?)`,
          [checkingId, userId, userCurrency, now, now]
        );
      }

      // 3. Optional income rule if explicitly provided
      if (income && income.amount && income.name) {
        const incomeAmountMinor = toMinorUnits(income.amount, userCurrency);
        const primaryAcc = queryOne<{ id: string }>('SELECT id FROM accounts WHERE user_id = ? LIMIT 1', [userId]);
        const primaryCat = queryOne<{ id: string }>(
          `SELECT id FROM categories WHERE user_id = ? AND type = 'income' LIMIT 1`,
          [userId]
        );

        if (primaryAcc && incomeAmountMinor > 0) {
          const ruleId = `rec_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
          run(
            `INSERT INTO recurring_rules (id, user_id, account_id, category_id, type, merchant, amount_minor, frequency, next_expected_date, is_active, is_subscription, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'income', ?, ?, ?, ?, 1, 0, 'Configured during onboarding', ?, ?)`,
            [
              ruleId,
              userId,
              primaryAcc.id,
              primaryCat ? primaryCat.id : null,
              String(income.name).trim().slice(0, 100),
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
        for (const g of goals.slice(0, 10)) {
          if (!g?.name?.trim() || !g.targetAmount) continue;
          const goalId = `goal_${crypto.randomBytes(5).toString('hex')}_${Date.now().toString(36)}`;
          const targetMinor = toMinorUnits(g.targetAmount, userCurrency);
          const currentMinor = g.currentAmount ? toMinorUnits(g.currentAmount, userCurrency) : 0;

          if (targetMinor <= 0) continue;

          run(
            `INSERT INTO goals (id, user_id, name, target_amount_minor, current_amount_minor, target_date, category, color, icon, is_completed, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            [
              goalId,
              userId,
              g.name.trim().slice(0, 100),
              targetMinor,
              Math.max(0, currentMinor),
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
    console.error('Onboarding error:', err?.message || err);
    res.status(500).json({ error: 'Could not complete onboarding. Your data is safe; please retry.' });
  }
});
