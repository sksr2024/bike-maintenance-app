/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

const MAINTENANCE_TYPES = [
  'オイル交換',
  'チェーン清掃・注油',
  'タイヤ交換',
  'ブレーキパッド交換',
  'バッテリー交換',
  '冷却水交換',
  'スパークプラグ交換',
  'エアフィルター交換',
];

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('maintenance_records', {
    id: 'id',
    user_id: {
      type: 'integer',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    maintenance_type: {
      type: 'text',
      notNull: true,
      check: `maintenance_type IN (${MAINTENANCE_TYPES.map((t) => `'${t}'`).join(', ')})`,
    },
    performed_on: {
      type: 'date',
      notNull: true,
    },
    mileage_km: {
      type: 'integer',
      notNull: true,
      check: 'mileage_km >= 0',
    },
    cost: {
      type: 'integer',
    },
    memo: {
      type: 'text',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()'),
    },
  });

  pgm.createIndex('maintenance_records', ['user_id', 'performed_on']);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('maintenance_records');
};
