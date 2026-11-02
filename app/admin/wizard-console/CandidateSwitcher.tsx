'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface SwitcherOption {
  slug: string;
  label: string;
}

// Top-bar switcher (Track A step 4). Sets broyhill_active_silo through the API — which validates
// access with the same resolver every request uses — then refreshes the console.
export function CandidateSwitcher({ options, current }: { options: SwitcherOption[]; current: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function change(slug: string) {
    setError(null);
    const response = await fetch('/api/admin/silos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug }),
    });
    if (!response.ok) {
      setError(((await response.json().catch(() => ({}))) as { error?: string }).error ?? 'Switch failed');
      return;
    }
    router.refresh();
  }

  return (
    <label style={{ minWidth: 260 }}>
      Workspace
      <select value={current} onChange={(e) => void change(e.target.value)} aria-label="Candidate workspace">
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>{o.label}</option>
        ))}
      </select>
      {error ? <span className="error" role="alert">{error}</span> : null}
    </label>
  );
}
