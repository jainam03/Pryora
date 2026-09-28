/**
 * PRYORA Relational Database Management Layer
 * 
 * Implemented with WebAssembly SQLite (sql.js) persisted directly to disk (data/pryora.db).
 * Features:
 * - Foreign key constraints enabled
 * - ACID transactions
 * - Typed parameters
 * - Automatic disk synchronization
 * - Schema migrations
 * - JSON and binary backup/restore
 */

import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

let dbInstance: SqlJsDatabase | null = null;
let inTransaction = false;
const isVercel = Boolean(process.env.VERCEL);
const SOURCE_DB_FILE = path.join(process.cwd(), 'data', 'pryora.db');
const DATA_DIR = isVercel ? path.join('/tmp', 'pryora-data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pryora.db');

export async function initDatabase(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('Could not create data directory, falling back to memory/tmp:', e);
    }
  }

  // If in Vercel environment and seed DB exists, copy into /tmp
  if (isVercel && fs.existsSync(SOURCE_DB_FILE) && !fs.existsSync(DB_FILE)) {
    try {
      fs.copyFileSync(SOURCE_DB_FILE, DB_FILE);
    } catch (e) {
      console.warn('Could not copy seed database to /tmp:', e);
    }
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Failed to load existing database file, creating fresh:', err);
      dbInstance = new SQL.Database();
    }
  } else if (fs.existsSync(SOURCE_DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(SOURCE_DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enforce foreign key constraints
  dbInstance.run('PRAGMA foreign_keys = ON;');
  dbInstance.run('PRAGMA journal_mode = MEMORY;');

  // Run migrations
  runMigrations(dbInstance);

  // Save initialized DB
  persistDb();

  return dbInstance;
}

export function getDb(): SqlJsDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return dbInstance;
}

export function persistDb(): void {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist database to disk:', err);
  }
}

function runMigrations(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      display_name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      locale TEXT NOT NULL DEFAULT 'en-IN',
      date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      initial_balance_minor INTEGER NOT NULL DEFAULT 0,
      current_balance_minor INTEGER NOT NULL DEFAULT 0,
      institution TEXT,
      color TEXT,
      icon TEXT,
      credit_limit_minor INTEGER DEFAULT 0,
      statement_day INTEGER,
      due_day INTEGER,
      minimum_payment_minor INTEGER DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      merchant TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      next_expected_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_subscription INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
      to_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      merchant TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      tags TEXT,
      receipt_url TEXT,
      recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
      is_split INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_splits (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      amount_minor INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      amount_minor INTEGER NOT NULL,
      period TEXT NOT NULL DEFAULT 'monthly',
      month TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_amount_minor INTEGER NOT NULL,
      current_amount_minor INTEGER NOT NULL DEFAULT 0,
      target_date TEXT,
      category TEXT,
      color TEXT,
      icon TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_minor INTEGER NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    -- Create indexes for speed and integrity
    CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
    CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_rules(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
}

/**
 * Executes a parameterized SQL query and returns an array of objects.
 */
export function query<T = any>(sql: string, params: (string | number | null | undefined)[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params.map(p => (p === undefined ? null : p)));
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Executes a query and returns the first row or null.
 */
export function queryOne<T = any>(sql: string, params: (string | number | null | undefined)[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Executes an INSERT / UPDATE / DELETE statement.
 */
export function run(sql: string, params: (string | number | null | undefined)[] = []): void {
  const db = getDb();
  db.run(sql, params.map(p => (p === undefined ? null : p)));
  if (!inTransaction) {
    persistDb();
  }
}

/**
 * Executes a block inside an ACID transaction.
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  if (inTransaction) {
    return fn();
  }
  inTransaction = true;
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    inTransaction = false;
    persistDb();
    return result;
  } catch (err) {
    try {
      db.run('ROLLBACK;');
    } catch {
      // Transaction may have already been aborted/rolled back
    }
    inTransaction = false;
    console.error('Transaction execution failure:', err);
    throw err;
  }
}

/**
 * Seeds default categories for a new user.
 */
export function seedDefaultCategories(userId: string): void {
  const defaults = [
    { name: 'Food & Dining', type: 'expense', icon: 'Utensils', color: '#F97316' },
    { name: 'Housing & Rent', type: 'expense', icon: 'Home', color: '#3B82F6' },
    { name: 'Utilities & Bills', type: 'expense', icon: 'Zap', color: '#EAB308' },
    { name: 'Transportation', type: 'expense', icon: 'Car', color: '#6366F1' },
    { name: 'Shopping & Essentials', type: 'expense', icon: 'ShoppingBag', color: '#EC4899' },
    { name: 'Entertainment & Leisure', type: 'expense', icon: 'Film', color: '#8B5CF6' },
    { name: 'Health & Medical', type: 'expense', icon: 'HeartPulse', color: '#EF4444' },
    { name: 'Personal & Care', type: 'expense', icon: 'Smile', color: '#14B8A6' },
    { name: 'Subscriptions', type: 'expense', icon: 'RotateCw', color: '#06B6D4' },
    { name: 'Travel & Holidays', type: 'expense', icon: 'Plane', color: '#F59E0B' },
    { name: 'Education & Learning', type: 'expense', icon: 'GraduationCap', color: '#10B981' },
    { name: 'Investments & Savings', type: 'expense', icon: 'TrendingUp', color: '#84CC16' },
    { name: 'Other Expense', type: 'expense', icon: 'MoreHorizontal', color: '#64748B' },
    // Income
    { name: 'Salary', type: 'income', icon: 'Briefcase', color: '#10B981' },
    { name: 'Freelance & Consulting', type: 'income', icon: 'Laptop', color: '#06B6D4' },
    { name: 'Investments & Dividends', type: 'income', icon: 'TrendingUp', color: '#8B5CF6' },
    { name: 'Business Income', type: 'income', icon: 'Building2', color: '#3B82F6' },
    { name: 'Refunds & Reimbursements', type: 'income', icon: 'RotateCcw', color: '#F97316' },
    { name: 'Other Income', type: 'income', icon: 'DollarSign', color: '#64748B' },
  ];

  const now = new Date().toISOString();
  for (const cat of defaults) {
    const id = `cat_${Math.random().toString(36).substring(2, 11)}_${Date.now().toString(36)}`;
    run(
      `INSERT INTO categories (id, user_id, name, type, icon, color, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, cat.name, cat.type, cat.icon, cat.color, now]
    );
  }
}
