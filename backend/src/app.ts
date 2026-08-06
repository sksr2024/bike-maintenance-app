import express, { type Express } from 'express';
import { pool } from './db.js';

export function createApp(): Express {
  const app = express();

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', database: 'disconnected' });
    }
  });

  return app;
}
