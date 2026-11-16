# Playwrightとは何か

## Playwrightの正体

Playwrightは Microsoft が開発するブラウザ自動操作ライブラリで、E2E（End-to-End）テストのフレームワークとして使われることが最も多い。Node.js（TypeScript/JavaScript）のほかPython・Java・.NETからも使え、Chromium・Firefox・WebKitの3エンジンを実際に起動して、ユーザーがブラウザ上で行う操作（ページ遷移、クリック、フォーム入力、送信）をコードで再現できる。

同じ立ち位置のツールとしてCypressがあるが、Playwrightは複数ブラウザエンジンを1つのAPIで横断的に扱える点、テストを並列実行しやすい点が特徴としてよく挙げられる。

E2Eテストは、単体テストのように1関数・1コンポーネントを孤立させて検証するのではなく、フロントエンドとバックエンドを実際に両方起動した状態で「画面の入力から実際のAPI呼び出し、DBの状態変化まで」を通しで検証する。そのぶん実行は遅く壊れやすいが、「実際にユーザーが使えるか」を保証できるのはこの層だけ、という位置づけになる。

## このプロジェクトでの利用予定

結論から言うと、**現時点（2026-09-04）でPlaywrightは未導入であり、正式な導入計画としても確定していない**。根拠は次の3つ。

1. [frontend/package.json](../frontend/package.json)の`dependencies`/`devDependencies`にPlaywright関連のパッケージは存在しない。テストスクリプト自体がまだ無い（`scripts`は`dev`/`build`/`lint`/`preview`のみ）。
2. [backend/package-lock.json](../backend/package-lock.json)内に`playwright`という文字列は出てくるが、これは`vitest`の`peerDependencies`に含まれる`@vitest/browser-playwright`（Vitestがブラウザモードでテストを実行する際のオプション機能）の記述であり、`optional: true`と明記されている間接的な依存関係にすぎない。backend自身がPlaywrightを使っているわけではない。
3. GitHub Issues（`sksr2024/bike-maintenance-app`）を`playwright`・`E2E`で検索しても該当issueは無い。つまりissueとしてタスク化されてもいない。

一方で、[0008-フロントエンドのテストはどう組むのが一般的か.md](0008-フロントエンドのテストはどう組むのが一般的か.md)では、フロントエンドテストを

1. コンポーネント単体テスト（Vitest + React Testing Library）
2. E2Eテスト（Playwright / Cypress）

の2段構えで整備するのが一般的、という提案として書いている。これはあくまで一般的なプラクティスの解説であり、backend側で既に実装済みの認証フロー（[45bf7ad](../CLAUDE.md)、[backend/test/integration/auth.test.ts](../backend/test/integration/auth.test.ts)）に対応するフロントエンドUIがまだ存在しないため、E2Eテストで検証する対象自体がまだ無い、という段階的な理由による。

## まとめ

- Playwrightは「ブラウザを実際に動かして画面操作を検証するE2Eテストツール」
- このプロジェクトでは**未導入・issue未作成**で、確定した利用予定ではない
- 導入するとすれば、フロントエンドに認証UI（サインアップ/ログイン/ログアウト画面）が実装され、backendのAPIと接続された後、「サインアップ→ログイン→ログアウト」の一連の画面操作を検証するタイミングが自然な候補になる
