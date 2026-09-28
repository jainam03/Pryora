/**
 * PRYORA Shared Express Application Definition
 * 
 * Used by:
 * - server.ts (Local development & node server)
 * - api/index.ts (Vercel serverless function entry point)
 */

import express, { Express } from 'express';
import { initDatabase } from './db/database.js';
import { ensureDemoWorkspace } from './db/seedDemo.js';
import { authRouter } from './routes/auth.js';
import { accountsRouter } from './routes/accounts.js';
import { categoriesRouter } from './routes/categories.js';
import { transactionsRouter } from './routes/transactions.js';
import { budgetsRouter } from './routes/budgets.js';
import { recurringRouter } from './routes/recurring.js';
import { goalsRouter } from './routes/goals.js';
import { analyticsRouter } from './routes/analytics.js';
import { dataRouter } from './routes/data.js';

let appInstance: Express | null = null;
let initialized = false;

export async function getExpressApp(): Promise<Express> {
  if (!initialized) {
    await initDatabase();
    ensureDemoWorkspace();
    initialized = true;
  }

  if (appInstance) return appInstance;

  const app = express();

  // 1. Parsers (support receipt image attachments up to 25MB)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // 2. Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      product: 'PRYORA',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // 3. API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/recurring', recurringRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/data', dataRouter);

  appInstance = app;
  return app;
}
