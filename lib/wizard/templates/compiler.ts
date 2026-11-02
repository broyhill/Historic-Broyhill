// Template compiler: blocks → email-client-safe HTML (tables, inline styles, 600px max width,
// fluid on mobile) + plain-text fallback. The compliance footer (paid-for-by, physical address,
// one-click unsubscribe) is appended by the compiler itself and cannot be removed by a template.
// Unknown or unresolved merge tags fail the compile: zero tag leakage reaches a recipient.

import { GOLD, HERO_PRESETS, type EmailBlock } from './blocks';

export const MERGE_TAGS = ['firstName', 'lastName', 'officeSought', 'venueInterest', 'candidateName'] as const;
export type MergeTag = (typeof MERGE_TAGS)[number];

const FALLBACKS: Record<MergeTag, string> = {
  firstName: 'Friend',
  lastName: '',
  officeSought: '',
  venueInterest: 'our upcoming event',
  candidateName: '',
};

export interface CompileContext {
  subject: string;
  preheader?: string | null;
  merge: Partial<Record<MergeTag, string | null | undefined>>;
  compliance: {
    senderName: string;
    physicalAddress: string;
    paidForBy?: string | null;
    unsubscribeUrl: string;
  };
}

export interface CompileResult {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  mergeTagsUsed: MergeTag[];
  warnings: string[];
}

export class CompileError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Template compile failed: ${issues.join('; ')}`);
    this.name = 'CompileError';
  }
}

const TAG = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

interface Renderer {
  used: Set<MergeTag>;
  issues: string[];
  warnings: string[];
  resolve(text: string, where: string): string;
}

function makeRenderer(ctx: CompileContext): Renderer {
  const used = new Set<MergeTag>();
  const issues: string[] = [];
  const warnings: string[] = [];
  return {
    used,
    issues,
    warnings,
    resolve(text, where) {
      const out = text.replace(TAG, (_whole, name: string) => {
        if (!(MERGE_TAGS as readonly string[]).includes(name)) {
          issues.push(`${where}: unknown merge tag {{${name}}}`);
          return '';
        }
        const tag = name as MergeTag;
        used.add(tag);
        const value = ctx.merge[tag]?.trim();
        if (value) return value;
        if (FALLBACKS[tag] === '') warnings.push(`${where}: {{${tag}}} had no value and rendered empty`);
        return FALLBACKS[tag];
      });
      if (/\{\{|\}\}/.test(out)) issues.push(`${where}: malformed merge tag syntax`);
      return out;
    },
  };
}

function paragraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const FONT = "font-family:Georgia,'Times New Roman',serif;";
const SANS = 'font-family:Helvetica,Arial,sans-serif;';

function row(inner: string, padding = '24px 32px'): string {
  return `<tr><td style="padding:${padding};">${inner}</td></tr>`;
}

function renderHtmlBlock(block: EmailBlock, r: Renderer, preheader: string): string {
  const where = `block "${block.id}"`;
  switch (block.type) {
    case 'header': {
      const logo = block.logoUrl
        ? `<img src="${escapeAttr(block.logoUrl)}" alt="${escapeAttr(block.logoAlt ?? '')}" width="160" style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:160px;">`
        : '';
      const disclaimer = block.disclaimer
        ? `<p style="margin:${logo ? '12px' : '0'} 0 0;${SANS}font-size:11px;line-height:16px;color:#6b6b6b;">${escapeHtml(r.resolve(block.disclaimer, where))}</p>`
        : '';
      const pre = block.showPreheader !== false && preheader
        ? `<p style="margin:8px 0 0;${SANS}font-size:13px;line-height:18px;color:#444444;">${escapeHtml(preheader)}</p>`
        : '';
      return row(`${logo}${pre}${disclaimer}`, '24px 32px 8px');
    }
    case 'hero': {
      const preset = HERO_PRESETS[block.preset];
      const alt = block.alt ?? preset.alt;
      const caption = block.caption ? r.resolve(block.caption, where) : block.preset === 'CUSTOM' ? '' : preset.label;
      const image = block.imageUrl
        ? `<img src="${escapeAttr(block.imageUrl)}" alt="${escapeAttr(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;">`
        : '';
      const cap = caption
        ? `<p style="margin:0;padding:${image ? '12px 32px 0' : '28px 32px'};${FONT}font-size:22px;line-height:28px;color:#1b1d23;${image ? '' : `background-color:#efece3;border-left:4px solid ${GOLD};`}">${escapeHtml(caption)}</p>`
        : '';
      return `<tr><td style="padding:0;">${image}${cap}</td></tr>`;
    }
    case 'text': {
      const html = paragraphs(r.resolve(block.content, where))
        .map((p) => `<p style="margin:0 0 16px;${FONT}font-size:17px;line-height:26px;color:#1b1d23;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
      return row(html, '16px 32px 0');
    }
    case 'button': {
      const bg = block.color ?? GOLD;
      const fg = block.textColor ?? '#1b1d23';
      const label = escapeHtml(r.resolve(block.label, where));
      // Bulletproof button: the table cell carries the color so it survives image blocking.
      return row(
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>` +
          `<td align="center" bgcolor="${bg}" style="border-radius:4px;background-color:${bg};">` +
          `<a href="${escapeAttr(block.url)}" target="_blank" style="display:inline-block;padding:14px 28px;${SANS}font-size:16px;font-weight:bold;line-height:20px;color:${fg};text-decoration:none;border-radius:4px;">${label}</a>` +
          `</td></tr></table>`,
        '8px 32px 24px',
      );
    }
    case 'divider':
      return row('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #ddd8cc;font-size:0;line-height:0;">&nbsp;</td></tr></table>', '8px 32px');
    case 'footer':
      return row(
        `<p style="margin:0;${SANS}font-size:12px;line-height:18px;color:#5d6068;">${escapeHtml(r.resolve(block.text, where)).replace(/\n/g, '<br>')}</p>`,
        '16px 32px 0',
      );
  }
}

function renderTextBlock(block: EmailBlock, r: Renderer): string {
  const where = `block "${block.id}"`;
  switch (block.type) {
    case 'header':
      return block.disclaimer ? r.resolve(block.disclaimer, where) : '';
    case 'hero':
      return block.caption ? r.resolve(block.caption, where) : block.preset === 'CUSTOM' ? '' : HERO_PRESETS[block.preset].label;
    case 'text':
      return paragraphs(r.resolve(block.content, where)).join('\n\n');
    case 'button':
      return `${r.resolve(block.label, where)}: ${block.url}`;
    case 'divider':
      return '----------------------------------------';
    case 'footer':
      return r.resolve(block.text, where);
  }
}

function normalizeDisclosure(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim().toLowerCase();
}

// True when a template block already carries the paid-for-by text, so it is not printed twice.
export function templateDisclosesPaidForBy(blocks: EmailBlock[], paidForBy: string | null | undefined): boolean {
  if (!paidForBy?.trim()) return false;
  const needle = normalizeDisclosure(paidForBy);
  return blocks.some((b) =>
    (b.type === 'footer' && normalizeDisclosure(b.text).includes(needle)) ||
    (b.type === 'header' && b.disclaimer !== undefined && normalizeDisclosure(b.disclaimer).includes(needle)));
}

export function complianceFooter(ctx: CompileContext['compliance'], omitPaidForBy = false): { html: string; text: string } {
  const lines = [
    ctx.paidForBy && !omitPaidForBy ? ctx.paidForBy : null,
    `Sent by ${ctx.senderName}`,
    ctx.physicalAddress,
  ].filter((line): line is string => Boolean(line));
  const html = row(
    lines.map((l) => `<p style="margin:0 0 4px;${SANS}font-size:11px;line-height:16px;color:#6b6b6b;">${escapeHtml(l)}</p>`).join('') +
      `<p style="margin:8px 0 0;${SANS}font-size:11px;line-height:16px;"><a href="${escapeAttr(ctx.unsubscribeUrl)}" style="color:#6b6b6b;text-decoration:underline;">Unsubscribe from these emails</a></p>`,
    '20px 32px 28px',
  );
  const text = [...lines, `Unsubscribe: ${ctx.unsubscribeUrl}`].join('\n');
  return { html, text };
}

export function compileEmail(blocks: EmailBlock[], ctx: CompileContext): CompileResult {
  const r = makeRenderer(ctx);
  const subject = r.resolve(ctx.subject, 'subject').replace(/\s+/g, ' ').trim();
  const preheader = r.resolve(ctx.preheader ?? '', 'preheader').trim();
  if (!subject) r.issues.push('subject is required');
  if (!ctx.compliance.physicalAddress.trim()) r.issues.push('physical address is required');
  if (!ctx.compliance.unsubscribeUrl.trim()) r.issues.push('unsubscribe URL is required');
  if (!blocks.some((b) => b.type === 'text' || b.type === 'button')) r.issues.push('template needs at least one text or button block');

  const body = blocks.map((b) => renderHtmlBlock(b, r, preheader)).join('\n');
  const footer = complianceFooter(ctx.compliance, templateDisclosesPaidForBy(blocks, ctx.compliance.paidForBy));
  const textBody = blocks.map((b) => renderTextBlock(b, r)).filter(Boolean).join('\n\n');
  // HTML and text both resolve every block, so the same defect can be found twice.
  if (r.issues.length) throw new CompileError([...new Set(r.issues)]);

  const hiddenPreheader = preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="en" xmlns="http://www.w3.org/1999/xhtml">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">',
    `<title>${escapeHtml(subject)}</title></head>`,
    '<body style="margin:0;padding:0;background-color:#f4f2ec;">',
    hiddenPreheader,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f2ec;">',
    '<tr><td align="center" style="padding:24px 12px;">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border-collapse:collapse;">',
    body,
    footer.html,
    '</table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');

  const text = `${textBody}\n\n----------------------------------------\n${footer.text}\n`;

  // Belt and braces: nothing template-shaped may survive into either part.
  for (const [label, part] of [['html', html], ['text', text]] as const) {
    if (/\{\{|\}\}/.test(part)) throw new CompileError([`${label} output still contains merge-tag braces`]);
  }

  return { subject, preheader, html, text, mergeTagsUsed: [...r.used], warnings: [...new Set(r.warnings)] };
}
