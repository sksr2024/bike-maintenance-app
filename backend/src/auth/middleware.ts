import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db.js';
import { extractBearerToken } from './session.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractBearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }

  const result = await pool.query<{ id: number; email: string }>(
    'SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = $1',
    [token],
  );
  const user = result.rows[0];

  if (!user) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }

  req.user = user;
  next();
}
