import express, { type Express } from 'express';
import { pool } from './db.js';
import { createAuthRouter } from './routes/auth.js';
import { createMaintenanceRecordsRouter } from './routes/maintenanceRecords.js';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter());
  app.use('/maintenance-records', createMaintenanceRecordsRouter());

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
