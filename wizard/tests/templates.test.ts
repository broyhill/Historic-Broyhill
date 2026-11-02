import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_PHYSICAL_ADDRESS } from '../lib/config';
import { BlockValidationError, defaultBlocks, parseBlocks, validateTemplateEdit, type EmailBlock } from '../lib/templates/blocks';
import { compileEmail, CompileError } from '../lib/templates/compiler';
import { compositionHash, planRevision } from '../lib/variants';
import { SAMPLE_BLOCKS } from './fixtures';

const compliance = { senderName: 'Demo Candidate', physicalAddress: DEFAULT_PHYSICAL_ADDRESS, paidForBy: 'Paid for by Demo Committee', unsubscribeUrl: 'https://example.org/unsubscribe?silo=demo&token=t' };

describe('compiler', () => {
  it('emits 600px table HTML, a plain-text fallback and the compliance footer', () => {
    const out = compileEmail(SAMPLE_BLOCKS, { subject: 'Hi {{firstName}}', merge: { firstName: 'Ada', venueInterest: 'The Dock', candidateName: 'Demo', officeSought: 'Office' }, compliance });
    assert.match(out.html, /<table role="presentation" width="600"/);
    assert.match(out.html, /max-width:600px/);
    assert.match(out.html, /bgcolor="#D4AF37"/);
    assert.doesNotMatch(out.html, /<style/);
    assert.match(out.html, /3540 Clemmons Road, Clemmons, NC 27012/);
    assert.match(out.text, /Unsubscribe: https:\/\/example\.org\/unsubscribe/);
    assert.equal(out.subject, 'Hi Ada');
    assert.doesNotMatch(out.html + out.text, /\{\{|\}\}/);
  });

  it('refuses unknown tags exactly once and escapes merge values', () => {
    assert.throws(
      () => compileEmail([{ id: 't', type: 'text', content: '{{nickname}}' }], { subject: 's', merge: {}, compliance }),
      (e: unknown) => e instanceof CompileError && e.issues.length === 1,
    );
    const out = compileEmail([{ id: 't', type: 'text', content: 'Hi {{firstName}}' }], { subject: 's', merge: { firstName: '<script>x</script>' }, compliance });
    assert.doesNotMatch(out.html, /<script>/);
    assert.match(out.html, /&lt;script&gt;/);
  });

  it('falls back instead of leaking an empty tag and warns once', () => {
    const out = compileEmail([{ id: 't', type: 'text', content: 'Dear {{firstName}} {{lastName}}' }], { subject: 's', merge: {}, compliance });
    assert.match(out.text, /Dear Friend/);
    assert.equal(out.warnings.length, 1);
  });

  it('does not print paid-for-by twice when the locked footer already carries it', () => {
    const blocks: EmailBlock[] = [{ id: 't', type: 'text', content: 'x' }, { id: 'f', type: 'footer', text: 'Paid for by Demo Committee.', locked: true }];
    const out = compileEmail(blocks, { subject: 's', merge: {}, compliance });
    assert.equal(out.text.match(/Paid for by Demo Committee/g)?.length, 1);
  });

  it('requires an address and an unsubscribe link', () => {
    assert.throws(() => compileEmail(SAMPLE_BLOCKS, { subject: 's', merge: {}, compliance: { ...compliance, physicalAddress: ' ' } }), CompileError);
    assert.throws(() => compileEmail(SAMPLE_BLOCKS, { subject: 's', merge: {}, compliance: { ...compliance, unsubscribeUrl: '' } }), CompileError);
  });
});

describe('blocks', () => {
  it('validates URLs, ids and types', () => {
    assert.throws(() => parseBlocks([{ id: 'b', type: 'button', label: 'x', url: 'javascript:alert(1)' }]), BlockValidationError);
    assert.throws(() => parseBlocks([{ id: 'a', type: 'divider' }, { id: 'a', type: 'divider' }]), BlockValidationError);
    assert.throws(() => parseBlocks([{ id: 'a', type: 'marquee' }]), BlockValidationError);
    assert.equal(parseBlocks(defaultBlocks('Paid for by X')).length, 6);
  });

  it('enforces section locks for every role except AGENCY_ADMIN', () => {
    const edited = SAMPLE_BLOCKS.map((b) => (b.id === 'footer' ? { ...b, text: 'changed' } : b));
    const unlocked = SAMPLE_BLOCKS.map((b) => (b.id === 'header' ? { ...b, locked: false } : b));
    const newlyLocked = SAMPLE_BLOCKS.map((b) => (b.id === 'body' ? { ...b, locked: true } : b));
    for (const role of ['CAMPAIGN_DRAFTER', 'CANDIDATE_MANAGER', 'COMPLIANCE_VIEWER'] as const) {
      assert.equal(validateTemplateEdit(SAMPLE_BLOCKS, edited, role).length, 1);
      assert.equal(validateTemplateEdit(SAMPLE_BLOCKS, unlocked, role).length, 1);
      assert.equal(validateTemplateEdit(SAMPLE_BLOCKS, newlyLocked, role).length, 1);
      assert.equal(validateTemplateEdit(SAMPLE_BLOCKS, SAMPLE_BLOCKS.filter((b) => b.id !== 'footer'), role).length, 1);
    }
    assert.deepEqual(validateTemplateEdit(SAMPLE_BLOCKS, edited, 'AGENCY_ADMIN'), []);
  });
});

describe('variants (sent messages are immutable)', () => {
  const base = { subject: 's', preheader: null, blocks: SAMPLE_BLOCKS };
  it('hashes compositions deterministically regardless of key order', () => {
    const reordered = SAMPLE_BLOCKS.map((b) => Object.fromEntries(Object.entries(b).reverse()) as unknown as EmailBlock);
    assert.equal(compositionHash(base), compositionHash({ ...base, blocks: reordered }));
    assert.notEqual(compositionHash(base), compositionHash({ ...base, subject: 't' }));
  });
  it('creates a child variant once frozen, updates in place before', () => {
    const hash = compositionHash(base);
    const changed = { ...base, subject: 'new' };
    assert.equal(planRevision(null, base).action, 'CREATE_FIRST');
    assert.equal(planRevision({ id: 'v1', version: 1, contentHash: hash, frozenAt: null }, base).action, 'NO_CHANGE');
    assert.equal(planRevision({ id: 'v1', version: 1, contentHash: hash, frozenAt: null }, changed).action, 'UPDATE_IN_PLACE');
    const child = planRevision({ id: 'v1', version: 1, contentHash: hash, frozenAt: new Date() }, changed);
    assert.deepEqual([child.action, 'parentVariantId' in child && child.parentVariantId, 'version' in child && child.version], ['CREATE_CHILD', 'v1', 2]);
  });
});
