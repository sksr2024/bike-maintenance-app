import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/resetDb.js';
import { signupAndLogin } from '../helpers/auth.js';

const VALID_RECORD = {
  maintenanceType: 'オイル交換',
  performedOn: '2026-01-15',
  mileageKm: 12000,
  cost: 5000,
  memo: '純正オイルに交換',
};

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe('POST /maintenance-records', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers a record with all fields', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RECORD);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      maintenanceType: 'オイル交換',
      performedOn: '2026-01-15',
      mileageKm: 12000,
      cost: 5000,
      memo: '純正オイルに交換',
    });
  });

  it('registers a record when cost and memo are omitted', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send({
        maintenanceType: 'タイヤ交換',
        performedOn: '2026-01-15',
        mileageKm: 8000,
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      maintenanceType: 'タイヤ交換',
      performedOn: '2026-01-15',
      mileageKm: 8000,
      cost: null,
      memo: null,
    });
  });

  it('rejects a maintenance type outside the fixed list', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RECORD, maintenanceType: 'カスタム整備' });

    expect(response.status).toBe(400);
  });

  it('rejects a performedOn date in the future', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RECORD, performedOn: tomorrow() });

    expect(response.status).toBe(400);
  });

  it('rejects a negative mileage', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RECORD, mileageKm: -1 });

    expect(response.status).toBe(400);
  });

  it('rejects a non-integer cost', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...VALID_RECORD, cost: 5000.5 });

    expect(response.status).toBe(400);
  });

  it('rejects the request when unauthenticated', async () => {
    const app = createApp();

    const response = await request(app).post('/maintenance-records').send(VALID_RECORD);

    expect(response.status).toBe(401);
  });
});

describe('GET /maintenance-records', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns an empty list when the user has no records', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .get('/maintenance-records')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('returns the fields needed for a list row', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RECORD);

    const response = await request(app)
      .get('/maintenance-records')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: expect.any(Number),
        maintenanceType: 'オイル交換',
        performedOn: '2026-01-15',
        mileageKm: 12000,
        cost: 5000,
        memo: '純正オイルに交換',
      },
    ]);
  });

  it('orders records by performedOn descending', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;

    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, performedOn: '2026-01-01' });
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, performedOn: '2026-03-01' });
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, performedOn: '2026-02-01' });

    const response = await request(app).get('/maintenance-records').set('Authorization', authHeader);

    expect(response.body.map((record: { performedOn: string }) => record.performedOn)).toEqual([
      '2026-03-01',
      '2026-02-01',
      '2026-01-01',
    ]);
  });

  it("does not include another user's records", async () => {
    const app = createApp();
    const otherToken = await signupAndLogin(app, 'other@example.com');
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(VALID_RECORD);

    const token = await signupAndLogin(app, 'rider@example.com');
    const response = await request(app)
      .get('/maintenance-records')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('rejects the request when unauthenticated', async () => {
    const app = createApp();

    const response = await request(app).get('/maintenance-records');

    expect(response.status).toBe(401);
  });
});
