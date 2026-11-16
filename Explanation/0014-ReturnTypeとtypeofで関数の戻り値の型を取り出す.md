# ReturnTypeとtypeofで関数の戻り値の型を取り出す

## 何が書かれているか

[backend/test/helpers/auth.ts](../backend/test/helpers/auth.ts)の`signupAndLogin`関数は、引数の型をこう書いている。

```ts
import type { createApp } from '../../src/app.js';

export async function signupAndLogin(
  app: ReturnType<typeof createApp>,
  email = DEFAULT_EMAIL,
  password = DEFAULT_PASSWORD,
): Promise<string> {
```

`ReturnType<typeof createApp>`は、2つのTypeScript機能を組み合わせて「`createApp`関数が返す値と同じ型」を表している。

## typeof: 値から型を取り出す

TypeScriptには「値の世界」と「型の世界」があり、型を書く場所（`:`の後ろなど）に値の名前をそのまま書くことはできない。`typeof`を型の文脈で使うと、その値が持つ型を取得できる。

[backend/src/app.ts](../backend/src/app.ts)の定義。

```ts
export function createApp(): Express {
  // ...
  return app;
}
```

この場合、`typeof createApp`は関数のシグネチャの型、つまり`() => Express`を意味する。

## ReturnType\<T\>: 関数の型から戻り値の型だけを抜き出す

`ReturnType`はTypeScript標準のユーティリティ型で、「引数に渡した関数の型」から「戻り値の型」だけを取り出す。

```ts
type T1 = ReturnType<() => Express>;  // T1 は Express
```

2つを組み合わせると次のようになる。

```ts
ReturnType<typeof createApp>
// = ReturnType<() => Express>
// = Express
```

このプロジェクトでは`createApp`の戻り値型が明示的に`Express`と書かれているため、結果としては素直に`app: Express`と書いた場合と同じ型になる。

## なぜ素直に`Express`と書かないのか

`Express`と直接書いても動作は変わらない。それでも`ReturnType<typeof createApp>`と書くことには利点がある。

- **「`createApp()`が返すもの」という関係を型で表現できる**。このヘルパーが本当に受け取りたいのは「`createApp()`で作られたExpressアプリ」であり、「たまたま`Express`型を持つ何か」ではない。意図がコードにそのまま表れる。
- **`createApp`の戻り値型が将来変わっても自動で追従する**。例えば`createApp`が`Express`をラップした独自の型を返すように変更された場合、`ReturnType<typeof createApp>`を使っている箇所は何も書き換えなくても正しい型になる。`Express`と直書きしていた場合は、その箇所を手動で探して書き換える必要がある。

## importの`type`にも注目

[backend/test/helpers/auth.ts](../backend/test/helpers/auth.ts)の1行目は`import type { createApp } from '../../src/app.js';`となっている。`import type`は「型情報だけが欲しく、実行時にこの関数自体を呼び出すわけではない」ことを示す書き方。実際、このファイルは`createApp`を呼び出さず、`ReturnType<typeof createApp>`として型を取り出す目的だけで使っている。

この書き方は、テストコードが本番のアプリケーションコード（[backend/src/app.ts](../backend/src/app.ts)）の形にそのまま追従するように作られているという、このプロジェクトの設計方針の一例でもある（[0017](0017-Vitestはなぜテストのときしか使われないのか.md)で触れた「テストは本番コードを利用する側」という関係性）。
