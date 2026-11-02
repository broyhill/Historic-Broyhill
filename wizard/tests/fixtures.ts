// Shared in-memory fixture for tests and proofs. Every name, address and id is synthetic
// (RFC 2606 example.com/example.org); nothing here is a real person, donor or committee.

import { DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME, DEFAULT_PHYSICAL_ADDRESS, AUTHORIZATION_PHRASE } from '../lib/config';
import { emptyState, type MemoryState } from '../lib/dispatch/store-memory';
import { GOLD, type EmailBlock } from '../lib/templates/blocks';
import { compositionHash } from '../lib/variants';

export const AGENCY_ID = 'agency-dev';
export const DEMO_SILO = 'silo-demo';
export const DEFAULT_SILO = 'silo-broyhillgop';

export const SAMPLE_BLOCKS: EmailBlock[] = [
  { id: 'header', type: 'header', showPreheader: true, disclaimer: 'Official communication of Demo Candidate (dev fixture).', locked: true },
  { id: 'hero', type: 'hero', preset: 'MAGNOLIA_ROOM', caption: 'An evening in {{venueInterest}}' },
  { id: 'body', type: 'text', content: 'Dear {{firstName}},\n\nThank you for joining us. {{candidateName}}, candidate for {{officeSought}}, hopes to see you again.\n\nWith appreciation.' },
  { id: 'cta', type: 'button', label: 'RSVP for {{venueInterest}}', url: 'https://example.org/rsvp', color: GOLD },
  { id: 'divider', type: 'divider' },
  { id: 'footer', type: 'footer', text: 'Paid for by Demo Candidate Committee (dev fixture).', locked: true },
];

export const SAMPLE_COMPOSITION = { subject: 'An invitation for {{firstName}}', preheader: 'Reception details inside', blocks: SAMPLE_BLOCKS };
export const SAMPLE_HASH = compositionHash(SAMPLE_COMPOSITION);

export function demoState(): MemoryState {
  const state = emptyState();
  state.silos.push(
    {
      id: DEMO_SILO, slug: 'demo-candidate', agencyId: AGENCY_ID, bgopCandidateId: null,
      candidateName: 'Demo Candidate', committeeId: 'STA-DEV-0001', officeSought: 'NC Senate District 99 (fixture)',
      fromName: DEFAULT_FROM_NAME, fromEmail: DEFAULT_FROM_EMAIL, replyToEmail: null,
      physicalAddress: DEFAULT_PHYSICAL_ADDRESS, paidForBy: 'Paid for by Demo Candidate Committee (dev fixture)',
    },
    {
      id: DEFAULT_SILO, slug: 'broyhillgop', agencyId: AGENCY_ID, bgopCandidateId: null,
      candidateName: null, committeeId: null, officeSought: null,
      fromName: DEFAULT_FROM_NAME, fromEmail: DEFAULT_FROM_EMAIL, replyToEmail: null,
      physicalAddress: DEFAULT_PHYSICAL_ADDRESS, paidForBy: null,
    },
  );
  const sub = (id: string, candidateId: string, email: string, firstName: string, rncRegId: string | null, venueInterest: string | null = 'The Dock') => ({
    subscriberId: id, candidateId, email, firstName, lastName: 'Fixture', venueInterest, rncRegId,
    vipScore: 80, phone: null, identityState: rncRegId ? ('RNC_REGID_EXACT' as const) : ('HELD_MISSING_EVIDENCE' as const),
  });
  state.subscribers.push(
    sub('sub-ada', DEMO_SILO, 'ada@example.com', 'Ada', 'RNC-DEV-0001'),
    sub('sub-bo', DEMO_SILO, 'bo@example.com', 'Bo', null),
    sub('sub-cy', DEMO_SILO, 'cy@example.com', 'Cy', 'RNC-DEV-0003'),
    sub('sub-di', DEMO_SILO, 'di@example.com', 'Di', 'RNC-DEV-0004'),
    sub('sub-eve', DEFAULT_SILO, 'eve@example.com', 'Eve', 'RNC-DEV-0005'),
  );
  // sub-eve is in another silo but listed here on purpose: silo isolation must exclude her.
  for (const subscriberId of ['sub-ada', 'sub-bo', 'sub-cy', 'sub-di', 'sub-eve']) state.listMembers.push({ listId: 'list-1', subscriberId });
  state.siloSuppressions.push({ candidateId: DEMO_SILO, email: 'cy@example.com', level: 'BULK_ONLY', reason: 'one-click unsubscribe' });
  state.globalSuppressions.push({ agencyId: AGENCY_ID, email: 'di@example.com', level: 'ALL_EMAIL', reason: 'hard bounce' });
  state.campaigns.push({
    id: 'cmp-1', candidateId: DEMO_SILO, status: 'PUBLISHED', channel: 'EMAIL', messageClass: 'BULK',
    reviewedByRole: 'CANDIDATE_MANAGER', audienceListId: 'list-1', audienceSegmentId: null, recipientSubscriberId: null,
    originAgentKey: null,
  });
  state.variants.push({
    id: 'var-1', campaignId: 'cmp-1', version: 1, subject: SAMPLE_COMPOSITION.subject, preheader: SAMPLE_COMPOSITION.preheader,
    blocks: SAMPLE_BLOCKS, contentHash: SAMPLE_HASH, frozenAt: new Date('2026-10-15T12:00:00Z'),
  });
  state.authorizations.push({ id: 'auth-1', variantId: 'var-1', contentHash: SAMPLE_HASH, phrase: AUTHORIZATION_PHRASE, authorizedByPrincipal: true });
  state.killSwitch[AGENCY_ID] = true;
  return state;
}
