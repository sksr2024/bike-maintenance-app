import { pool } from '../../src/db.js';

export async function resetDb(): Promise<void> {
  await pool.query('TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE');
}
