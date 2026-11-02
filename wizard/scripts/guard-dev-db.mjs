#!/usr/bin/env node
// Refuses to let prisma db push / seed touch anything but a local development database, and
// refuses schema changes without Ed's exact phrase (Ed, 2026-10-15: "Schema changes need my
// 'I AUTHORIZE THIS ACTION.'"). Hetzner production hosts are refused by name and by address.

const PHRASE = 'I AUTHORIZE THIS ACTION';
const PRODUCTION_HOSTS = new Set(['37.27.169.232', '144.76.219.24', '5.9.99.109', '37-27-169-232.nip.io', 'broyhillgop-db']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function fail(message) {
  console.error(`guard-dev-db: REFUSED — ${message}`);
  process.exit(1);
}

const raw = process.env.WIZARD_AGENCY_DATABASE_URL;
if (!raw) fail('WIZARD_AGENCY_DATABASE_URL is not set');
let url;
try {
  url = new URL(raw);
} catch {
  fail('WIZARD_AGENCY_DATABASE_URL is not a valid URL');
}
const host = url.hostname.toLowerCase();
if (PRODUCTION_HOSTS.has(host)) fail(`${host} is a BroyhillGOP production host`);
if (!LOCAL_HOSTS.has(host) && !host.endsWith('.localhost')) fail(`${host} is not a local development host`);
if (url.searchParams.get('schema') !== 'wizard_agency') fail('the URL must pin ?schema=wizard_agency (isolated from every platform schema)');
if (/push/.test(process.env.npm_lifecycle_event ?? '') && process.env.WIZARD_SCHEMA_AUTHORIZATION !== PHRASE) {
  fail(`schema changes need WIZARD_SCHEMA_AUTHORIZATION="${PHRASE}" set by Ed for this run`);
}
console.log(`guard-dev-db: OK — ${host}/${url.pathname.slice(1)} schema=wizard_agency`);
