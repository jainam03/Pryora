import http from 'http';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getExpressApp } from './server/app.js';

function parseArg(flag: string, shortFlag?: string): string | undefined {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === flag || (shortFlag && arg === shortFlag)) {
      return process.argv[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.split('=')[1];
    }
  }
  return undefined;
}

const PORT = parseInt(parseArg('--port', '-p') || process.env.PORT || '3000', 10);
const HOST = parseArg('--host', '-h') || process.env.HOST || '0.0.0.0';

async function startServer() {
  const app = await getExpressApp();
  console.log('PRYORA: SQLite database initialized with active persistence and demo workspace.');

  const server = http.createServer(app);

  // Frontend Integration (Vite in Dev / Static SPA in Prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server },
      },
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

  server.on('error', (err: any) => {
    console.error('PRYORA Server Error:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`PRYORA Personal Finance OS is listening at http://${HOST}:${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}. Gracefully stopping PRYORA server...`);
    server.close(() => {
      console.log('PRYORA server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

process.on('uncaughtException', (err) => {
  console.error('PRYORA Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('PRYORA Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer().catch(err => {
  console.error('Fatal: Failed to start PRYORA server:', err);
  process.exit(1);
});

