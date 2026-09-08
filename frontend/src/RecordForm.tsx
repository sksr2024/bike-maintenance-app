import { useState, type FormEvent } from 'react';
import { MAINTENANCE_TYPES } from './maintenanceTypes';
import type { MaintenanceRecordInput } from './api';

interface RecordFormProps {
  initialValues?: MaintenanceRecordInput;
  submitLabel: string;
  onSubmit: (input: MaintenanceRecordInput) => Promise<void>;
  onCancel: () => void;
}

function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RecordForm({ initialValues, submitLabel, onSubmit, onCancel }: RecordFormProps) {
  const [maintenanceType, setMaintenanceType] = useState(initialValues?.maintenanceType ?? MAINTENANCE_TYPES[0]);
  const [performedOn, setPerformedOn] = useState(initialValues?.performedOn ?? today());
  const [mileageKm, setMileageKm] = useState(initialValues ? String(initialValues.mileageKm) : '');
  const [cost, setCost] = useState(initialValues?.cost != null ? String(initialValues.cost) : '');
  const [memo, setMemo] = useState(initialValues?.memo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const mileage = Number(mileageKm);
    if (!Number.isInteger(mileage) || mileage < 0) {
      setError('走行距離は0以上の整数で入力してください');
      return;
    }

    let parsedCost: number | null = null;
    if (cost.trim() !== '') {
      parsedCost = Number(cost);
      if (!Number.isInteger(parsedCost)) {
        setError('費用は整数で入力してください');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        maintenanceType,
        performedOn,
        mileageKm: mileage,
        cost: parsedCost,
        memo: memo.trim() === '' ? null : memo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        整備種別
        <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)}>
          {MAINTENANCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        実施日
        <input
          type="date"
          value={performedOn}
          max={today()}
          onChange={(event) => setPerformedOn(event.target.value)}
          required
        />
      </label>
      <label>
        走行距離(km)
        <input
          type="number"
          value={mileageKm}
          min={0}
          step={1}
          onChange={(event) => setMileageKm(event.target.value)}
          required
        />
      </label>
      <label>
        費用(円・任意)
        <input type="number" value={cost} step={1} onChange={(event) => setCost(event.target.value)} />
      </label>
      <label>
        メモ(任意)
        <textarea value={memo} onChange={(event) => setMemo(event.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <div>
        <button type="submit" disabled={submitting}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
