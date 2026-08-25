# PostgreSQLとマイグレーションの仕組み

## 3つの技術の役割分担

このプロジェクトのデータ層は、単一のフレームワークではなく3つの独立した技術の組み合わせでできている。

1. **Docker**（PostgreSQL本体を動かす）
2. **pg**（node-postgres、Node.jsからDBに接続してSQLを発行するクライアント）
3. **node-pg-migrate**（スキーマの変更履歴を管理するマイグレーションツール）

ORM（PrismaやTypeORMのような「モデル定義からテーブルを自動生成する」層）は採用していない。[docs/adr/0001-cloud-backend-with-postgres-node-react.md](../docs/adr/0001-cloud-backend-with-postgres-node-react.md)にある通り、このプロジェクトはアプリ機能の実装だけでなくバックエンド・インフラ領域の学習も目的としているため、抽象化を挟まず生のSQLとマイグレーションを手で書く薄い構成をあえて選んでいる。

## DockerでPostgreSQLをどう動かしているか

[docker-compose.yml](../docker-compose.yml)に2つのPostgreSQLコンテナが定義されている。

```yaml
postgres:       # 開発用。localhost:5432、postgres-dataボリュームで永続化
postgres-test:  # テスト用。localhost:5433、tmpfsでコンテナ停止時にデータが消える
```

どちらも公式イメージ`postgres:16-alpine`をそのまま使い、独自Dockerfileは書いていない。開発用DBとテスト用DBをポート番号（5432 / 5433）で完全に分けているのは、テストの実行が開発中に手で入れたデータを壊さないようにするための境界。テスト用が`tmpfs`（メモリ上のファイルシステム）なのは、テストごとにまっさらな状態から始めたい・後片付けを気にしたくないという意図の表れ。

## アプリからの接続

[backend/src/db.ts](../backend/src/db.ts)で`pg`パッケージの`Pool`を作り、`DATABASE_URL`環境変数の接続文字列を渡しているだけ。

```ts
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

`DATABASE_URL`は環境ごとに`.env`系ファイルで切り替える。

- [backend/.env.example](../backend/.env.example) → `postgres://...@localhost:5432/bike_maintenance_dev`（開発）
- [backend/.env.test](../backend/.env.test) → `postgres://...@localhost:5433/bike_maintenance_test`（テスト）

読み込みは`dotenv-cli`（`package.json`の`dotenv -e .env.test -- vitest run`のような形）が担っている。

## マイグレーションとは何か

**スキーマ変更（テーブル作成、カラム追加など）を、コードとして記述し、時系列に番号管理する仕組み**。

DBのテーブル構造は「今この瞬間どうなっているか」という単一の状態しか持たない。複数人・複数環境（自分のPC、CI、将来の本番）で同じ構造を再現し続けるには、「どんな順番でどう変更してきたか」という履歴が必要になる。マイグレーションはその履歴の1単位を1ファイルとして表現したもの。

## node-pg-migrateでの実現

[backend/migrations/1786024913011_bootstrap-schema.js](../backend/migrations/1786024913011_bootstrap-schema.js)が実例。

```js
export const up = (pgm) => {
  pgm.createTable('bootstrap_check', {
    id: 'id',
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

export const down = (pgm) => {
  pgm.dropTable('bootstrap_check');
};
```

- **`up`**: この変更を適用する処理。ここではテーブル作成。
- **`down`**: この変更を取り消す（ロールバックする）処理。ここではテーブル削除。

ファイル名先頭の数字`1786024913011`はタイムスタンプで、適用順序を決める。node-pg-migrateはDB内に`pgmigrations`という管理用テーブルを自分で作り、「どのファイル名まで適用済みか」を記録する。実行のたびに全ファイルを見て、まだ記録されていない＝未適用のものだけを`up`から順番に流す。これにより「このマイグレーション、もう当てたっけ？」を人間が覚えておく必要がなくなる。

## このプロジェクトでの実行タイミング

- **開発時**: `npm run migrate`（`backend/package.json`の`"migrate": "dotenv -e .env -- node-pg-migrate"`）を手動実行し、開発用DB（ポート5432）に適用する。
- **テスト時**: [backend/test/globalSetup.ts](../backend/test/globalSetup.ts)がnode-pg-migrateの`runner()`関数をコードから直接呼び出し、テスト実行の直前に自動でテスト用DB（ポート5433）へ全マイグレーションを適用してからテストが走る。人間が事前に`migrate:test`を叩き忘れても、テストを実行するだけで常にスキーマが最新に揃う設計になっている。

## 現状

`bootstrap_check`という、どの機能にも属さない空のテーブルを作るだけの雛形マイグレーションが1件あるのみ（コメントにも「マイグレーションの仕組みが一気通貫で動くことを証明するためだけの雛形」とある）。issue #3（認証）以降の実装が進むにつれて、`users`テーブルや`maintenance_records`テーブルを作るマイグレーションファイルが追加されていく想定。
