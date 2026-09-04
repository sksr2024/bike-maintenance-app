import request from 'supertest';
import type { createApp } from '../../src/app.js';

const DEFAULT_EMAIL = 'rider@example.com';
const DEFAULT_PASSWORD = 'correct-horse';

export async function signupAndLogin(
  app: ReturnType<typeof createApp>,
  email = DEFAULT_EMAIL,
  password = DEFAULT_PASSWORD,
): Promise<string> {
  await request(app).post('/auth/signup').send({ email, password });
  const loginResponse = await request(app).post('/auth/login').send({ email, password });
  return loginResponse.body.token as string;
}
