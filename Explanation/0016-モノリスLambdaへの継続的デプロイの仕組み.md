# モノリスLambdaへの継続的デプロイの仕組み

## 疑問の正体：「ファイル分割」と「デプロイの単位」を混同している

「ファイル分割されているコードをどうやって1つのLambdaにデプロイし続けるのか」という疑問は、**ソースコードの構造**と**デプロイ時の成果物の構造**を同じレイヤーで考えてしまうと生まれる。実際にはこの2つは別物で、Node.jsのアプリは元々この2段構えで動いている。

[backend/src/server.ts](../backend/src/server.ts)と[backend/src/app.ts](../backend/src/app.ts)を見ると、`src/`配下は`app.ts`・`routes/auth.ts`・`routes/maintenanceRecords.ts`・`auth/middleware.ts`・`db.ts`と役割ごとにファイルが分かれている。しかし`npm run build`（[backend/package.json](../backend/package.json)の`"build": "tsc -p tsconfig.build.json"`）を実行すると、これらは`dist/`配下にコンパイルされたうえで、実行時には`import`文が依存関係を解決して**1つのNode.jsプロセス**として動く。ファイルが分かれていることと、最終的に1つのプロセス（＝1つの実行単位）としてまとまることは最初から両立している。

Lambdaへのデプロイは、この「まとめる」工程をもう一段階進めるだけ。コンパイル済みの複数ファイルを、依存パッケージ込みで**1つのzip（またはコンテナイメージ）**に固めて、それをLambda関数の実体としてアップロードする。ソースコードのファイル分割は一切変更する必要がない。

## モノリスLambdaのビルドパイプライン

CI上でやることは次の5段階に整理できる。

1. **TypeScriptビルド** — 既存の`npm run build`をそのまま使う
2. **バンドル** — `esbuild`等で、`dist/`配下の複数ファイル＋`node_modules`の依存関係を1つ（または少数）のJSファイルにtree-shakingしながらまとめる
3. **Lambda用ハンドラーの追加** — HTTPリクエストをLambdaのイベント形式に変換する薄い層を1ファイル追加する
4. **パッケージング** — バンドル結果をzip化する（コンテナイメージ運用ならDockerビルド）
5. **デプロイ** — IaCツール（後述）経由でLambda関数のコードを更新する

ポイントは、1と2が今のnpm scriptsの延長線上にあり、3で追加が必要なのは既存コードへの変更ではなく「入り口を1つ足すだけ」で済む点にある。

## このプロジェクトでの具体例

[backend/src/app.ts](../backend/src/app.ts)は`createApp()`というファクトリ関数でExpressアプリを組み立て、[backend/src/server.ts](../backend/src/server.ts)がそれを`app.listen(port)`でHTTPサーバーとして起動する、という2層に分かれている。これは意図的な設計ではなく（テスト用にアプリだけ生成したいという動機が主だと推測されるが）、結果的にLambda化と非常に相性が良い構造になっている。

Lambda化する場合、`server.ts`はローカル開発用に残したまま、次のような`lambda.ts`を1つ追加するだけで済む。

```ts
// backend/src/lambda.ts（イメージ）
import serverlessHttp from 'serverless-http';
import { createApp } from './app.js';

export const handler = serverlessHttp(createApp());
```

`routes/auth.ts`や`routes/maintenanceRecords.ts`、[backend/src/auth/middleware.ts](../backend/src/auth/middleware.ts)、[backend/src/db.ts](../backend/src/db.ts)は一切変更不要。`createApp()`が組み立てるExpressアプリの中身は今まで通りで、その「入り口」がHTTPサーバーのポート待受からLambdaハンドラーに変わるだけ。これが「ファイル分割はそのまま、デプロイの単位だけが1つにまとまる」の具体像。

## CI/CDパイプライン全体の流れ

現時点でこのリポジトリに`.github/workflows`は存在しない（CI自体が未導入）。導入するとしたら、GitHub Actions上で次のようなジョブになる。

```
push to main
  ↓
1. npm ci
2. npm run typecheck
3. npm test          ← 既存のvitest統合テストがそのまま流用できる
4. npm run build
5. esbuildでバンドル（新規追加）
6. zip化（新規追加）
7. デプロイ（Terraform apply / aws lambda update-function-code）
```

1〜4は既存の`package.json`のスクリプトをCI上で呼ぶだけであり、[backend/test/integration](../backend/test/)配下の既存テストがそのままLambda化後の回帰テストとしても機能する（DBアクセス層やルーティングのロジック自体は変わらないため）。新しく増えるのは5〜7の3工程のみ。

## IaCツールとの接続

[docs/adr/0004-decoupled-maintenance-schedule-notification.md](../docs/adr/0004-decoupled-maintenance-schedule-notification.md)には「AWS環境へのTerraformによる本番プロビジョニング」という記述があり、このプロジェクトではTerraformでのインフラ管理が既に想定されている。モノリスLambdaもTerraformの管理対象にできる。

Terraformの`aws_lambda_function`リソースは、デプロイパッケージ（zip）のパスとそのハッシュ値（`source_code_hash`）を指定する形で定義する。CIパイプラインの流れとしては、5〜6でビルドしたzipをS3等に配置し、そのパスとハッシュをTerraformに渡して`terraform apply`を実行する、という形になる。つまり「アプリケーションのビルド」と「インフラの反映」は別工程のまま、CIが両方を順番に呼び出す構成になる。

## まとめ

- 疑問の前提だった「ファイル分割 vs 1つのLambda」は対立しない。ファイル分割は開発時の構造、Lambdaのデプロイパッケージは実行時にまとめた成果物という、別のレイヤーの話
- [backend/src/app.ts](../backend/src/app.ts)と[backend/src/server.ts](../backend/src/server.ts)が既に分離されているため、モノリスLambda化に必要なコード変更は`lambda.ts`を1つ追加するだけで済む
- CI/CDパイプラインは「テスト→ビルド→バンドル→zip化→Terraformでデプロイ」という工程の自動化であり、既存の`npm run build` / `npm test`の延長線上にある
- 現時点でこのリポジトリに`.github/workflows`によるCIは未導入であり、Lambda移行に着手する場合はCIパイプライン自体の新規構築も合わせて必要になる
