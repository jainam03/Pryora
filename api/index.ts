/**
 * Vercel Serverless Function Entry Point
 * 
 * Handles all /api/* requests deployed to Vercel.
 */

import { getExpressApp } from '../server/app.js';

export default async function handler(req: any, res: any) {
  const app = await getExpressApp();
  return app(req, res);
}
