import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { resetDb } from '../helpers/resetDb.js';
import { signupAndLogin } from '../helpers/auth.js';
import { MAINTENANCE_TYPES } from '../../src/maintenanceRecords/constants.js';

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

describe('PATCH /maintenance-records/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function createRecord(app: ReturnType<typeof createApp>, authHeader: string): Promise<number> {
    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send(VALID_RECORD);
    return response.body.id as number;
  }

  it('updates a record owned by the caller', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;
    const id = await createRecord(app, authHeader);

    const response = await request(app)
      .patch(`/maintenance-records/${id}`)
      .set('Authorization', authHeader)
      .send({
        maintenanceType: 'タイヤ交換',
        performedOn: '2026-02-01',
        mileageKm: 13000,
        cost: 8000,
        memo: '前後タイヤ交換',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id,
      maintenanceType: 'タイヤ交換',
      performedOn: '2026-02-01',
      mileageKm: 13000,
      cost: 8000,
      memo: '前後タイヤ交換',
    });
  });

  it('rejects an update with a performedOn date in the future', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;
    const id = await createRecord(app, authHeader);

    const response = await request(app)
      .patch(`/maintenance-records/${id}`)
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, performedOn: tomorrow() });

    expect(response.status).toBe(400);
  });

  it('rejects an update with a negative mileage', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;
    const id = await createRecord(app, authHeader);

    const response = await request(app)
      .patch(`/maintenance-records/${id}`)
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, mileageKm: -1 });

    expect(response.status).toBe(400);
  });

  it("rejects updating another user's record", async () => {
    const app = createApp();
    const otherToken = await signupAndLogin(app, 'other@example.com');
    const id = await createRecord(app, `Bearer ${otherToken}`);

    const token = await signupAndLogin(app, 'rider@example.com');

    const response = await request(app)
      .patch(`/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RECORD);

    expect(response.status).toBe(404);
  });

  it('returns 404 for a non-existent record', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .patch('/maintenance-records/999999')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_RECORD);

    expect(response.status).toBe(404);
  });

  it('returns 404 instead of erroring for a malformed or out-of-range id', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;

    for (const id of ['not-a-number', '1e2', '99999999999']) {
      const response = await request(app)
        .patch(`/maintenance-records/${id}`)
        .set('Authorization', authHeader)
        .send(VALID_RECORD);
      expect(response.status).toBe(404);
    }
  });

  it('rejects the request when unauthenticated', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const id = await createRecord(app, `Bearer ${token}`);

    const response = await request(app).patch(`/maintenance-records/${id}`).send(VALID_RECORD);

    expect(response.status).toBe(401);
  });
});

describe('DELETE /maintenance-records/:id', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function createRecord(app: ReturnType<typeof createApp>, authHeader: string): Promise<number> {
    const response = await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send(VALID_RECORD);
    return response.body.id as number;
  }

  it('deletes a record owned by the caller', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;
    const id = await createRecord(app, authHeader);

    const response = await request(app).delete(`/maintenance-records/${id}`).set('Authorization', authHeader);

    expect(response.status).toBe(204);

    const listResponse = await request(app).get('/maintenance-records').set('Authorization', authHeader);
    expect(listResponse.body).toEqual([]);
  });

  it("rejects deleting another user's record", async () => {
    const app = createApp();
    const otherToken = await signupAndLogin(app, 'other@example.com');
    const id = await createRecord(app, `Bearer ${otherToken}`);

    const token = await signupAndLogin(app, 'rider@example.com');

    const response = await request(app)
      .delete(`/maintenance-records/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);

    const otherListResponse = await request(app)
      .get('/maintenance-records')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(otherListResponse.body).toHaveLength(1);
  });

  it('returns 404 for a non-existent record', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .delete('/maintenance-records/999999')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('returns 404 instead of erroring for a malformed or out-of-range id', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;

    for (const id of ['not-a-number', '1e2', '99999999999']) {
      const response = await request(app)
        .delete(`/maintenance-records/${id}`)
        .set('Authorization', authHeader);
      expect(response.status).toBe(404);
    }
  });

  it('rejects the request when unauthenticated', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const id = await createRecord(app, `Bearer ${token}`);

    const response = await request(app).delete(`/maintenance-records/${id}`);

    expect(response.status).toBe(401);
  });
});

describe('GET /maintenance-records/summary', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns null for maintenance types with no records', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);

    const response = await request(app)
      .get('/maintenance-records/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      MAINTENANCE_TYPES.map((maintenanceType: string) => ({
        maintenanceType,
        lastPerformedOn: null,
        lastMileageKm: null,
      })),
    );
  });

  it('returns the latest performedOn and mileage per type', async () => {
    const app = createApp();
    const token = await signupAndLogin(app);
    const authHeader = `Bearer ${token}`;

    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, maintenanceType: 'オイル交換', performedOn: '2026-01-01', mileageKm: 10000 });
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, maintenanceType: 'オイル交換', performedOn: '2026-03-01', mileageKm: 15000 });
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', authHeader)
      .send({ ...VALID_RECORD, maintenanceType: 'タイヤ交換', performedOn: '2026-02-01', mileageKm: 12000 });

    const response = await request(app)
      .get('/maintenance-records/summary')
      .set('Authorization', authHeader);

    expect(response.status).toBe(200);
    const oil = response.body.find((entry: { maintenanceType: string }) => entry.maintenanceType === 'オイル交換');
    const tire = response.body.find((entry: { maintenanceType: string }) => entry.maintenanceType === 'タイヤ交換');
    const brake = response.body.find(
      (entry: { maintenanceType: string }) => entry.maintenanceType === 'ブレーキパッド交換',
    );

    expect(oil).toEqual({ maintenanceType: 'オイル交換', lastPerformedOn: '2026-03-01', lastMileageKm: 15000 });
    expect(tire).toEqual({ maintenanceType: 'タイヤ交換', lastPerformedOn: '2026-02-01', lastMileageKm: 12000 });
    expect(brake).toEqual({ maintenanceType: 'ブレーキパッド交換', lastPerformedOn: null, lastMileageKm: null });
  });

  it("does not include another user's records in the summary", async () => {
    const app = createApp();
    const otherToken = await signupAndLogin(app, 'other@example.com');
    await request(app)
      .post('/maintenance-records')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(VALID_RECORD);

    const token = await signupAndLogin(app, 'rider@example.com');
    const response = await request(app)
      .get('/maintenance-records/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      MAINTENANCE_TYPES.map((maintenanceType: string) => ({
        maintenanceType,
        lastPerformedOn: null,
        lastMileageKm: null,
      })),
    );
  });

  it('rejects the request when unauthenticated', async () => {
    const app = createApp();

    const response = await request(app).get('/maintenance-records/summary');

    expect(response.status).toBe(401);
  });
});
