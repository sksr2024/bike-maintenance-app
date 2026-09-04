import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/resetDb.js';
import { signupAndLogin } from '../helpers/auth.js';

describe('POST /auth/signup', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates an account with a valid email and password', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'correct-horse' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(Number), email: 'rider@example.com' });
  });

  it('rejects a password shorter than 8 characters', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'short1' });

    expect(response.status).toBe(400);
  });

  it('rejects signup with an email that is already registered', async () => {
    const app = createApp();
    await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'correct-horse' });

    const response = await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'another-password' });

    expect(response.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('issues a session token for valid credentials', async () => {
    const app = createApp();
    await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'correct-horse' });

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'rider@example.com', password: 'correct-horse' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ token: expect.any(String) });
  });

  it('rejects login with a wrong password', async () => {
    const app = createApp();
    await request(app)
      .post('/auth/signup')
      .send({ email: 'rider@example.com', password: 'correct-horse' });

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'rider@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
  });

  it('rejects login for an email that was never registered', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'correct-horse' });

    expect(response.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns the current user when a valid session token is provided', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: expect.any(Number), email: 'rider@example.com' });
  });

  it('rejects a request with no Authorization header', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
  });

  it('rejects a request with an invalid session token', async () => {
    const app = createApp();

    const response = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('ends the session so the token can no longer be used', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const logoutResponse = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(logoutResponse.status).toBe(204);

    const meResponse = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meResponse.status).toBe(401);
  });

  it('rejects logout with no Authorization header', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/logout');

    expect(response.status).toBe(401);
  });

  it('rejects logout with an invalid session token', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/auth/logout')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
  });
});
