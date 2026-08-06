# bike-maintenance-app

バイクの整備記録アプリ

## 構成

- `backend/`: Node.js + TypeScript（Express）。PostgreSQLに接続する。
- `frontend/`: React + TypeScript（Vite）。
- `docker-compose.yml`: 開発用・テスト用のPostgreSQLコンテナ。

## セットアップ

```sh
docker compose up -d          # 開発用DB(5432)・テスト用DB(5433)を起動
cd backend && npm install && cp .env.example .env
cd ../frontend && npm install
```

## 開発

```sh
cd backend && npm run migrate  # 開発用DBにマイグレーションを適用
cd backend && npm run dev      # http://localhost:3000
cd frontend && npm run dev     # http://localhost:5173 (backendの /health にプロキシ)
```

frontendの`/health`疎通は、`vite.config.ts`のdevサーバー用プロキシ経由。`npm run build`の本番ビルド成果物には疎通経路を含まないため、別途リバースプロキシ等の構成が必要（本チケットの範囲外）。

## テスト

`backend`の統合テストは、テスト用PostgreSQL（`docker-compose.yml`の`postgres-test`、ポート5433）に対して実HTTPリクエストを発行する。テスト実行前にマイグレーションが自動適用される。

```sh
docker compose up -d postgres-test
cd backend && npm test
```
