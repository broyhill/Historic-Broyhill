'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

// Public capture form behind a QR placard / signage code: /capture?candidate=<slug>&room=<room>&method=QR_PLACARD
// Untrusted: it cannot set a VIP score, and nothing it submits is used as identity evidence.
function CaptureForm() {
  const params = useSearchParams();
  const candidateSlug = params.get('candidate') ?? '';
  const room = params.get('room') ?? '';
  const method = params.get('method') === 'QR_SIGNAGE' ? 'QR_SIGNAGE' : params.get('method') === 'QR_PLACARD' ? 'QR_PLACARD' : 'WEB_FORM';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/capture', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        candidateSlug,
        captureMethod: method,
        roomInterest: room || undefined,
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        email: form.get('email'),
        phone: form.get('phone') || undefined,
      }),
    });
    if (response.ok) setDone(true);
    else setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Something went wrong');
  }

  if (!candidateSlug) return <p className="error">This sign-up link is missing its candidate.</p>;
  if (done) return <div className="card"><h2 style={{ marginTop: 0 }}>Thank you</h2><p>We received your details.</p></div>;
  return (
    <form onSubmit={submit} className="card" style={{ display: 'grid', gap: 12 }}>
      <label>First name<input name="firstName" autoComplete="given-name" required /></label>
      <label>Last name<input name="lastName" autoComplete="family-name" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mobile (optional)<input name="phone" type="tel" autoComplete="tel" /></label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit">Stay in touch</button>
    </form>
  );
}

export default function CapturePage() {
  return (
    <main style={{ maxWidth: 480 }}>
      <h1>Stay in touch</h1>
      <Suspense fallback={null}>
        <CaptureForm />
      </Suspense>
    </main>
  );
}
