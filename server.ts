/**
 * PRYORA Server Entry Point
 * 
 * Production-ready Express backend with SQLite persistence and Vite middleware integration.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db/database.js';
import { ensureDemoWorkspace } from './server/db/seedDemo.js';
import { authRouter } from './server/routes/auth.js';
import { accountsRouter } from './server/routes/accounts.js';
import { categoriesRouter } from './server/routes/categories.js';
import { transactionsRouter } from './server/routes/transactions.js';
import { budgetsRouter } from './server/routes/budgets.js';
import { recurringRouter } from './server/routes/recurring.js';
import { goalsRouter } from './server/routes/goals.js';
import { analyticsRouter } from './server/routes/analytics.js';
import { dataRouter } from './server/routes/data.js';

const PORT = 3000;

async function startServer() {
  // 1. Initialize SQLite Database & Migrations
  await initDatabase();
  ensureDemoWorkspace();
  console.log('PRYORA: SQLite database initialized with active persistence and demo workspace.');

  const app = express();

  // 2. Parsers (support receipt image attachments up to 25MB)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // 3. Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      product: 'PRYORA',
      version: '1.0.0',
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

  // 5. Frontend Integration (Vite in Dev / Static SPA in Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 6. Listen on 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PRYORA Personal Finance OS is listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal: Failed to start PRYORA server:', err);
  process.exit(1);
});
