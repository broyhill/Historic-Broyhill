'use client';

import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ siloSlug: form.get('siloSlug'), email: form.get('email'), password: form.get('password') }),
    });
    setBusy(false);
    if (response.ok) window.location.assign('/admin');
    else setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Sign-in failed');
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Wizard of Oz</h1>
      <p style={{ color: 'var(--muted)' }}>Sign in to your candidate silo. Agency staff sign in to <code>broyhillgop</code>.</p>
      <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 12 }}>
        <label>Silo<input name="siloSlug" defaultValue="broyhillgop" autoComplete="organization" required /></label>
        <label>Email<input name="email" type="email" autoComplete="username" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}
