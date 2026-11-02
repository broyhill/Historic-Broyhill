// Proof: the compiler produces 600px email-safe table HTML plus a plain-text fallback, injects
// the compliance footer, refuses tag leakage, and section locks hold for non-admins.
//   npm run proof:compile   (writes proof-output/sample.html and proof-output/sample.txt)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createUnsubscribeToken, unsubscribeUrl } from '../lib/compliance/unsubscribe';
import { validateTemplateEdit, type EmailBlock } from '../lib/templates/blocks';
import { compileEmail, CompileError } from '../lib/templates/compiler';
import { DEFAULT_PHYSICAL_ADDRESS } from '../lib/config';
import { SAMPLE_BLOCKS, SAMPLE_COMPOSITION, SAMPLE_HASH } from '../tests/fixtures';

async function main() {
  const token = await createUnsubscribeToken('silo-demo', 'sub-ada', 'dev-only-unsubscribe-secret-not-for-production-0001');
  const result = compileEmail(SAMPLE_BLOCKS, {
    subject: SAMPLE_COMPOSITION.subject,
    preheader: SAMPLE_COMPOSITION.preheader,
    merge: { firstName: 'Ada', lastName: 'Fixture', officeSought: 'NC Senate District 99 (fixture)', venueInterest: 'The Dock', candidateName: 'Demo Candidate' },
    compliance: {
      senderName: 'Demo Candidate',
      physicalAddress: DEFAULT_PHYSICAL_ADDRESS,
      paidForBy: 'Paid for by Demo Candidate Committee (dev fixture)',
      unsubscribeUrl: unsubscribeUrl('http://localhost:3000', 'demo-candidate', token),
    },
  });
  const dir = join(process.cwd(), 'proof-output');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sample.html'), result.html);
  writeFileSync(join(dir, 'sample.txt'), result.text);

  console.log('=== Compiled sample ===');
  console.log(`subject:          ${result.subject}`);
  console.log(`preheader:        ${result.preheader}`);
  console.log(`composition hash: ${SAMPLE_HASH}`);
  console.log(`html bytes:       ${Buffer.byteLength(result.html)}  text bytes: ${Buffer.byteLength(result.text)}`);
  console.log(`merge tags used:  ${result.mergeTagsUsed.join(', ')}`);
  console.log(`checks:           600px table=${/<table role="presentation" width="600"/.test(result.html)} max-width:600px=${result.html.includes('max-width:600px')} ` +
    `gold CTA=${result.html.includes('bgcolor="#D4AF37"')} <style> blocks=${(result.html.match(/<style/g) ?? []).length} ` +
    `address=${result.html.includes('3540 Clemmons Road')} unsubscribe=${result.html.includes('/unsubscribe?silo=demo-candidate')} leftover braces=${/\{\{|\}\}/.test(result.html + result.text)}`);
  console.log('\n--- plain-text fallback ---');
  console.log(result.text);
  console.log('--- html (first 40 lines) ---');
  console.log(result.html.split('\n').slice(0, 40).join('\n'));

  console.log('\n=== Leakage guard: unknown merge tag ===');
  try {
    compileEmail([{ id: 'b', type: 'text', content: 'Hi {{nickname}}' }], {
      subject: 'x', merge: {}, compliance: { senderName: 's', physicalAddress: DEFAULT_PHYSICAL_ADDRESS, unsubscribeUrl: 'http://localhost/u' },
    });
    console.log('UNEXPECTED: compiled');
    process.exitCode = 1;
  } catch (error) {
    console.log(`refused: ${(error as CompileError).issues.join('; ')}`);
  }

  console.log('\n=== Section lock: drafter edits the locked footer ===');
  const edited: EmailBlock[] = SAMPLE_BLOCKS.map((b) => (b.id === 'footer' ? { ...b, text: 'edited by drafter' } : b));
  console.log(`CAMPAIGN_DRAFTER issues: ${JSON.stringify(validateTemplateEdit(SAMPLE_BLOCKS, edited, 'CAMPAIGN_DRAFTER'))}`);
  console.log(`AGENCY_ADMIN issues:     ${JSON.stringify(validateTemplateEdit(SAMPLE_BLOCKS, edited, 'AGENCY_ADMIN'))}`);
  const removed = SAMPLE_BLOCKS.filter((b) => b.id !== 'header');
  console.log(`CANDIDATE_MANAGER removing locked header: ${JSON.stringify(validateTemplateEdit(SAMPLE_BLOCKS, removed, 'CANDIDATE_MANAGER'))}`);
  console.log(`\nwrote ${join('proof-output', 'sample.html')} and ${join('proof-output', 'sample.txt')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
