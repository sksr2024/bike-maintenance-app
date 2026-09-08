import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  createRecord,
  deleteRecord,
  getSummary,
  listRecords,
  logout,
  updateRecord,
  type MaintenanceRecord,
  type MaintenanceRecordInput,
  type MaintenanceSummaryEntry,
} from './api';
import { RecordForm } from './RecordForm';

interface MaintenanceRecordsPageProps {
  token: string;
  onLoggedOut: () => void;
}

type Tab = 'list' | 'summary';

export function MaintenanceRecordsPage({ token, onLoggedOut }: MaintenanceRecordsPageProps) {
  const [tab, setTab] = useState<Tab>('list');
  const [records, setRecords] = useState<MaintenanceRecord[] | null>(null);
  const [summary, setSummary] = useState<MaintenanceSummaryEntry[] | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      if (err instanceof ApiError && err.status === 401) {
        onLoggedOut();
        return;
      }
      setError(err instanceof Error ? err.message : fallbackMessage);
    },
    [onLoggedOut],
  );

  useEffect(() => {
    let cancelled = false;
    listRecords(token)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err) => {
        if (!cancelled) handleError(err, '一覧の取得に失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, [token, handleError]);

  useEffect(() => {
    if (tab !== 'summary' || summary !== null) {
      return;
    }
    let cancelled = false;
    getSummary(token)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) handleError(err, 'サマリーの取得に失敗しました');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, summary, token, handleError]);

  async function reloadRecords() {
    try {
      setRecords(await listRecords(token));
    } catch (err) {
      handleError(err, '一覧の取得に失敗しました');
    }
  }

  async function handleCreate(input: MaintenanceRecordInput) {
    try {
      await createRecord(token, input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLoggedOut();
        return;
      }
      throw err;
    }
    setShowCreateForm(false);
    setSummary(null);
    await reloadRecords();
  }

  async function handleUpdate(id: number, input: MaintenanceRecordInput) {
    try {
      await updateRecord(token, id, input);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        onLoggedOut();
        return;
      }
      throw err;
    }
    setEditingId(null);
    setSummary(null);
    await reloadRecords();
  }

  async function handleDelete(id: number) {
    if (deletingId !== null || !window.confirm('この整備記録を削除しますか？')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteRecord(token, id);
      setSummary(null);
      await reloadRecords();
    } catch (err) {
      handleError(err, '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogout() {
    try {
      await logout(token);
    } catch {
      // トークンが既に無効でもローカルのセッションは破棄する
    }
    onLoggedOut();
  }

  return (
    <section>
      <nav>
        <button type="button" onClick={() => setTab('list')} disabled={tab === 'list'}>
          一覧
        </button>
        <button type="button" onClick={() => setTab('summary')} disabled={tab === 'summary'}>
          サマリー
        </button>
        <button type="button" onClick={handleLogout}>
          ログアウト
        </button>
      </nav>

      {error && <p role="alert">{error}</p>}

      {tab === 'list' && (
        <div>
          <h2>整備記録一覧</h2>
          {!showCreateForm && (
            <button type="button" onClick={() => setShowCreateForm(true)}>
              新しい整備記録を登録
            </button>
          )}
          {showCreateForm && (
            <RecordForm submitLabel="登録する" onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
          )}

          {records === null && <p>読み込み中...</p>}
          {records !== null && records.length === 0 && <p>整備記録はまだありません</p>}
          {records !== null && records.length > 0 && (
            <ul>
              {records.map((record) => (
                <li key={record.id}>
                  {editingId === record.id ? (
                    <RecordForm
                      initialValues={{
                        maintenanceType: record.maintenanceType,
                        performedOn: record.performedOn,
                        mileageKm: record.mileageKm,
                        cost: record.cost,
                        memo: record.memo,
                      }}
                      submitLabel="更新する"
                      onSubmit={(input) => handleUpdate(record.id, input)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <>
                      <span>{record.performedOn}</span>
                      <span>{record.maintenanceType}</span>
                      <span>{record.mileageKm}km</span>
                      <span>{record.cost !== null ? `${record.cost}円` : '-'}</span>
                      <button type="button" onClick={() => setEditingId(record.id)}>
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(record.id)}
                        disabled={deletingId === record.id}
                      >
                        削除
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'summary' && (
        <div>
          <h2>整備種別ごとのサマリー</h2>
          {summary === null && <p>読み込み中...</p>}
          {summary !== null && (
            <ul>
              {summary.map((entry) => (
                <li key={entry.maintenanceType}>
                  <span>{entry.maintenanceType}</span>
                  {entry.lastPerformedOn === null ? (
                    <span>記録なし</span>
                  ) : (
                    <span>
                      {entry.lastPerformedOn}（{entry.lastMileageKm}km）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
