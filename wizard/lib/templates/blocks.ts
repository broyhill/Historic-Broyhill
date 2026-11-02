// Visual Block Studio schema (Weapon 7). Blocks are stored as JSON on EmailTemplate.blocks.
// A block with locked=true is agency-owned: only AGENCY_ADMIN may change, move out, or unlock it.

import type { UserRole } from '@prisma/client';

export const GOLD = '#D4AF37';

export const HERO_PRESETS = {
  MAGNOLIA_ROOM: { label: 'The Magnolia Room', alt: 'The Magnolia Room event space' },
  THE_BOARDROOMS: { label: 'The Boardrooms', alt: 'The Boardrooms meeting space' },
  THE_DOCK: { label: 'The Dock', alt: 'The Dock event space' },
  THE_LOFT: { label: 'The Loft', alt: 'The Loft event space' },
  CUSTOM: { label: 'Custom image', alt: '' },
} as const;
export type HeroPreset = keyof typeof HERO_PRESETS;

interface BlockBase {
  id: string;
  locked?: boolean;
}
export interface HeaderBlock extends BlockBase {
  type: 'header';
  logoUrl?: string;
  logoAlt?: string;
  showPreheader?: boolean;
  disclaimer?: string; // official candidate disclaimer line
}
export interface HeroBlock extends BlockBase {
  type: 'hero';
  preset: HeroPreset;
  imageUrl?: string;
  alt?: string;
  caption?: string;
}
export interface TextBlock extends BlockBase {
  type: 'text';
  content: string; // plain text; blank line = new paragraph; merge tags {{firstName}} etc.
}
export interface ButtonBlock extends BlockBase {
  type: 'button';
  label: string;
  url: string;
  color?: string;
  textColor?: string;
}
export interface DividerBlock extends BlockBase {
  type: 'divider';
}
export interface FooterBlock extends BlockBase {
  type: 'footer';
  text: string; // agency disclaimer; the compliance footer is appended separately and always
}

export type EmailBlock = HeaderBlock | HeroBlock | TextBlock | ButtonBlock | DividerBlock | FooterBlock;
export const BLOCK_TYPES = ['header', 'hero', 'text', 'button', 'divider', 'footer'] as const;

export class BlockValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid template blocks: ${issues.join('; ')}`);
    this.name = 'BlockValidationError';
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_TEXT = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(raw: Record<string, unknown>, key: string, issues: string[], where: string): string | undefined {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    issues.push(`${where}.${key} must be a string`);
    return undefined;
  }
  if (value.length > MAX_TEXT) issues.push(`${where}.${key} exceeds ${MAX_TEXT} characters`);
  return value;
}

function requiredString(raw: Record<string, unknown>, key: string, issues: string[], where: string): string {
  const value = optionalString(raw, key, issues, where);
  if (!value) issues.push(`${where}.${key} is required`);
  return value ?? '';
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parseBlocks(input: unknown): EmailBlock[] {
  const issues: string[] = [];
  if (!Array.isArray(input)) throw new BlockValidationError(['blocks must be an array']);
  const seen = new Set<string>();
  const blocks: EmailBlock[] = [];

  input.forEach((raw, index) => {
    const where = `blocks[${index}]`;
    if (!isRecord(raw)) {
      issues.push(`${where} must be an object`);
      return;
    }
    const id = typeof raw.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.id) ? raw.id : '';
    if (!id) issues.push(`${where}.id must be 1-64 chars [A-Za-z0-9_-]`);
    else if (seen.has(id)) issues.push(`${where}.id "${id}" is duplicated`);
    seen.add(id);
    const locked = raw.locked === true;

    switch (raw.type) {
      case 'header':
        blocks.push({
          id, type: 'header', locked,
          logoUrl: optionalString(raw, 'logoUrl', issues, where),
          logoAlt: optionalString(raw, 'logoAlt', issues, where),
          showPreheader: raw.showPreheader !== false,
          disclaimer: optionalString(raw, 'disclaimer', issues, where),
        });
        break;
      case 'hero': {
        const preset = typeof raw.preset === 'string' && raw.preset in HERO_PRESETS ? (raw.preset as HeroPreset) : null;
        if (!preset) issues.push(`${where}.preset must be one of ${Object.keys(HERO_PRESETS).join(', ')}`);
        const imageUrl = optionalString(raw, 'imageUrl', issues, where);
        if (imageUrl && !isSafeHttpUrl(imageUrl)) issues.push(`${where}.imageUrl must be an http(s) URL`);
        const alt = optionalString(raw, 'alt', issues, where);
        if (imageUrl && !alt && (preset ?? 'CUSTOM') === 'CUSTOM') issues.push(`${where}.alt is required for a custom image`);
        blocks.push({ id, type: 'hero', locked, preset: preset ?? 'CUSTOM', imageUrl, alt, caption: optionalString(raw, 'caption', issues, where) });
        break;
      }
      case 'text':
        blocks.push({ id, type: 'text', locked, content: requiredString(raw, 'content', issues, where) });
        break;
      case 'button': {
        const url = requiredString(raw, 'url', issues, where);
        if (url && !isSafeHttpUrl(url)) issues.push(`${where}.url must be an http(s) URL`);
        const color = optionalString(raw, 'color', issues, where);
        const textColor = optionalString(raw, 'textColor', issues, where);
        if (color && !HEX.test(color)) issues.push(`${where}.color must be #RRGGBB`);
        if (textColor && !HEX.test(textColor)) issues.push(`${where}.textColor must be #RRGGBB`);
        blocks.push({ id, type: 'button', locked, label: requiredString(raw, 'label', issues, where), url, color, textColor });
        break;
      }
      case 'divider':
        blocks.push({ id, type: 'divider', locked });
        break;
      case 'footer':
        blocks.push({ id, type: 'footer', locked, text: requiredString(raw, 'text', issues, where) });
        break;
      default:
        issues.push(`${where}.type must be one of ${BLOCK_TYPES.join(', ')}`);
    }
  });

  if (issues.length) throw new BlockValidationError(issues);
  return blocks;
}

function stable(block: EmailBlock): string {
  return JSON.stringify(block, Object.keys(block).sort());
}

// Section-lock enforcement (SectionLockToggle). Non-admins may not alter, remove, unlock or
// create locked blocks. Agency admins may do all of it.
export function validateTemplateEdit(previous: EmailBlock[], next: EmailBlock[], role: UserRole): string[] {
  if (role === 'AGENCY_ADMIN') return [];
  const issues: string[] = [];
  const nextById = new Map(next.map((b) => [b.id, b]));
  const prevById = new Map(previous.map((b) => [b.id, b]));
  for (const block of previous) {
    if (!block.locked) continue;
    const after = nextById.get(block.id);
    if (!after) issues.push(`Locked block "${block.id}" (${block.type}) cannot be removed`);
    else if (stable(after) !== stable(block)) issues.push(`Locked block "${block.id}" (${block.type}) cannot be changed or unlocked`);
  }
  for (const block of next) {
    if (block.locked && !prevById.get(block.id)?.locked) issues.push(`Only agency admins may lock block "${block.id}"`);
  }
  return issues;
}

// Starter layout for a new template. Footer disclaimer is agency-locked from birth.
export function defaultBlocks(disclaimer: string): EmailBlock[] {
  return [
    { id: 'header', type: 'header', showPreheader: true, disclaimer, locked: true },
    { id: 'hero', type: 'hero', preset: 'MAGNOLIA_ROOM' },
    { id: 'body', type: 'text', content: 'Dear {{firstName}},\n\nThank you for joining us.' },
    { id: 'cta', type: 'button', label: 'RSVP', url: 'https://example.org/rsvp', color: GOLD },
    { id: 'divider', type: 'divider' },
    { id: 'footer', type: 'footer', text: disclaimer, locked: true },
  ];
}
