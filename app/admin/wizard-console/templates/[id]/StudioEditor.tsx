'use client';

import { useState } from 'react';
import { GOLD, HERO_PRESETS, type EmailBlock, type HeroPreset } from '@/lib/wizard/templates/blocks';

interface Props {
  templateId: string;
  initialName: string;
  initialVersion: number;
  initialBlocks: EmailBlock[];
  canLock: boolean;
  canEdit: boolean;
}

interface Preview {
  html: string;
  text: string;
  warnings: string[];
}

const NEW_BLOCK: Record<EmailBlock['type'], () => EmailBlock> = {
  header: () => ({ id: `header-${Date.now()}`, type: 'header', showPreheader: true }),
  hero: () => ({ id: `hero-${Date.now()}`, type: 'hero', preset: 'MAGNOLIA_ROOM' }),
  text: () => ({ id: `text-${Date.now()}`, type: 'text', content: 'Dear {{firstName}},' }),
  button: () => ({ id: `button-${Date.now()}`, type: 'button', label: 'RSVP', url: 'https://example.org/rsvp', color: GOLD }),
  divider: () => ({ id: `divider-${Date.now()}`, type: 'divider' }),
  footer: () => ({ id: `footer-${Date.now()}`, type: 'footer', text: 'Paid for by …' }),
};

export function StudioEditor({ templateId, initialName, initialVersion, initialBlocks, canLock, canEdit }: Props) {
  const [name, setName] = useState(initialName);
  const [version, setVersion] = useState(initialVersion);
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks);
  const [subject, setSubject] = useState('An invitation for {{firstName}}');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const editable = (block: EmailBlock) => canEdit && (!block.locked || canLock);
  const update = (index: number, patch: Partial<EmailBlock>) =>
    setBlocks((current) => current.map((b, i) => (i === index ? ({ ...b, ...patch } as EmailBlock) : b)));
  const move = (index: number, delta: number) =>
    setBlocks((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  async function compile() {
    setIssues([]);
    const response = await fetch(`/api/admin/templates/${templateId}/compile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ blocks, subject }),
    });
    const body = (await response.json()) as Preview & { issues?: string[]; error?: string };
    if (!response.ok) setIssues(body.issues ?? [body.error ?? 'Compile failed']);
    else setPreview(body);
  }

  async function save() {
    setStatus('Saving…');
    setIssues([]);
    const response = await fetch(`/api/admin/templates/${templateId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, blocks, version }),
    });
    const body = (await response.json()) as { template?: { version: number }; issues?: string[]; error?: string };
    if (!response.ok) {
      setIssues(body.issues ?? [body.error ?? 'Save failed']);
      setStatus(null);
      return;
    }
    setVersion(body.template?.version ?? version + 1);
    setStatus('Saved');
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
      <section style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <label>Template name<input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} /></label>
        <label>Preview subject<input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        {blocks.map((block, index) => (
          <div key={block.id} className="card" style={{ display: 'grid', gap: 8 }}>
            <div className="bar">
              <strong>{block.type}</strong>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {block.locked ? <span className="tag danger">locked</span> : null}
                {canLock ? (
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={Boolean(block.locked)} onChange={(e) => update(index, { locked: e.target.checked })} /> lock
                  </label>
                ) : null}
                <button type="button" className="secondary" onClick={() => move(index, -1)} disabled={!editable(block)} aria-label="Move up">↑</button>
                <button type="button" className="secondary" onClick={() => move(index, 1)} disabled={!editable(block)} aria-label="Move down">↓</button>
                <button type="button" className="secondary" onClick={() => setBlocks((c) => c.filter((_, i) => i !== index))} disabled={!editable(block)}>Remove</button>
              </span>
            </div>
            <BlockFields block={block} disabled={!editable(block)} onChange={(patch) => update(index, patch)} />
          </div>
        ))}
        {canEdit ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(NEW_BLOCK) as EmailBlock['type'][]).map((type) => (
              <button key={type} type="button" className="secondary" onClick={() => setBlocks((c) => [...c, NEW_BLOCK[type]()])}>+ {type}</button>
            ))}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void compile()}>Preview</button>
          {canEdit ? <button type="button" className="secondary" onClick={() => void save()}>Save</button> : null}
          {status ? <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>{status}</span> : null}
        </div>
        {issues.length ? <ul className="error">{issues.map((i) => <li key={i}>{i}</li>)}</ul> : null}
      </section>
      <section style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        {preview ? (
          <>
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} style={{ width: '100%', height: 640, border: '1px solid var(--line)', borderRadius: 10, background: '#fff' }} />
            <details className="card"><summary>Plain-text fallback</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{preview.text}</pre></details>
            {preview.warnings.length ? <ul style={{ color: 'var(--muted)' }}>{preview.warnings.map((w) => <li key={w}>{w}</li>)}</ul> : null}
          </>
        ) : <p style={{ color: 'var(--muted)' }}>Preview renders the 600px email and its plain-text fallback with sample merge values.</p>}
      </section>
    </div>
  );
}

function BlockFields({ block, disabled, onChange }: { block: EmailBlock; disabled: boolean; onChange: (patch: Partial<EmailBlock>) => void }) {
  switch (block.type) {
    case 'header':
      return (
        <>
          <label>Logo URL<input value={block.logoUrl ?? ''} disabled={disabled} onChange={(e) => onChange({ logoUrl: e.target.value || undefined })} /></label>
          <label>Candidate disclaimer<input value={block.disclaimer ?? ''} disabled={disabled} onChange={(e) => onChange({ disclaimer: e.target.value || undefined })} /></label>
        </>
      );
    case 'hero':
      return (
        <>
          <label>Venue preset
            <select value={block.preset} disabled={disabled} onChange={(e) => onChange({ preset: e.target.value as HeroPreset })}>
              {(Object.keys(HERO_PRESETS) as HeroPreset[]).map((p) => <option key={p} value={p}>{HERO_PRESETS[p].label}</option>)}
            </select>
          </label>
          <label>Image URL<input value={block.imageUrl ?? ''} disabled={disabled} onChange={(e) => onChange({ imageUrl: e.target.value || undefined })} /></label>
          <label>Alt text<input value={block.alt ?? ''} disabled={disabled} onChange={(e) => onChange({ alt: e.target.value || undefined })} /></label>
        </>
      );
    case 'text':
      return <label>Text — tokens: {'{{firstName}} {{lastName}} {{officeSought}} {{venueInterest}}'}<textarea rows={6} value={block.content} disabled={disabled} onChange={(e) => onChange({ content: e.target.value })} /></label>;
    case 'button':
      return (
        <>
          <label>Label<input value={block.label} disabled={disabled} onChange={(e) => onChange({ label: e.target.value })} /></label>
          <label>URL<input value={block.url} disabled={disabled} onChange={(e) => onChange({ url: e.target.value })} /></label>
          <label>Color<input value={block.color ?? GOLD} disabled={disabled} onChange={(e) => onChange({ color: e.target.value })} /></label>
        </>
      );
    case 'divider':
      return null;
    case 'footer':
      return <label>Footer disclaimer<textarea rows={3} value={block.text} disabled={disabled} onChange={(e) => onChange({ text: e.target.value })} /></label>;
  }
}
