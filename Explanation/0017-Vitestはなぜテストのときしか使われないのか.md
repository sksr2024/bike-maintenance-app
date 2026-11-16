# Vitestはなぜテストのときしか使われないのか

## Vitestの役割は「テストコードの実行」に限定されている

Vitestは、アプリケーションを動かすための仕組みではなく、`describe`/`it`/`expect`/`beforeEach`といった**テストを書くためのAPI**と、それらを集めて実行し結果をレポートする**テストランナー**を提供するツール。この2つの機能しか持たない。

このプロジェクトの[backend/src/](../backend/src/)配下（Expressサーバーやルーティングなど、実際に動くアプリケーションコード）を見ると、`vitest`という文字列は一切出てこない。

```sh
grep -rl "vitest" backend/src/   # 何もヒットしない
grep -rl "vitest" backend/test/  # test/integration/*.test.ts の3ファイルだけヒット
```

`vitest`をimportしているのは[backend/test/integration/](../backend/test/integration/)配下の`*.test.ts`ファイルだけ。これは偶然ではなく、Vitestというツールの設計そのものが「テストファイルの中でだけ使うAPIを提供する」というスコープに閉じているため。

## コマンドの役割分担

[backend/package.json](../backend/package.json)の`scripts`を見ると、目的ごとに完全に別のコマンドが用意されている。

| コマンド | 実体 | 何をするか |
|---|---|---|
| `npm run dev` | `tsx watch src/server.ts` | Expressサーバーを実際に起動し、ポートを開いてHTTPリクエストを待ち受ける |
| `npm run build` + `npm start` | `tsc` → `node dist/server.js` | 本番用にコンパイルして実行 |
| `npm test` | `dotenv -e .env.test -- vitest run` | テストコードだけを実行し、成功/失敗を判定する |

`dev`や`start`はアプリケーションそのものを起動するコマンドであり、Vitestはここには一切登場しない。Vitestが登場するのは「コードが正しく動くかどうかを検証したいとき」だけ。

## 「使う・使われる」の主従関係

テストコード側から見ると、Vitest自身がアプリケーションのロジックを持っているわけではなく、あくまで**アプリケーションコードを呼び出して検証する側**という立場になっている。[backend/test/integration/health.test.ts](../backend/test/integration/health.test.ts)がその典型例。

```ts
const app = createApp();
const response = await request(app).get('/health');
expect(response.status).toBe(200);
```

ここで`createApp()`は[backend/src/app.ts](../backend/src/app.ts)で定義された、本番でも使われる本物のアプリケーションコード。テストファイルはこの本物のコードをimportして呼び出し、その結果をVitestの`expect`で検証しているだけ。逆に`app.ts`側が`vitest`をimportして何かをするということは起こらない——アプリケーションのロジックはテストの存在を知らなくてよい、という一方向の依存関係になっている。

これは一般的なテストフレームワーク（Jest、Mocha、Vitestなど）に共通する設計思想でもある。「本番コードがテストツールに依存しない」ようにしておくことで、テストフレームワークを差し替えたり削除したりしても、アプリケーション本体には一切影響が及ばないようになっている。実際、[backend/vitest.config.ts](../backend/vitest.config.ts)や`vitest`パッケージ自体を丸ごと消しても、`npm run dev`でサーバーが起動すること自体は成立する（テストが書けなくなるだけ）。

## まとめ

- Vitestは「テストを実行する」という1つの目的にのみ使われるツールであり、アプリケーションの実行系（`dev`/`build`/`start`）とは完全に別系統のコマンドとして分離されている。
- 依存の向きは一方向：テストコードは本番コード（`src/`）を呼び出して検証するが、本番コードはテストツールの存在を一切知らない。
- これにより、テストの仕組みを変更・削除しても本番のアプリケーション動作には影響しない、という関心の分離が実現されている。
