// The mesh orchestrator (Dataiku Flow + Scenario pattern). Ecosystems publish
// EcosystemSignals into a silo; enabled SignalRoutes feed each signal into a scoring
// recipe; the recipe's output lands as SubscriberPropensity rows and FunnelProposal
// advice — always PENDING_APPROVAL, never self-executing. The orchestrator holds no
// privileges of its own: it can only call store methods, and every store method is
// silo-scoped by candidateId, so a signal can never reach across the boundary.

import { evaluateSubscriber, fatigueGuard, percentileOf, sliceForPercentile, type FeederVerdict } from '../feeder/nova';
import type { MeshStore, SignalRouteRecord } from './store';

export interface MeshSignal {
  id: string;
  ecosystemKey: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface NewSignal {
  ecosystemKey: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt?: Date;
}

export type Recipe = (ctx: {
  store: MeshStore;
  candidateId: string;
  signal: MeshSignal;
  now: Date;
}) => Promise<string>; // returns a one-line receipt for the consumption log

export interface OrchestratorReport {
  candidateId: string;
  consumed: Array<{ signalId: string; recipes: Array<{ recipeKey: string; receipt: string }> }>;
  skipped: Array<{ signalId: string; reason: string }>;
}

// 'nova-evaluate': payload {subscriberId} → score through the feeder, persist verdict.
const novaEvaluate: Recipe = async ({ store, candidateId, signal, now }) => {
    const subscriberId = typeof signal.payload.subscriberId === 'string' ? signal.payload.subscriberId : null;
    if (!subscriberId) return 'skipped: payload.subscriberId missing';
    const activities = await store.subscriberActivity(candidateId, [subscriberId]);
    const events = activities.get(subscriberId) ?? [];
    const verdict = evaluateSubscriber(events, now);
    // Customer-fatigue layer: saturated subscribers get conversion downgraded to nurture.
    const fatigue = fatigueGuard(events, verdict, now);
    const adjusted: FeederVerdict = fatigue.fatigued
      ? { ...verdict, action: fatigue.action, reason: `${verdict.reason} fatigue-guard:cap=${verdict.frequencyCapPerWeek}/wk→nurture` }
      : verdict;
    const cohort = await store.cohortScores(candidateId, 'HighValueConversionPropensity');
    const slices = {
      HighValueConversionPropensity: sliceForPercentile(percentileOf(adjusted.scores.HighValueConversionPropensity, cohort)),
    };
    await store.recordFeederVerdict(candidateId, subscriberId, adjusted, slices, signal.id);
    return `verdict=${adjusted.affinity.toLowerCase()} action=${adjusted.action} tone=${adjusted.tone}${fatigue.fatigued ? ' fatigued' : ''}`;
};

// Recipe registry. recipeKey strings live on SignalRoute rows.
export const RECIPES: Record<string, Recipe> = {
  'nova-evaluate': novaEvaluate,

  // 'perspective-ingest': a Perspective.io FunnelEvent — payload
  // {funnelId, stepName, eventType, email? | subscriberId?} — becomes a real
  // SubscriberActivity row, then rescores the contact through the feeder.
  // Perspective event types map onto funnel engagement:
  //   contact_created → CAPTURED, step_viewed → OPENED,
  //   step_completed | funnel_completed → CLICKED.
  'perspective-ingest': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    if (!subscriberId) return 'skipped: no subscriberId and email not found in silo';
    const map: Record<string, 'CAPTURED' | 'OPENED' | 'CLICKED'> = {
      contact_created: 'CAPTURED', step_viewed: 'OPENED',
      step_completed: 'CLICKED', funnel_completed: 'CLICKED',
    };
    const eventType = typeof p.eventType === 'string' ? p.eventType : '';
    const activityType = map[eventType] ?? 'CLICKED';
    await store.recordActivity(candidateId, subscriberId, activityType, signal.occurredAt);
    const step = typeof p.stepName === 'string' ? p.stepName : 'unknown-step';
    const funnel = typeof p.funnelId === 'string' ? p.funnelId : 'unknown-funnel';
    const receipt = await novaEvaluate({ store, candidateId, signal: { ...signal, payload: { subscriberId } }, now });
    return `activity=${activityType} funnel=${funnel} step=${step} | ${receipt}`;
  },

  // === Breeze carve (HubSpot AI engine functions) ===

  // 'intent-boost' (Breeze Intelligence buyer intent): payload
  // {subscriberId|email, intentScore 0..1, source} — an external intent signal
  // records a CLICKED-level engagement activity and rescores the subscriber.
  'intent-boost': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    const score = typeof p.intentScore === 'number' ? p.intentScore : 0;
    if (score < 0 || score > 1) return 'skipped: intentScore outside 0..1';
    const src = typeof p.source === 'string' ? p.source : 'unknown';
    if (score >= 0.5) {
      await store.recordActivity(candidateId, subscriberId, 'CLICKED', signal.occurredAt);
    }
    const receipt = await novaEvaluate({ store, candidateId, signal: { ...signal, payload: { subscriberId } }, now });
    return `intent=${score.toFixed(2)} src=${src}${score >= 0.5 ? ' +CLICKED' : ''} | ${receipt}`;
  },

  // 'lead-alert' (Sales Hub AI lead scoring + threshold notification): payload
  // {subscriberId|email, threshold?} — rescore through the feeder; when the
  // propensity crosses the threshold a HIGH_INTENT_CONVERSION proposal alerts
  // the review lane with the score. HubSpot's "notify reps when a lead exceeds
  // your threshold" — our humans are the reps.
  'lead-alert': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    const threshold = typeof p.threshold === 'number' && p.threshold > 0 && p.threshold <= 1 ? p.threshold : 0.6;
    const activities = await store.subscriberActivity(candidateId, [subscriberId]);
    const events = activities.get(subscriberId) ?? [];
    const verdict = evaluateSubscriber(events, now);
    const score = verdict.scores.HighValueConversionPropensity;
    if (score < threshold) return `below threshold: ${score.toFixed(2)} < ${threshold}`;
    const created = await store.createProposal(candidateId, subscriberId, 'HIGH_INTENT_CONVERSION',
      `lead-alert: score ${score.toFixed(2)} ≥ threshold ${threshold} — ${verdict.reason}`, signal.id, 'direct_ask');
    return created ? `lead alert: ${score.toFixed(2)} ≥ ${threshold}` : 'deduped: pending alert exists';
  },

  // 'enrich' (Breeze data agent): payload {subscriberId|email, fields:{phone?,
  // company?, firstName?, lastName?, attributes?}} — recovered contact fields
  // stamp onto the silo's own subscriber row.
  'enrich': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    const fields = (p.fields ?? {}) as Record<string, unknown>;
    const clean: { phone?: string; company?: string; firstName?: string; lastName?: string; attributes?: Record<string, string> } = {};
    for (const key of ['phone', 'company', 'firstName', 'lastName'] as const) {
      if (typeof fields[key] === 'string' && fields[key]) clean[key] = fields[key] as string;
    }
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!['phone', 'company', 'firstName', 'lastName'].includes(k) && typeof v === 'string' && v) attrs[k] = v;
    }
    if (Object.keys(attrs).length) clean.attributes = attrs;
    if (!Object.keys(clean).length) return 'skipped: no usable fields';
    const ok = await store.enrichSubscriber(candidateId, subscriberId, clean);
    return ok ? `enriched ${Object.keys(clean).length} field groups` : 'skipped: subscriber not found in silo';
  },

  // 'draft-content' (Breeze content agent + HubSpot email AI): payload {topic,
  // goal?, subscriberId?, tone?} — composes a subject line + draft ask in the
  // registered tone, personalized from the subscriber's enriched fields, and
  // files it for human approval. Deterministic template today; a real LLM
  // slots in behind the same recipe without touching the route.
  'draft-content': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    const topic = typeof p.topic === 'string' ? p.topic : null;
    if (!topic) return 'skipped: payload.topic missing';
    const tone = typeof p.tone === 'string' ? p.tone : 'warm_ask';
    const subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    const who = subscriberId ? await store.subscriberFields(candidateId, subscriberId) : null;
    const name = who?.firstName ?? 'friend';
    const subjects: Record<string, string> = {
      direct_ask: `${name}, ${topic}`,
      warm_ask: `${name} — thought you'd want this`,
      nurture: `For you, ${name}`,
      apology_winback: `${name}, we owe you better`,
    };
    const openers: Record<string, string> = {
      direct_ask: `Quick one — ${topic}. Can I count on you?`,
      warm_ask: `I wanted to share something close to home: ${topic}.`,
      nurture: `Thought you'd want to see this: ${topic}.`,
      apology_winback: `We've been quiet too long. Here's why ${topic} matters now.`,
    };
    const subject = subjects[tone] ?? subjects['warm_ask']!;
    const draft = openers[tone] ?? openers['warm_ask']!;
    const goal = typeof p.goal === 'string' ? p.goal : 'unspecified-goal';
    const created = await store.createProposal(candidateId, subscriberId, 'NURTURE',
      `draft-content[${goal}] subject="${subject}" body="${draft}"`, signal.id, tone);
    return created ? `draft filed [${tone}]: "${subject}"` : 'deduped: pending proposal exists';
  },

  // 'follow-up' (HubSpot engagement-triggered automation): payload
  // {subscriberId, activityType, campaignId?} — an engagement event (opened /
  // clicked / bounced / unsubscribed) files the matching follow-up proposal:
  //   CLICKED → direct conversion nudge, OPENED → warm follow-up,
  //   BOUNCED|UNSUBSCRIBED → suppression advice.
  'follow-up': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    const subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId) return 'skipped: payload.subscriberId missing';
    const kind = typeof p.activityType === 'string' ? p.activityType : '';
    const campaign = typeof p.campaignId === 'string' ? p.campaignId : 'unspecified-campaign';
    const table: Record<string, { action: string; reason: string; tone: string }> = {
      CLICKED: { action: 'HIGH_INTENT_CONVERSION', tone: 'direct_ask', reason: `clicked ${campaign} — strike while hot` },
      OPENED: { action: 'NURTURE', tone: 'warm_ask', reason: `opened ${campaign} — follow up while remembered` },
      BOUNCED: { action: 'SUPPRESS', tone: 'nurture', reason: `bounced on ${campaign} — verify address before next send` },
      UNSUBSCRIBED: { action: 'SUPPRESS', tone: 'nurture', reason: `unsubscribed during ${campaign} — suppress immediately` },
    };
    const row = table[kind];
    if (!row) return `skipped: no follow-up rule for ${kind || 'unknown'}`;
    const created = await store.createProposal(candidateId, subscriberId, row.action, `follow-up[${kind.toLowerCase()}]: ${row.reason}`, signal.id, row.tone);
    return created ? `follow-up filed [${kind.toLowerCase()}→${row.action}]` : 'deduped: pending proposal exists';
  },

  // 'committee' (Prospecting Agent buying-committee sourcing): payload
  // {company} — every silo subscriber enriched at that company is one seat of
  // the buying committee; the proposal lists the headcount so the review lane
  // knows whether the account is covered or thin.
  'committee': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    const company = typeof p.company === 'string' ? p.company.trim().toLowerCase() : null;
    if (!company) return 'skipped: no company in payload';
    const subs = await store.siloSubscriberIds(candidateId);
    const members: string[] = [];
    for (const id of subs) {
      const fields = await store.subscriberFields(candidateId, id);
      if (fields?.company?.trim().toLowerCase() === company) members.push(id);
    }
    if (!members.length) return `committee: no contacts at ${company} in this silo`;
    const reason = `committee@${company}: ${members.length} contact${members.length === 1 ? '' : 's'} (${members.join(', ')})`;
    const created = await store.createProposal(candidateId, null, 'NURTURE', reason, signal.id, 'warm_ask');
    return created ? reason : 'deduped: pending committee proposal exists';
  },

  // 'smart-property' (Data Agent smart properties): payload {subscriberId|email,
  // property?, windowDays?} — computes a business answer from the subscriber's
  // activity (last touch, engagement mix in the window) and writes it onto the
  // record as an enrichment attribute, like HubSpot writing answers into CRM
  // fields on a refresh cadence.
  'smart-property': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    const property = typeof p.property === 'string' && p.property ? p.property : 'engagement_summary';
    const days = typeof p.windowDays === 'number' && p.windowDays > 0 ? p.windowDays : 30;
    const since = new Date(now.getTime() - days * 86400_000);
    const events = (await store.subscriberActivity(candidateId, [subscriberId])).get(subscriberId) ?? [];
    const recent = events.filter((e) => e.occurredAt >= since);
    if (!recent.length) return `smart-property: no activity in ${days}d, record untouched`;
    const last = recent.reduce((a, b) => (a.occurredAt > b.occurredAt ? a : b));
    const counts: Record<string, number> = {};
    for (const e of recent) counts[e.type] = (counts[e.type] ?? 0) + 1;
    const summary = `last=${last.type}@${last.occurredAt.toISOString().slice(0, 10)} ` +
      Object.entries(counts).sort().map(([k, n]) => `${k.toLowerCase()}=${n}`).join(' ');
    const stamped = await store.enrichSubscriber(candidateId, subscriberId, { attributes: { [property]: summary } });
    return stamped ? `smart-property ${property}="${summary}"` : 'skipped: subscriber not found in silo';
  },

  // 'ticket-log' (Starter ticketing + conversational bots): payload
  // {subscriberId|email, issue, priority?} — a support conversation or issue
  // lands as a deduped proposal tagged with the contact and priority, so
  // tickets are logged and prioritized without leaving the review lane.
  'ticket-log': async ({ store, candidateId, signal }) => {
    const p = (signal.payload ?? {}) as Record<string, unknown>;
    const issue = typeof p.issue === 'string' ? p.issue.trim() : '';
    if (!issue) return 'skipped: payload.issue required';
    const priority = typeof p.priority === 'string' ? p.priority.toLowerCase() : 'normal';
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    const reason = `ticket[${priority}]: ${issue.slice(0, 150)} — ${subscriberId ?? p.email ?? 'unknown contact'}`;
    const tone = priority === 'high' ? 'apology_winback' : 'nurture';
    const created = await store.createProposal(candidateId, subscriberId, 'NURTURE', reason, signal.id, tone);
    return created ? reason : 'deduped: identical ticket pending';
  },

  // 'hygiene-scan' (Data Hub data-quality overview): payload {} — sweeps the
  // silo's subscriber records for completeness gaps (missing name, missing
  // company) and files one health proposal with the counts. HubSpot's data
  // quality monitor — ours reports into the review lane, humans fix.
  'hygiene-scan': async ({ store, candidateId, signal }) => {
    const subs = await store.siloSubscriberIds(candidateId);
    if (!subs.length) return 'skipped: silo has no subscribers';
    let missingName = 0;
    let missingCompany = 0;
    for (const id of subs) {
      const fields = await store.subscriberFields(candidateId, id);
      if (!fields?.firstName && !fields?.lastName) missingName++;
      if (!fields?.company) missingCompany++;
    }
    if (!missingName && !missingCompany) return `hygiene-scan: all ${subs.length} records complete`;
    const parts = [
      missingName && `${missingName} missing name`,
      missingCompany && `${missingCompany} missing company`,
    ].filter(Boolean).join(', ');
    const reason = `hygiene-scan: ${subs.length} records — ${parts}`;
    const created = await store.createProposal(candidateId, null, 'NURTURE', reason, signal.id, 'nurture');
    return created ? reason : 'deduped: pending hygiene proposal exists';
  },

  // 'stall-scan' (Sales Hub AI deal-risk detection): payload {stallDays?} —
  // sweeps the silo for contacts who engaged before but have gone cold (no
  // OPENED/CLICKED inside the window) and files a risk proposal listing the
  // count. HubSpot's "flag risk the moment it appears" — our flag lands where
  // all flags land: the human review lane.
  'stall-scan': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    const days = typeof p.stallDays === 'number' && p.stallDays > 0 ? p.stallDays : 14;
    const subs = await store.siloSubscriberIds(candidateId);
    if (!subs.length) return 'skipped: silo has no subscribers';
    const activity = await store.subscriberActivity(candidateId, subs);
    const since = new Date(now.getTime() - days * 86400_000);
    const cold: string[] = [];
    for (const [id, events] of activity) {
      const everEngaged = events.some((e) => e.type === 'OPENED' || e.type === 'CLICKED');
      const recentEngaged = events.some((e) => (e.type === 'OPENED' || e.type === 'CLICKED') && e.occurredAt >= since);
      if (everEngaged && !recentEngaged) cold.push(id);
    }
    if (!cold.length) return `stall-scan: no cold contacts in ${days}d`;
    const reason = `stall-scan: ${cold.length} engaged contact${cold.length === 1 ? '' : 's'} gone cold in ${days}d (${cold.join(', ')})`;
    const created = await store.createProposal(candidateId, null, 'NURTURE', reason, signal.id, 'apology_winback');
    return created ? `stall-scan: ${cold.length} cold contact${cold.length === 1 ? '' : 's'} flagged` : 'deduped: pending stall proposal exists';
  },

  // 'dedupe-scan' (Starter auto-deduplication): payload {} — sweeps the silo's
  // subscribers for likely duplicates (same phone, same normalized full name)
  // and files ONE proposal listing the collision sets. Merging records is a
  // human call — the scan only surfaces candidates.
  'dedupe-scan': async ({ store, candidateId, signal }) => {
    const subs = await store.siloSubscriberIds(candidateId);
    if (!subs.length) return 'skipped: silo has no subscribers';
    const byKey = new Map<string, string[]>();
    for (const id of subs) {
      const fields = await store.subscriberFields(candidateId, id);
      const name = [fields?.firstName, fields?.lastName].filter(Boolean).join(' ').trim().toLowerCase();
      for (const key of [name && `name:${name}`, fields?.company && `company+name:${fields.company.trim().toLowerCase()}|${name}`]) {
        if (!key) continue;
        const list = byKey.get(key) ?? [];
        list.push(id);
        byKey.set(key, list);
      }
    }
    const collisions = [...byKey.entries()].filter(([, ids]) => new Set(ids).size > 1);
    if (!collisions.length) return 'dedupe-scan: no duplicate candidates';
    const summary = collisions.map(([key, ids]) => `${key} → ${[...new Set(ids)].join(', ')}`).join(' | ');
    const created = await store.createProposal(candidateId, null, 'NURTURE',
      `dedupe-scan: ${collisions.length} collision set${collisions.length === 1 ? '' : 's'} — ${summary}`, signal.id, 'nurture');
    return created ? `dedupe-scan: ${collisions.length} collision set${collisions.length === 1 ? '' : 's'} filed` : 'deduped: pending dedupe proposal exists';
  },

  // 'form-capture' (Starter forms → CRM): payload {email, source?} — a landing
  // -page form submission. Known silo contact → CAPTURED activity + rescore.
  // Stranger → a 'new lead' proposal; a human accepts and the record is
  // created — the AI never writes new subscriber rows on its own.
  'form-capture': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    const email = typeof p.email === 'string' ? p.email : null;
    if (!email) return 'skipped: no email in payload';
    const source = typeof p.source === 'string' ? p.source : 'landing-form';
    const subscriberId = await store.findSubscriberByEmail(candidateId, email);
    if (!subscriberId) {
      const created = await store.createProposal(candidateId, null, 'NURTURE',
        `form-capture[${source}]: new lead ${email} — create contact?`, signal.id, 'warm_ask');
      return created ? `new lead proposed: ${email}` : 'deduped: pending lead proposal exists';
    }
    await store.recordActivity(candidateId, subscriberId, 'CAPTURED', now);
    const receipt = await novaEvaluate({ store, candidateId, signal: { ...signal, payload: { subscriberId } }, now });
    return `captured ${email} via ${source} | ${receipt}`;
  },

  // 'gate-check' (Content Hub gated content / member groups): payload
  // {subscriberId|email, listId} — members get a green receipt; non-members get
  // a proposal suggesting gated access be offered (never auto-granted — access
  // decisions stay human).
  'gate-check': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    const listId = typeof p.listId === 'string' ? p.listId : null;
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    if (!listId) return 'skipped: no listId in payload';
    const member = await store.isListMember(candidateId, listId, subscriberId);
    if (member) return `gate-check: member of ${listId} — access confirmed`;
    const created = await store.createProposal(candidateId, subscriberId, 'NURTURE',
      `gate-check: ${subscriberId} requested gated content ${listId} but is not a member — offer access?`, signal.id, 'warm_ask');
    return created ? `gate-check: not a member of ${listId}, access proposal filed` : 'deduped: pending access proposal exists';
  },

  // 'remix' (Content Hub remix tool): payload {text, formats?} — one source
  // asset becomes a per-format draft: email (subject+body), sms (160c),
  // social (280c). Each format lands as its own deduped PENDING_APPROVAL
  // proposal — review picks which channels the remix actually ships on.
  'remix': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    const text = typeof p.text === 'string' ? p.text.trim() : '';
    if (!text) return 'skipped: no source text in payload';
    const formats: string[] = Array.isArray(p.formats) && p.formats.length
      ? p.formats.filter((f): f is string => typeof f === 'string')
      : ['email', 'sms', 'social'];
    const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
    const drafts: Record<string, string> = {
      email: `subject="${clip(text, 60)}" body="${text}"`,
      sms: clip(text, 160),
      social: clip(text, 280),
    };
    const filed: string[] = [];
    for (const format of formats) {
      const draft = drafts[format.toLowerCase()];
      if (!draft) continue;
      const created = await store.createProposal(candidateId, null, 'NURTURE',
        `remix[${format.toLowerCase()}]: ${draft}`, signal.id, 'nurture');
      if (created) filed.push(format.toLowerCase());
    }
    return filed.length ? `remix filed: ${filed.join(', ')}` : 'deduped: pending remix proposals exist';
  },

  // 'enroll' (HubSpot workflow enrollment): payload {subscriberId|email,
  // journeyId} — a triggered action puts the silo's own subscriber into a
  // journey run. Idempotent: re-firing the trigger never duplicates the run.
  'enroll': async ({ store, candidateId, signal }) => {
    const p = signal.payload;
    let subscriberId = typeof p.subscriberId === 'string' ? p.subscriberId : null;
    if (!subscriberId && typeof p.email === 'string') {
      subscriberId = await store.findSubscriberByEmail(candidateId, p.email);
    }
    const journeyId = typeof p.journeyId === 'string' ? p.journeyId : null;
    if (!subscriberId) return 'skipped: subscriber not found in silo';
    if (!journeyId) return 'skipped: no journeyId in payload';
    return await store.enrollInJourney(candidateId, journeyId, subscriberId);
  },

  // 'retarget' (HubSpot retargeting campaigns): payload {journeyId?,
  // windowDays?} — finds silo subscribers DELIVERED in the window who never
  // OPENED, enrolls them in the retargeting journey when one is named, and
  // files one proposal reporting the non-opener count.
  'retarget': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    const days = typeof p.windowDays === 'number' && p.windowDays > 0 ? p.windowDays : 7;
    const journeyId = typeof p.journeyId === 'string' ? p.journeyId : null;
    const subs = await store.siloSubscriberIds(candidateId);
    if (!subs.length) return 'skipped: silo has no subscribers';
    const activity = await store.subscriberActivity(candidateId, subs);
    const since = new Date(now.getTime() - days * 86400_000);
    const nonOpeners: string[] = [];
    for (const [id, events] of activity) {
      const delivered = events.some((e) => e.type === 'DELIVERED' && e.occurredAt >= since);
      const opened = events.some((e) => e.type === 'OPENED' && e.occurredAt >= since);
      if (delivered && !opened) nonOpeners.push(id);
    }
    if (!nonOpeners.length) return `retarget: all delivered opened within ${days}d`;
    let enrolled = 0;
    if (journeyId) {
      for (const id of nonOpeners) {
        if ((await store.enrollInJourney(candidateId, journeyId, id)) === 'enrolled') enrolled++;
      }
    }
    const reason = `retarget: ${nonOpeners.length} non-opener${nonOpeners.length === 1 ? '' : 's'} in ${days}d` +
      (journeyId ? `, ${enrolled} enrolled in ${journeyId}` : ' — no journeyId given, no enrollment');
    const created = await store.createProposal(candidateId, null, 'NURTURE', reason, signal.id, 'nurture');
    return created ? reason : 'deduped: pending retarget proposal exists';
  },

  // 'insights' (HubSpot messaging insights): payload {windowDays?} — reads the
  // silo's recent activity mix and files one proposal describing the trend —
  // the review lane sees engagement shape without opening a dashboard.
  'insights': async ({ store, candidateId, signal, now }) => {
    const p = signal.payload;
    const days = typeof p.windowDays === 'number' && p.windowDays > 0 ? p.windowDays : 7;
    const subs = await store.siloSubscriberIds(candidateId);
    if (!subs.length) return 'skipped: silo has no subscribers';
    const activity = await store.subscriberActivity(candidateId, subs);
    const since = new Date(now.getTime() - days * 86400_000);
    let opens = 0, clicks = 0, bounces = 0, delivered = 0, unsubs = 0;
    for (const events of activity.values()) {
      for (const e of events) {
        if (e.occurredAt < since) continue;
        if (e.type === 'OPENED') opens++;
        else if (e.type === 'CLICKED') clicks++;
        else if (e.type === 'BOUNCED') bounces++;
        else if (e.type === 'DELIVERED') delivered++;
        else if (e.type === 'UNSUBSCRIBED') unsubs++;
      }
    }
    const rate = delivered ? `${Math.round((opens / delivered) * 100)}%` : 'n/a';
    const reason = `insights[${days}d]: delivered=${delivered} opens=${opens}(${rate}) clicks=${clicks} bounces=${bounces} unsubscribes=${unsubs}`;
    const created = await store.createProposal(candidateId, null, 'NURTURE', reason, signal.id, 'nurture');
    return created ? `insight filed: ${reason}` : 'deduped: pending insight exists';
  },

  // 'proposal-only': payload {action, reason, subscriberId?} → file a proposal directly
  // (ecosystems that already produce a recommendation, e.g. an LP solve).
  'proposal-only': async ({ store, candidateId, signal }) => {
    const action = typeof signal.payload.action === 'string' ? signal.payload.action : null;
    const reason = typeof signal.payload.reason === 'string' ? signal.payload.reason : null;
    const valid = action === 'HIGH_INTENT_CONVERSION' || action === 'NURTURE' || action === 'REENGAGEMENT_SUPPRESSION' || action === 'SUPPRESS';
    if (!valid || !reason) return 'skipped: payload.action/reason invalid';
    const subscriberId = typeof signal.payload.subscriberId === 'string' ? signal.payload.subscriberId : null;
    const tone = typeof signal.payload.tone === 'string' ? signal.payload.tone : undefined;
    const created = await store.createProposal(candidateId, subscriberId, action, reason, signal.id, tone);
    return created ? `proposal filed: ${action}` : 'deduped: pending proposal exists';
  },
};

// Publish a signal into a silo. The candidateId is the only addressing — the store
// refuses anything it can't scope.
export async function ingestSignal(store: MeshStore, candidateId: string, signal: NewSignal): Promise<string> {
  return store.recordSignal(candidateId, { ...signal, occurredAt: signal.occurredAt ?? new Date() });
}

// The scenario run: consume every pending signal in the silo through its enabled routes.
// A signal with no enabled route is still marked consumed (the mesh drops it cleanly,
// logged as skipped) so the bus never backs up.
export async function processSignals(store: MeshStore, candidateId: string, now: Date = new Date()): Promise<OrchestratorReport> {
  const report: OrchestratorReport = { candidateId, consumed: [], skipped: [] };
  const signals = await store.pendingSignals(candidateId);
  if (!signals.length) return report;
  const routes = await store.signalRoutes(candidateId);
  for (const signal of signals) {
    const matching = routes.filter((r) => r.enabled && r.ecosystemKey === signal.ecosystemKey && r.signalType === signal.type);
    const recipes: Array<{ recipeKey: string; receipt: string }> = [];
    for (const route of matching) {
      const recipe = RECIPES[route.recipeKey];
      if (!recipe) {
        recipes.push({ recipeKey: route.recipeKey, receipt: 'unknown recipe' });
        continue;
      }
      recipes.push({ recipeKey: route.recipeKey, receipt: await recipe({ store, candidateId, signal, now }) });
    }
    await store.markSignalConsumed(signal.id, now);
    if (matching.length === 0) report.skipped.push({ signalId: signal.id, reason: 'no enabled route' });
    else report.consumed.push({ signalId: signal.id, recipes });
  }
  return report;
}

// Convenience for hosts that want a single entry point: ingest then process.
export async function ingestAndProcess(store: MeshStore, candidateId: string, signal: NewSignal, now: Date = new Date()): Promise<OrchestratorReport> {
  await ingestSignal(store, candidateId, signal);
  return processSignals(store, candidateId, now);
}

export type { MeshStore, SignalRouteRecord };
