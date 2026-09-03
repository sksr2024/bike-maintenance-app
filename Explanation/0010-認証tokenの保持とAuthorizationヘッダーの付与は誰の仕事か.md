# 0010 認証tokenの保持とAuthorizationヘッダーの付与は誰の仕事か

## 疑問の出発点

`POST /login` は `backend/src/routes/auth.ts:61-64` でこう実装されている。

```ts
const token = generateSessionToken();
await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

res.status(200).json({ token });
```

このレスポンスを受け取ったあと、tokenは「どこかに自動で保存される」のか、`GET /me` のような後続リクエストの `Authorization: Bearer xxx` ヘッダーは「誰かが自動で付けてくれる」のか、という疑問が出てくる。

結論は両方とも **NO**。HTTPのレスポンスは受け取った瞬間に終わる一過性のやり取りで、サーバーはレスポンスを送ったらそのことを忘れる。tokenを保存する処理も、次のリクエストにヘッダーを付ける処理も、クライアント側のコードが明示的に書かない限り何も起きない。この「明示的に書く」部分は、このリポジトリでは `frontend/src/` にまだ実装されていない（`App.tsx` は雛形のままで、ログイン画面やtoken管理コードは存在しない）。つまりこのプロジェクトは今ちょうど、この疑問に自分でコードを書いて答える段階にある。

## サーバー側で何が起きているか

このプロジェクトのtokenはJWTではなく、**ランダムな不透明文字列（opaque token）をDBに保存するセッション方式**になっている。

- `backend/src/auth/session.ts:6-8` の `generateSessionToken()` が `crypto.randomBytes(32).toString('hex')` で64文字のランダム文字列を生成する。JWTのように署名やペイロードをデコードして検証するのではなく、DBに存在するかどうかだけで真偽を判定する方式。
- ログイン成功時にこのtokenを `sessions` テーブルへ `user_id` と紐付けて保存する（`auth.ts:62`）。
- 認証が必要なエンドポイント（`GET /me`, `POST /logout`）は `requireAuth` ミドルウェア（`backend/src/auth/middleware.ts:5-26`）を経由する。ここで `extractBearerToken(req)` が `Authorization` ヘッダーから `Bearer ` プレフィックスを取り除いてtoken文字列を取り出し（`session.ts:10-13`）、`sessions` テーブルを `JOIN` して該当ユーザーを引き当てる。

つまりサーバー側の役目は「tokenを発行してDBに記録する」「ヘッダーからtokenを読み取ってDBと照合する」の2つだけで、tokenをクライアントのどこに置くか、次のリクエストにどう付けるかにはいっさい関与しない。

## クライアント側で書くべきコード（このリポジトリにはまだ無い部分）

フロントエンドを実装する際に必要になるのは、大きく分けて次の2つの処理。

**1. ログイン成功時にtokenを保存する**

```ts
const res = await fetch('/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const data = await res.json(); // { token: "a1b2c3..." }

localStorage.setItem('authToken', data.token);
```

保存先の選択肢と性質の違い：

| 保存先 | 消えるタイミング | JSから読めるか | 自動送信されるか |
|---|---|---|---|
| `localStorage` | 明示的に削除するかブラウザデータ削除まで残る | 読める（XSSに弱い） | されない（自分でヘッダーに付ける） |
| `sessionStorage` | タブを閉じると消える | 読める（XSSに弱い） | されない |
| Cookie（`httpOnly`） | サーバー側の有効期限や明示的な削除まで | 読めない（XSS耐性あり） | 同一オリジンへのリクエストで自動送信される |
| JS変数・Reactのstate | リロードで消える | 読める | されない |

このプロジェクトのバックエンドは `Set-Cookie` を使わず、レスポンスボディのJSONで直接tokenを返している（`auth.ts:64`）。この設計を選んだ以上、Cookieの「自動送信」の恩恵は受けられず、フロントエンド側で保存とヘッダー付与を両方自前で実装する必要がある。

**2. 認証が必要なリクエストにtokenをヘッダーで付ける**

```ts
const token = localStorage.getItem('authToken');

const res = await fetch('/me', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

`requireAuth` ミドルウェアは `Bearer ` プレフィックス付きの値を期待している（`session.ts:4, 12`）ので、フロントエンド側もこの形式に厳密に合わせる必要がある。毎回このコードを書くのは煩雑なので、fetchのラッパー関数を作るか、axiosを使うなら以下のようなインターセプターで一括処理するのが一般的。

```ts
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## このプロジェクトで次に必要になること

`frontend/src/App.tsx` にログイン画面とtoken管理を実装する段になったら、上記の「保存」と「ヘッダー付与」を両方自分で書く必要がある。バックエンドの `POST /logout`（`auth.ts:71-75`）はDBの `sessions` レコードを削除するだけなので、ログアウト時はそれに加えてフロントエンド側で `localStorage.removeItem('authToken')` のようにクライアント側の保存領域もあわせてクリアしないと、tokenが古いまま残ってしまう点に注意。
