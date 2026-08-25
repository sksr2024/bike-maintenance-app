import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { extractBearerToken, generateSessionToken } from '../auth/session.js';
import { requireAuth } from '../auth/middleware.js';

const MIN_PASSWORD_LENGTH = 8;

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || email.length === 0) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const passwordHash = await hashPassword(password);

    try {
      const result = await pool.query<{ id: number; email: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash],
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: 'email is already registered' });
        return;
      }
      throw error;
    }
  });

  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};

    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }

    const result = await pool.query<{ id: number; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      res.status(401).json({ error: 'invalid email or password' });
      return;
    }

    const token = generateSessionToken();
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

    res.status(200).json({ token });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.status(200).json(req.user);
  });

  router.post('/logout', requireAuth, async (req, res) => {
    const token = extractBearerToken(req);
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.status(204).send();
  });

  return router;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
