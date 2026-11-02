// The agency layer's channel map. One registry, keyed by the platform's existing gun codes
// (backend/python/api/cannon_doors on main, 2026-10-02) — this file invents no new channels,
// executors or doors. Email (W01 / E30) is the only GOVERNED channel: the agency layer scopes
// it, gates it and dispatches it (dry-run). HOOKED channels share the same silo scoping, review
// queue (AiContentPipeline.channel), approval and suppression interfaces, but their dispatch is
// not built here; it refuses with NOT_BUILT. Everything else is UNCONNECTED.

import type { Channel } from '@generated/wizard-prisma';

export type GovernanceStatus = 'GOVERNED' | 'HOOKED' | 'UNCONNECTED';

export interface ChannelEntry {
  weapon: string; // W-code from cannon_doors
  ecosystem: string; // registered E-number (ecosystems.yaml, 2026-09-13)
  name: string; // registered name
  executor: string; // brain.action_executors code (all enabled=false on main)
  channel: Channel | null; // Prisma Channel this entry maps to, if any
  status: GovernanceStatus;
  suppressionKey: 'email' | 'phone' | 'postal' | 'handle' | 'none';
  note: string;
}

export const CHANNELS: readonly ChannelEntry[] = [
  { weapon: 'W01', ecosystem: 'E30', name: 'Email Gun', executor: 'EXEC_E30_EMAIL_SEND', channel: 'EMAIL', status: 'GOVERNED', suppressionKey: 'email', note: 'Built end to end here; dispatch inert by default. Provider per Ed 2026-10-06 ruling is SendGrid; spec asks Resend (Conflict C9).' },
  { weapon: 'W02', ecosystem: 'E31', name: 'SMS Gun', executor: 'EXEC_E31_SMS_SEND', channel: 'SMS', status: 'HOOKED', suppressionKey: 'phone', note: 'Journey SMS fallback stages an SMS draft for review; no send path here (Twilio ruling 2026-10-06 lives in E31).' },
  { weapon: 'W03', ecosystem: 'E74', name: 'MMS', executor: 'EXEC_E74_MMS_SEND', channel: null, status: 'UNCONNECTED', suppressionKey: 'phone', note: 'Shares E31 telephony guard; not hooked.' },
  { weapon: 'W04', ecosystem: 'E17', name: 'RVM', executor: 'EXEC_E17_RVM_DROP', channel: 'RVM', status: 'HOOKED', suppressionKey: 'phone', note: 'RVM TCPA status is a counsel question (Layer 1).' },
  { weapon: 'W05', ecosystem: 'E33', name: 'Direct Mail', executor: 'EXEC_E33_DIRECT_MAIL', channel: 'DIRECT_MAIL', status: 'HOOKED', suppressionKey: 'postal', note: 'Not EXEC_E16_DIRECT_MAIL (known collision).' },
  { weapon: 'W06', ecosystem: 'E19', name: 'Social Media', executor: 'EXEC_E19_SOCIAL_POST', channel: 'SOCIAL', status: 'HOOKED', suppressionKey: 'handle', note: 'Broadcast posts are not person-addressed; suppression applies to DMs only.' },
  { weapon: 'W07', ecosystem: 'E71', name: 'Volunteer Activism', executor: 'EXEC_E71_VOLUNTEER_DEPLOY', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W08', ecosystem: 'E16', name: 'TV/Radio Production', executor: 'EXEC_E16_TV_RADIO_SPOT', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W09', ecosystem: 'E46', name: 'Broadcast Hub', executor: 'EXEC_E46_BROADCAST_STREAM', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W10', ecosystem: 'E34', name: 'Events', executor: 'EXEC_E34_TOWNHALL_INVITE', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: 'Event invitations are MessageClass EVENT_INVITATION when sent by email (W01).' },
  { weapon: 'W11', ecosystem: 'E67', name: 'Push Notification', executor: 'EXEC_E67_PUSH_SEND', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W12', ecosystem: 'E69', name: 'Messenger / Chat', executor: 'EXEC_E69_MESSENGER_SEND', channel: null, status: 'UNCONNECTED', suppressionKey: 'handle', note: '' },
  { weapon: 'W13', ecosystem: 'E70', name: 'Digital Ads', executor: 'EXEC_E70_DIGITAL_AD_AUDIENCE', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W14', ecosystem: 'E75', name: 'Candidate Communication', executor: 'EXEC_E75_CANDIDATE_PERSONAL', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: 'Personal candidate contact is never blocked by bulk suppression (MessageClass PERSONAL).' },
  { weapon: 'W15', ecosystem: 'E76', name: 'Campaign Manager Communication', executor: 'EXEC_E76_MANAGER_PERSONAL', channel: null, status: 'UNCONNECTED', suppressionKey: 'none', note: '' },
  { weapon: 'W16', ecosystem: 'E32', name: 'Phone Bank', executor: 'EXEC_E32_PHONE_CALL', channel: 'PHONE_BANK', status: 'HOOKED', suppressionKey: 'phone', note: 'cannon_doors says W16; Composition Journey doc says W15 (Conflict C10). P2P only — no predictive dialer.' },
] as const;

// Not a gun: inbound reply routing. Hooked so replies (STOP/unsubscribe) can land in the silo.
export const CONVERSATION_HOOK: ChannelEntry = {
  weapon: '—', ecosystem: 'E35', name: 'Conversation Fabric', executor: '—', channel: 'CONVERSATION', status: 'HOOKED',
  suppressionKey: 'email', note: 'Inbound replies; an unsubscribe reply maps to the same SiloSuppression write as the one-click link.',
};

export function entryForChannel(channel: Channel): ChannelEntry | undefined {
  if (channel === 'CONVERSATION') return CONVERSATION_HOOK;
  return CHANNELS.find((c) => c.channel === channel);
}

export function isGoverned(channel: Channel): boolean {
  return entryForChannel(channel)?.status === 'GOVERNED';
}

export class ChannelNotBuiltError extends Error {
  constructor(channel: Channel) {
    super(`${channel} is HOOKED into the agency layer (silo scope, review, suppression) but has no dispatch path here`);
    this.name = 'ChannelNotBuiltError';
  }
}
