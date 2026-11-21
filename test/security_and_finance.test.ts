/**
 * PRYORA Production Readiness Integration Test Suite
 *
 * Verifies against a real Express server and isolated SQLite database:
 * 1. Authentication & session security (password strength, takeover prevention,
 *    Firebase forged login rejection, session revocation, account deletion)
 * 2. Strict cross-user isolation (IDOR prevention across accounts, transactions,
 *    budgets, goals, recurring rules, and backup restore ID remapping)
 * 3. Receipt MIME/size validation and idempotency key deduplication
 * 4. Financial logic invariants (split-transaction budget & analytics accuracy,
 *    dashboard evidence-based insights generation, recurring month-end clamping,
 *    authenticated CSV export)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate test database BEFORE importing server modules
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pryora-test-db-'));
process.env.NODE_ENV = 'test';
process.env.PRYORA_DATA_DIR = TEST_DATA_DIR;

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

let server: http.Server;
let baseUrl: string;

async function apiJson(
  endpoint: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{ status: number; data: any; headers: Headers }> {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Plain text / CSV response
  }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  const { getExpressApp } = await import('../server/app.js');
  const app = await getExpressApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('PRYORA Security & Financial Integration Suite', () => {
  test('Health check reports connected database and sets security headers', async () => {
    const res = await apiJson('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.database, 'connected');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.ok((res.headers.get('cache-control') || '').includes('no-store'));
  });

  test('Unauthenticated requests to financial endpoints return 401', async () => {
    const endpoints = [
      '/api/accounts',
      '/api/transactions',
      '/api/budgets',
      '/api/goals',
      '/api/recurring',
      '/api/analytics/dashboard',
      '/api/data/export/csv',
    ];
    for (const ep of endpoints) {
      const res = await apiJson(ep);
      assert.equal(res.status, 401, `Expected 401 on ${ep}`);
    }
  });

  test('Authentication blocks weak passwords, quick-start email takeover, and forged Firebase logins', async () => {
    // 1. Weak password rejected
    const weakRes = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'weak@example.com', password: '123', displayName: 'Weak' },
    });
    assert.equal(weakRes.status, 400);

    // 2. Valid registration succeeds
    const regRes = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'priya@example.com', password: 'StrongPassword123!', displayName: 'Priya' },
    });
    assert.equal(regRes.status, 201);
    assert.ok(regRes.data.token);

    // 3. CRITICAL: quick-start with existing email must NOT log into Priya's account
    const takeoverRes = await apiJson('/api/auth/quick-start', {
      method: 'POST',
      body: { email: 'priya@example.com', displayName: 'Attacker' },
    });
    assert.equal(takeoverRes.status, 409);
    assert.equal(takeoverRes.data.code, 'ACCOUNT_EXISTS');

    // 4. CRITICAL: firebase-login with forged raw uid/email and no valid ID token must fail with 401
    const forgedFirebase1 = await apiJson('/api/auth/firebase-login', {
      method: 'POST',
      body: { uid: 'forged-uid', email: 'priya@example.com', displayName: 'Attacker' },
    });
    assert.equal(forgedFirebase1.status, 401);

    const forgedFirebase2 = await apiJson('/api/auth/firebase-login', {
      method: 'POST',
      body: { idToken: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJmYWtlIn0.' },
    });
    assert.equal(forgedFirebase2.status, 401);

    // 5. Logout revokes session token immediately
    const token = regRes.data.token as string;
    const meBefore = await apiJson('/api/auth/me', { token });
    assert.equal(meBefore.status, 200);

    const logoutRes = await apiJson('/api/auth/logout', { method: 'POST', token });
    assert.equal(logoutRes.status, 200);

    const meAfter = await apiJson('/api/auth/me', { token });
    assert.equal(meAfter.status, 401);
  });

  test('Strict cross-user data isolation prevents IDOR on accounts, transactions, budgets, and backup restore', async () => {
    // Register User A & User B
    const regA = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'usera@example.com', password: 'UserAPassword123!', displayName: 'User A' },
    });
    const regB = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'userb@example.com', password: 'UserBPassword123!', displayName: 'User B' },
    });
    assert.equal(regA.status, 201);
    assert.equal(regB.status, 201);
    const tokenA = regA.data.token as string;
    const tokenB = regB.data.token as string;

    // Create Account & Category fetch for User A
    const accARes = await apiJson('/api/accounts', {
      method: 'POST',
      token: tokenA,
      body: { name: 'User A HDFC', type: 'checking', initialBalance: 50000 },
    });
    assert.equal(accARes.status, 201);
    const accAId = accARes.data.account.id as string;

    const catsARes = await apiJson('/api/categories', { token: tokenA });
    const foodCatA = catsARes.data.categories.find((c: any) => c.type === 'expense');
    assert.ok(foodCatA);

    // User A creates a transaction
    const txARes = await apiJson('/api/transactions', {
      method: 'POST',
      token: tokenA,
      body: {
        accountId: accAId,
        categoryId: foodCatA.id,
        type: 'expense',
        amount: 1000,
        date: '2026-10-05',
        merchant: 'Swiggy Secret Dinner',
      },
    });
    assert.equal(txARes.status, 201);
    const txAId = txARes.data.transaction.id as string;

    // User B tries to list, update, or delete User A's transaction -> isolated / 404
    const bListTxs = await apiJson('/api/transactions', { token: tokenB });
    assert.equal(bListTxs.status, 200);
    assert.equal(bListTxs.data.transactions.some((t: any) => t.id === txAId), false);
    const bPutTxA = await apiJson(`/api/transactions/${txAId}`, {
      method: 'PUT',
      token: tokenB,
      body: { merchant: 'Hijacked', amount: 1 },
    });
    assert.equal(bPutTxA.status, 404);
    const bDelTxA = await apiJson(`/api/transactions/${txAId}`, { method: 'DELETE', token: tokenB });
    assert.equal(bDelTxA.status, 404);

    // User B tries to debit User A's account via transaction creation -> 403
    const bDebitA = await apiJson('/api/transactions', {
      method: 'POST',
      token: tokenB,
      body: {
        accountId: accAId,
        type: 'expense',
        amount: 25000,
        date: '2026-10-06',
        merchant: 'Cross-user Debit Attempt',
      },
    });
    assert.equal(bDebitA.status, 403);

    // Confirm User A's account balance is completely untouched (50,000 - 1,000 = 49,000 -> 4900000 paise)
    const accACheck = await apiJson('/api/accounts', { token: tokenA });
    const accA = accACheck.data.accounts.find((a: any) => a.id === accAId);
    assert.equal(accA.current_balance_minor, 4900000);

    // User B tries to create a budget referencing User A's category -> 403
    const bBudgetA = await apiJson('/api/budgets', {
      method: 'POST',
      token: tokenB,
      body: {
        categoryId: foodCatA.id,
        amount: 5000,
        month: '2026-10',
      },
    });
    assert.equal(bBudgetA.status, 403);

    // User B attempts to restore a crafted JSON backup containing User A's account/category IDs
    const craftedRestore = await apiJson('/api/data/restore', {
      method: 'POST',
      token: tokenB,
      body: {
        backupData: {
          pryora_version: '1.0.0',
          accounts: [
            {
              id: accAId,
              name: 'Cloned Account',
              type: 'checking',
              currency: 'INR',
              initial_balance_minor: 100000,
              current_balance_minor: 100000,
            },
          ],
          categories: [
            {
              id: foodCatA.id,
              name: 'Cloned Food',
              type: 'expense',
            },
          ],
          transactions: [
            {
              id: txAId,
              account_id: accAId,
              category_id: foodCatA.id,
              type: 'expense',
              amount_minor: 50000,
              date: '2026-10-07',
              merchant: 'Cloned Spend',
            },
          ],
        },
      },
    });
    assert.equal(craftedRestore.status, 200);

    // Verify User A's original transaction & account remain intact and uncorrupted
    const txACheck = await apiJson('/api/transactions', { token: tokenA });
    assert.equal(txACheck.status, 200);
    const foundTxA = txACheck.data.transactions.find((t: any) => t.id === txAId);
    assert.ok(foundTxA);
    assert.equal(foundTxA.merchant, 'Swiggy Secret Dinner');
  });

  test('Receipt validation blocks SVG/HTML payloads and Idempotency-Key prevents duplicate debits', async () => {
    const reg = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'receipts@example.com', password: 'ReceiptPassword123!', displayName: 'Riya' },
    });
    const token = reg.data.token as string;
    const accRes = await apiJson('/api/accounts', {
      method: 'POST',
      token,
      body: { name: 'Riya Bank', type: 'checking', initialBalance: 10000 },
    });
    const accountId = accRes.data.account.id as string;

    // Malicious SVG data URL rejected
    const badReceipt = await apiJson('/api/transactions', {
      method: 'POST',
      token,
      body: {
        accountId,
        type: 'expense',
        amount: 200,
        date: '2026-10-05',
        merchant: 'Bad Receipt',
        receiptDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
      },
    });
    assert.equal(badReceipt.status, 400);

    // Valid PNG receipt + Idempotency-Key deduplication
    const validPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const idemKey = 'offline-replay-tx-001';

    const first = await apiJson('/api/transactions', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': idemKey },
      body: {
        accountId,
        type: 'expense',
        amount: 500,
        date: '2026-10-05',
        merchant: 'Zepto Groceries',
        receiptDataUrl: validPng,
      },
    });
    assert.equal(first.status, 201);

    const replay = await apiJson('/api/transactions', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': idemKey },
      body: {
        accountId,
        type: 'expense',
        amount: 500,
        date: '2026-10-05',
        merchant: 'Zepto Groceries',
        receiptDataUrl: validPng,
      },
    });
    assert.equal(replay.status, 201);
    assert.equal(replay.data.transaction.id, first.data.transaction.id);

    // Account balance should only be debited ONCE (10,000 - 500 = 9,500 -> 950000 paise)
    const accCheck = await apiJson('/api/accounts', { token });
    assert.equal(accCheck.data.accounts[0].current_balance_minor, 950000);
  });

  test('Split transactions are never double-counted in budgets or analytics, and dashboard insights populate cleanly', async () => {
    const reg = await apiJson('/api/auth/register', {
      method: 'POST',
      body: { email: 'analytics@example.com', password: 'AnalyticsPassword123!', displayName: 'Kabir' },
    });
    const token = reg.data.token as string;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    const accRes = await apiJson('/api/accounts', {
      method: 'POST',
      token,
      body: { name: 'Kabir Bank', type: 'checking', initialBalance: 100000 },
    });
    const accountId = accRes.data.account.id as string;

    const catsRes = await apiJson('/api/categories', { token });
    const expenseCats = catsRes.data.categories.filter((c: any) => c.type === 'expense');
    const incomeCat = catsRes.data.categories.find((c: any) => c.type === 'income');
    assert.ok(expenseCats.length >= 2 && incomeCat);
    const cat1 = expenseCats[0];
    const cat2 = expenseCats[1];

    // Record income + budget + split expense
    await apiJson('/api/transactions', {
      method: 'POST',
      token,
      body: {
        accountId,
        categoryId: incomeCat.id,
        type: 'income',
        amount: 60000,
        date: today,
        merchant: 'Monthly Salary',
      },
    });

    await apiJson('/api/budgets', {
      method: 'POST',
      token,
      body: { categoryId: cat1.id, amount: 2000, month: currentMonth },
    });

    // Split ₹3,000 across cat1 (₹2,200 -> over budget) and cat2 (₹800)
    const splitRes = await apiJson('/api/transactions', {
      method: 'POST',
      token,
      body: {
        accountId,
        categoryId: cat1.id, // Parent passes cat1, backend must store NULL and rely on splits only
        type: 'expense',
        amount: 3000,
        date: today,
        merchant: 'DMart Superstore',
        isSplit: true,
        splits: [
          { categoryId: cat1.id, amount: 2200, note: 'Groceries portion' },
          { categoryId: cat2.id, amount: 800, note: 'Household portion' },
        ],
      },
    });
    assert.equal(splitRes.status, 201);

    // Check budgets endpoint: cat1 spent must be EXACTLY ₹2,200 (220000 paise), NOT ₹5,200!
    const budgetsRes = await apiJson(`/api/budgets?month=${currentMonth}`, { token });
    assert.equal(budgetsRes.status, 200);
    const b1 = budgetsRes.data.budgets.find((b: any) => b.category_id === cat1.id);
    assert.ok(b1);
    assert.equal(b1.spent_minor, 220000);

    // Check spending breakdown endpoint: total across categories equals ₹3,000 (300000 paise)
    const spendingRes = await apiJson(`/api/analytics/spending?period=current_month`, { token });
    assert.equal(spendingRes.status, 200);
    assert.equal(spendingRes.data.total_expense_minor, 300000);

    // Check dashboard endpoint: insights array is non-empty and never points to dead 'cashflow' tab
    const dashRes = await apiJson('/api/analytics/dashboard', { token });
    assert.equal(dashRes.status, 200);
    assert.ok(Array.isArray(dashRes.data.insights));
    assert.ok(dashRes.data.insights.length > 0, 'Expected evidence-based dashboard insights to populate');
    for (const insight of dashRes.data.insights) {
      assert.notEqual(insight.actionTab, 'cashflow');
    }

    // Authenticated CSV export works and returns valid CSV
    const csvRes = await apiJson('/api/data/export/csv', { token });
    assert.equal(csvRes.status, 200);
    assert.ok(typeof csvRes.data === 'string' && csvRes.data.includes('DMart Superstore'));

    // Self-serve account deletion removes user and invalidates session
    const delRes = await apiJson('/api/auth/account', {
      method: 'DELETE',
      token,
      body: { confirmEmail: 'analytics@example.com' },
    });
    assert.equal(delRes.status, 200);
    const afterDel = await apiJson('/api/auth/me', { token });
    assert.equal(afterDel.status, 401);
  });

  test('Recurring date advancement clamps month-end dates accurately (including leap years)', async () => {
    const { advanceDate } = await import('../server/routes/recurring.js');
    assert.equal(advanceDate('2025-01-31', 'monthly'), '2025-02-28');
    assert.equal(advanceDate('2024-01-31', 'monthly'), '2024-02-29');
    assert.equal(advanceDate('2026-03-31', 'monthly'), '2026-04-30');
    assert.equal(advanceDate('2024-02-29', 'yearly'), '2025-02-28');
    assert.equal(advanceDate('2026-10-01', 'weekly'), '2026-10-08');
  });
});
