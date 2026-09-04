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
  return new Date().toISOString().slice(0, 10);
}

export function createMaintenanceRecordsRouter(): Router {
  const router = Router();

  router.post('/', requireAuth, async (req, res) => {
    const { maintenanceType, performedOn, mileageKm, cost, memo } = req.body ?? {};

    if (!MAINTENANCE_TYPES.includes(maintenanceType)) {
      res.status(400).json({ error: 'maintenanceType must be one of the fixed list' });
      return;
    }

    if (typeof performedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(performedOn)) {
      res.status(400).json({ error: 'performedOn must be a date in YYYY-MM-DD format' });
      return;
    }

    if (performedOn > today()) {
      res.status(400).json({ error: 'performedOn cannot be in the future' });
      return;
    }

    if (typeof mileageKm !== 'number' || !Number.isInteger(mileageKm) || mileageKm < 0) {
      res.status(400).json({ error: 'mileageKm must be a non-negative integer' });
      return;
    }

    if (cost !== undefined && cost !== null && !Number.isInteger(cost)) {
      res.status(400).json({ error: 'cost must be an integer' });
      return;
    }

    if (memo !== undefined && memo !== null && typeof memo !== 'string') {
      res.status(400).json({ error: 'memo must be a string' });
      return;
    }

    const result = await pool.query<MaintenanceRecordRow>(
      `INSERT INTO maintenance_records (user_id, maintenance_type, performed_on, mileage_km, cost, memo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, maintenance_type, performed_on::text, mileage_km, cost, memo`,
      [req.user!.id, maintenanceType, performedOn, mileageKm, cost ?? null, memo ?? null],
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

  return router;
}
