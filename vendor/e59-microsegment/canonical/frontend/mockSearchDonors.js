/**
 * mockSearchDonors — read-only synthetic donor universe for E59 prototype.
 *
 * 12,000 donors generated with realistic BGOP variable distributions matching
 * the canonical core.donor_profile shape (donor-centric-architecture skill).
 *
 * NEVER USED FOR WRITES. NEVER TOUCHES SACRED CANARY cluster 372171.
 * Replace this file with a real searchDonors() API call when wiring to production.
 *
 * Schema (mocked):
 *   donor_id          : string (synthetic)
 *   name_on_ballot    : string
 *   grade             : 'A++' | 'A+' | 'A' | 'A-' | 'B+' | ... | 'D-' | 'U'
 *   intensity         : int 0-1000 (Cat 13)
 *   coalition_flags   : Set<string>  ← AND/OR test field
 *   issue_affinity    : Set<string>  ← AND/OR test field
 *   recent_events     : Set<string>  ← Include/Exclude test field
 *   districts         : Set<string>  ← Include/Exclude test field (district-native)
 *   capacity_tier     : 'principal' | 'major' | 'mid' | 'mass'
 */

const COALITION_FLAGS = [
  '2A', 'pro_life', 'veteran', 'sportsmen', 'evangelical', 'small_business',
];
const ISSUES = [
  'taxes', 'border', 'education', 'energy', 'healthcare', 'crime', 'china',
  'judges', 'religious_liberty', 'small_biz', 'school_choice', 'spending',
  'elections', 'agriculture', 'second_amendment',
];
const EVENTS = [
  'maxed_out', 'first_time', 'lapsed', 'reactivated', 'new_filing', 'bundler_active',
];
const GRADES = ['A++', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'U'];
const CAPACITY = ['principal', 'major', 'mid', 'mass'];

// District universe — small synthetic set for prototype
const DISTRICTS = [];
for (let i = 1; i <= 120; i++) DISTRICTS.push(`HD-${String(i).padStart(3, '0')}`);
for (let i = 1; i <= 50;  i++) DISTRICTS.push(`SD-${String(i).padStart(2, '0')}`);
for (let i = 1; i <= 14;  i++) DISTRICTS.push(`CD-${String(i).padStart(2, '0')}`);
DISTRICTS.push('US_SENATE_NC', 'US_PRESIDENT');

const FIRST_NAMES = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','William','Elizabeth','David','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen','Christopher','Nancy','Daniel','Lisa','Matthew','Margaret','Anthony','Betty','Mark','Sandra'];
const LAST_NAMES  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker','Young','Allen','King','Wright'];

// Deterministic PRNG so the dataset is reproducible
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(372171);  // canary cluster as seed — read-only, doctrinal nod

function pickN(arr, n, r) {
  // Weighted random subset, biased toward fewer picks
  const out = new Set();
  while (out.size < n) out.add(arr[Math.floor(r() * arr.length)]);
  return out;
}

function buildUniverse() {
  const universe = [];
  for (let i = 0; i < 12000; i++) {
    const intensity = Math.floor(rand() * 1000);
    let gradeIdx;
    // Grade follows realistic 13-tier distribution: top-heavy U, sparse A++
    const r = rand();
    if (r < 0.02) gradeIdx = 0;        // A++ 2%
    else if (r < 0.06) gradeIdx = 1;   // A+ 4%
    else if (r < 0.12) gradeIdx = 2;   // A  6%
    else if (r < 0.20) gradeIdx = 3;   // A- 8%
    else if (r < 0.32) gradeIdx = 4;   // B+ 12%
    else if (r < 0.45) gradeIdx = 5;
    else if (r < 0.58) gradeIdx = 6;
    else if (r < 0.68) gradeIdx = 7;
    else if (r < 0.77) gradeIdx = 8;
    else if (r < 0.85) gradeIdx = 9;
    else if (r < 0.91) gradeIdx = 10;
    else if (r < 0.96) gradeIdx = 11;
    else if (r < 0.99) gradeIdx = 12;
    else gradeIdx = 13;                // U  1%

    universe.push({
      donor_id: `D-${String(i + 1).padStart(6, '0')}`,
      name_on_ballot: `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`,
      grade: GRADES[gradeIdx],
      intensity,
      capacity_tier: CAPACITY[Math.min(3, Math.floor(gradeIdx / 3.5))],
      coalition_flags: pickN(COALITION_FLAGS, 1 + Math.floor(rand() * 3), rand),
      issue_affinity:  pickN(ISSUES,          2 + Math.floor(rand() * 4), rand),
      recent_events:   rand() < 0.4 ? pickN(EVENTS, 1 + Math.floor(rand() * 2), rand) : new Set(),
      districts:       pickN(DISTRICTS,       3 + Math.floor(rand() * 4), rand),
    });
  }
  return universe;
}

const UNIVERSE = buildUniverse();

/**
 * Apply a filter spec and return matching donors.
 *
 * spec = {
 *   coalition_flags: { mode: 'OR'|'AND', values: string[] },
 *   issue_affinity:  { mode: 'OR'|'AND', values: string[] },
 *   recent_events:   { include: string[], exclude: string[] },
 *   districts:       { include: string[], exclude: string[] },
 * }
 */
export function searchDonors(spec = {}) {
  return UNIVERSE.filter((d) => {
    // Coalition flags — AND/OR mode
    if (spec.coalition_flags?.values?.length > 0) {
      const { mode, values } = spec.coalition_flags;
      const hits = values.filter((v) => d.coalition_flags.has(v));
      if (mode === 'AND' && hits.length !== values.length) return false;
      if (mode === 'OR'  && hits.length === 0) return false;
    }
    // Issue affinity — AND/OR mode
    if (spec.issue_affinity?.values?.length > 0) {
      const { mode, values } = spec.issue_affinity;
      const hits = values.filter((v) => d.issue_affinity.has(v));
      if (mode === 'AND' && hits.length !== values.length) return false;
      if (mode === 'OR'  && hits.length === 0) return false;
    }
    // Recent events — Include/Exclude
    if (spec.recent_events) {
      const { include = [], exclude = [] } = spec.recent_events;
      if (include.length > 0 && !include.some((v) => d.recent_events.has(v))) return false;
      if (exclude.length > 0 &&  exclude.some((v) => d.recent_events.has(v))) return false;
    }
    // Districts — Include/Exclude
    if (spec.districts) {
      const { include = [], exclude = [] } = spec.districts;
      if (include.length > 0 && !include.some((v) => d.districts.has(v))) return false;
      if (exclude.length > 0 &&  exclude.some((v) => d.districts.has(v))) return false;
    }
    return true;
  });
}

export function getUniverseSize() { return UNIVERSE.length; }
export { COALITION_FLAGS, ISSUES, EVENTS, DISTRICTS };
