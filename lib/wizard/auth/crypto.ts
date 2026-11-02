// Web Crypto helpers, so the same code runs in Next middleware (edge) and route handlers (node).
// Pattern reused from the prior admin-auth helper (README §Provenance): Web Crypto HMAC, constant-time compare.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function encodeJson(value: unknown): string {
  return toBase64Url(encoder.encode(JSON.stringify(value)));
}

export function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(decoder.decode(fromBase64Url(value))) as T;
  } catch {
    return null;
  }
}

async function hmacKey(secret: Uint8Array): Promise<CryptoKey> {
  // Copy into an ArrayBuffer-backed view: Web Crypto rejects SharedArrayBuffer-backed input.
  return crypto.subtle.importKey('raw', new Uint8Array(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmacSha256(secret: string | Uint8Array, message: string): Promise<Uint8Array> {
  const keyBytes = typeof secret === 'string' ? encoder.encode(secret) : secret;
  const key = await hmacKey(keyBytes);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

export async function hmacBase64Url(secret: string, message: string): Promise<string> {
  return toBase64Url(await hmacSha256(secret, message));
}

export async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(message));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
