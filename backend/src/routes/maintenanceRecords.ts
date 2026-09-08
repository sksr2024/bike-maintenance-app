import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { MAINTENANCE_TYPES } from '../maintenanceRecords/constants.js';

interface MaintenanceRecordRow {
  id: number;
  maintenance_type: string;
  performed_on: string;
  mileage_km: number;
  cost: number | null;
  memo: string | null;
}

function toResponseBody(row: MaintenanceRecordRow) {
  return {
    id: row.id,
    maintenanceType: row.maintenance_type,
    performedOn: row.performed_on,
    mileageKm: row.mileage_km,
    cost: row.cost,
    memo: row.memo,
  };
}

function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ValidatedRecordInput {
  maintenanceType: string;
  performedOn: string;
  mileageKm: number;
  cost: number | null;
  memo: string | null;
}

type ValidationResult = { ok: true; data: ValidatedRecordInput } | { ok: false; error: string };

function validateRecordInput(body: Record<string, unknown>): ValidationResult {
  const { maintenanceType, performedOn, mileageKm, cost, memo } = body;

  if (!MAINTENANCE_TYPES.includes(maintenanceType as (typeof MAINTENANCE_TYPES)[number])) {
    return { ok: false, error: 'maintenanceType must be one of the fixed list' };
  }

  if (typeof performedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(performedOn)) {
    return { ok: false, error: 'performedOn must be a date in YYYY-MM-DD format' };
  }

  if (performedOn > today()) {
    return { ok: false, error: 'performedOn cannot be in the future' };
  }

  if (typeof mileageKm !== 'number' || !Number.isInteger(mileageKm) || mileageKm < 0) {
    return { ok: false, error: 'mileageKm must be a non-negative integer' };
  }

  if (cost !== undefined && cost !== null && !Number.isInteger(cost)) {
    return { ok: false, error: 'cost must be an integer' };
  }

  if (memo !== undefined && memo !== null && typeof memo !== 'string') {
    return { ok: false, error: 'memo must be a string' };
  }

  return {
    ok: true,
    data: {
      maintenanceType: maintenanceType as string,
      performedOn,
      mileageKm,
      cost: (cost as number | undefined) ?? null,
      memo: (memo as string | undefined) ?? null,
    },
  };
}

const POSTGRES_INTEGER_MAX = 2147483647;

function parseRecordId(rawId: unknown): number | undefined {
  if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
    return undefined;
  }
  const id = Number(rawId);
  return id <= POSTGRES_INTEGER_MAX ? id : undefined;
}

export function createMaintenanceRecordsRouter(): Router {
  const router = Router();

  router.post('/', requireAuth, async (req, res) => {
    const validation = validateRecordInput(req.body ?? {});

    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { maintenanceType, performedOn, mileageKm, cost, memo } = validation.data;

    const result = await pool.query<MaintenanceRecordRow>(
      `INSERT INTO maintenance_records (user_id, maintenance_type, performed_on, mileage_km, cost, memo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, maintenance_type, performed_on::text, mileage_km, cost, memo`,
      [req.user!.id, maintenanceType, performedOn, mileageKm, cost, memo],
    );

    res.status(201).json(toResponseBody(result.rows[0]));
  });

  router.get('/', requireAuth, async (req, res) => {
    const result = await pool.query<MaintenanceRecordRow>(
      `SELECT id, maintenance_type, performed_on::text, mileage_km, cost, memo
       FROM maintenance_records
       WHERE user_id = $1
       ORDER BY performed_on DESC, id DESC`,
      [req.user!.id],
    );

    res.status(200).json(result.rows.map(toResponseBody));
  });

  router.get('/summary', requireAuth, async (req, res) => {
    const result = await pool.query<{ maintenance_type: string; performed_on: string; mileage_km: number }>(
      `SELECT DISTINCT ON (maintenance_type) maintenance_type, performed_on::text, mileage_km
       FROM maintenance_records
       WHERE user_id = $1
       ORDER BY maintenance_type, performed_on DESC, id DESC`,
      [req.user!.id],
    );

    const latestByType = new Map(result.rows.map((row) => [row.maintenance_type, row]));

    res.status(200).json(
      MAINTENANCE_TYPES.map((maintenanceType) => {
        const latest = latestByType.get(maintenanceType);
        return {
          maintenanceType,
          lastPerformedOn: latest?.performed_on ?? null,
          lastMileageKm: latest?.mileage_km ?? null,
        };
      }),
    );
  });

  router.patch('/:id', requireAuth, async (req, res) => {
    const id = parseRecordId(req.params.id);

    if (id === undefined) {
      res.status(404).json({ error: 'maintenance record not found' });
      return;
    }

    const validation = validateRecordInput(req.body ?? {});

    if (!validation.ok) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { maintenanceType, performedOn, mileageKm, cost, memo } = validation.data;

    const result = await pool.query<MaintenanceRecordRow>(
      `UPDATE maintenance_records
       SET maintenance_type = $1, performed_on = $2, mileage_km = $3, cost = $4, memo = $5
       WHERE id = $6 AND user_id = $7
       RETURNING id, maintenance_type, performed_on::text, mileage_km, cost, memo`,
      [maintenanceType, performedOn, mileageKm, cost, memo, id, req.user!.id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'maintenance record not found' });
      return;
    }

    res.status(200).json(toResponseBody(result.rows[0]));
  });

  router.delete('/:id', requireAuth, async (req, res) => {
    const id = parseRecordId(req.params.id);

    if (id === undefined) {
      res.status(404).json({ error: 'maintenance record not found' });
      return;
    }

    const result = await pool.query('DELETE FROM maintenance_records WHERE id = $1 AND user_id = $2', [
      id,
      req.user!.id,
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'maintenance record not found' });
      return;
    }

    res.status(204).send();
  });

  return router;
}
