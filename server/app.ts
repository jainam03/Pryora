/**
 * PRYORA Shared Express Application Definition
 *
 * Used by:
 * - server.ts (Local development & node server)
 * - api/index.ts (Vercel serverless function entry point)
 */

import express, { Express } from 'express';
import { initDatabase, checkDbHealth } from './db/database.js';
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
import { feedbackRouter } from './routes/feedback.js';
import { securityHeaders, apiCors, safeErrorHandler } from './middleware/security.js';

let appInstance: Express | null = null;
let initAppPromise: Promise<void> | null = null;

export async function getExpressApp(): Promise<Express> {
  if (!initAppPromise) {
    initAppPromise = (async () => {
      await initDatabase();
      ensureDemoWorkspace();
    })();
  }
  await initAppPromise;

  if (appInstance) return appInstance;

  const app = express();

  // Hide Express fingerprint header
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // 1. Security Headers & Conservative API CORS
  app.use(securityHeaders);
  app.use('/api', apiCors);

  // 2. Body Parsers (capped at 15MB to allow receipt uploads & large CSV/JSON imports while preventing memory abuse)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 3. Health Check (verifies database readiness)
  app.get('/api/health', (_req, res) => {
    const db = checkDbHealth();
    res.status(db.ok ? 200 : 503).json({
      status: db.ok ? 'ok' : 'degraded',
      product: 'PRYORA',
      version: '1.0.0-beta',
      database: db.ok ? 'connected' : 'unavailable',
      persistence: db.persistenceMode,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/budgets', budgetsRouter);
  app.use('/api/recurring', recurringRouter);
  app.use('/api/goals', goalsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/data', dataRouter);
  app.use('/api/feedback', feedbackRouter);

  // 5. Centralized Sanitized Error Handler
  app.use(safeErrorHandler);

  appInstance = app;
  return app;
}
