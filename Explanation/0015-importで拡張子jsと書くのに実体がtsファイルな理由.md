# importで拡張子.jsと書くのに実体が.tsファイルな理由

## 起きている食い違い

[backend/test/helpers/auth.ts](../backend/test/helpers/auth.ts)は次のようにimportしている。

```ts
import type { createApp } from '../../src/app.js';
```

しかし[backend/src/](../backend/src/)には`app.ts`しか存在せず、`app.js`というファイルは実在しない。

```sh
ls backend/src/
# app.ts  db.ts  server.ts
```

これはこのファイル固有の話ではなく、プロジェクト内の`.ts`ファイル同士のimportすべてに共通するパターン。原因は[backend/tsconfig.json](../backend/tsconfig.json)の設定にある。

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

## Node.jsのESMは拡張子省略を許さない

Node.js標準のESM（`import`/`export`構文）は、CommonJSの`require('./app')`のような拡張子省略を許可しない。相対パスでimportするときは、**実行時に実在するファイルの拡張子をそのまま書く**必要がある。

## TypeScriptはビルドすると.tsが.jsになる

このプロジェクトは[backend/package.json](../backend/package.json)の`"build": "tsc -p tsconfig.build.json"`でTypeScriptをコンパイルし、`dist/`以下に`.js`として出力してから実行する（`"start": "node dist/server.js"`）。つまり最終的にNode.jsが読み込むのは`app.ts`ではなく、コンパイル後の`dist/app.js`。

`"module": "NodeNext"`は「Node.jsのESM解決ルールに従う」設定で、この下ではTypeScriptコンパイラは**importのパス文字列を一切書き換えない**。ソースに`'./app.js'`と書けば、出力される`.js`ファイルにもそのまま`'./app.js'`という文字列が残る。

```
開発時に書くコード（backend/test/helpers/auth.ts）
  import { createApp } from '../../src/app.js'   ← 実体は app.ts
                    │
                    │ tsc でコンパイル
                    ▼
実行されるコード（dist/以下）
  import { createApp } from '../../src/app.js'   ← 実体も app.js
```

つまり`.js`という拡張子は「今書いているファイルの拡張子」ではなく、「**コンパイル後に実際に存在することになるファイルの拡張子**」を先取りして書いている。TypeScriptコンパイラは`.js`と書かれたimportパスを見ても、対応する`.ts`ファイルをちゃんと探し出して型チェックしてくれるため、開発中にエラーにはならない。

## 開発時に.tsのまま動かせているのはtsxのおかげ

[backend/package.json](../backend/package.json)の`"dev": "tsx watch src/server.ts"`にある`tsx`は、`.ts`ファイルを事前にコンパイルせずその場で解釈しながら実行する開発用ツール。`import './app.js'`のようなimportに出会っても、`.js`という拡張子表記のまま`app.ts`を読みに行くように解決してくれる。これにより、開発中は「本番相当のimportパスの書き方」を保ったまま、コンパイルの手間なしにコードを実行できる。

## まとめ

- `import '...app.js'`の`.js`は、今存在するファイルの拡張子ではなく、`tsc`でビルドした後に存在することになるファイルの拡張子を書いている。
- `"module": "NodeNext"`設定下のTypeScriptは、importパスを書き換えないためこの表記が必須になる。
- 開発時は`tsx`が、本番相当のパス表記のまま`.ts`ファイルを実行できるようにしている。
