export const MAINTENANCE_TYPES = [
  'オイル交換',
  'チェーン清掃・注油',
  'タイヤ交換',
  'ブレーキパッド交換',
  'バッテリー交換',
  '冷却水交換',
  'スパークプラグ交換',
  'エアフィルター交換',
] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];
