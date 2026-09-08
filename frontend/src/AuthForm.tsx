import { useState, type FormEvent } from 'react';
import { login, signup } from './api';

interface AuthFormProps {
  onAuthenticated: (token: string) => void;
}

type Mode = 'login' | 'signup';

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await signup(email, password);
      }
      const token = await login(email, password);
      onAuthenticated(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認証に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h2>{mode === 'login' ? 'ログイン' : 'サインアップ'}</h2>
      <form onSubmit={handleSubmit}>
        <label>
          メールアドレス
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          パスワード
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {mode === 'login' ? 'ログイン' : 'サインアップして開始'}
        </button>
      </form>
      <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'アカウントを作成する' : 'すでにアカウントをお持ちの方はこちら'}
      </button>
    </section>
  );
}
