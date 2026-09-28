/**
 * PRYORA Server Entry Point
 * 
 * Production-ready Express backend with SQLite persistence and Vite middleware integration.
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getExpressApp } from './server/app.js';

const PORT = 3000;

async function startServer() {
  const app = await getExpressApp();
  console.log('PRYORA: SQLite database initialized with active persistence and demo workspace.');

  // Frontend Integration (Vite in Dev / Static SPA in Prod)
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

  // Listen on 0.0.0.0:3000
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PRYORA Personal Finance OS is listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal: Failed to start PRYORA server:', err);
  process.exit(1);
});
