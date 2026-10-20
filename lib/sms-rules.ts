import { unresolvedTags, type Check } from "@/lib/campaign-rules";

// Text-message rules for SMS / MMS templates. Carrier and Twilio limits as generally published:
// 160 chars per single GSM-7 segment (153 when split), 70 (67 when split) once any non-GSM character
// such as an emoji or curly quote appears; MMS body up to 1,600 characters with one image link.
// Everything here is advisory; the carrier registration (10DLC) has the final say.

const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€"; // each counts as 2

export const MAX_MMS_CHARS = 1600;
export const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly"];
export const IMAGE_EXT = /\.(jpe?g|png|gif)(\?.*)?$/i;

export interface SmsInfo { encoding: "GSM-7" | "Unicode"; length: number; segments: number; perSegment: number }

export function smsInfo(text: string): SmsInfo {
  let gsm = true;
  let length = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) length += 1;
    else if (GSM_EXT.includes(ch)) length += 2;
    else { gsm = false; break; }
  }
  if (!gsm) {
    length = Array.from(text).reduce((n, ch) => n + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0);
    const single = 70, multi = 67;
    return { encoding: "Unicode", length, segments: length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi), perSegment: length <= single ? single : multi };
  }
  const single = 160, multi = 153;
  return { encoding: "GSM-7", length, segments: length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi), perSegment: length <= single ? single : multi };
}

export function smsChecks(body: string, channel: "sms" | "mms"): Check[] {
  const t = body.trim();
  const info = smsInfo(t);
  const urls = t.match(/https?:\/\/[^\s]+/gi) || [];
  const shortened = urls.filter((u) => SHORTENERS.some((s) => u.toLowerCase().includes(`//${s}`) || u.toLowerCase().includes(`.${s}`)));
  const checks: Check[] = [
    { ok: t.length > 0, label: "Has a message" },
    { ok: /historic\s+broyhill/i.test(t), label: "Says who it's from (Historic Broyhill)" },
    { ok: /\bstop\b/i.test(t), label: 'Tells people how to opt out (for example "Reply STOP to opt out")' },
    { ok: shortened.length === 0, label: "No link shorteners (carriers often block them)" },
  ];
  if (channel === "sms") {
    checks.push({ ok: info.segments <= 2, label: `Fits in 2 message parts or fewer (now ${info.segments}; ${info.length} characters, ${info.encoding})` });
    if (info.encoding === "Unicode") checks.push({ ok: false, label: "Contains an emoji or special character, which cuts the limit to 70 per part" });
  } else {
    checks.push({ ok: info.length <= MAX_MMS_CHARS, label: `Under ${MAX_MMS_CHARS} characters (now ${info.length})` });
  }
  return checks;
}

export function mediaChecks(mediaUrl: string): Check[] {
  const u = mediaUrl.trim();
  let https = false;
  try { https = new URL(u).protocol === "https:"; } catch { https = false; }
  return [
    { ok: u.length > 0, label: "Has a picture link" },
    { ok: https, label: "Picture link starts with https://" },
    { ok: IMAGE_EXT.test(u), label: "Link ends in .jpg, .jpeg, .png or .gif" },
  ];
}

export const textBlanks = (body: string, mediaUrl = "") => unresolvedTags(`${body}\n${mediaUrl}`);

export function textReady(channel: "sms" | "mms", body: string, mediaUrl = ""): boolean {
  const ok = smsChecks(body, channel).every((c) => c.ok);
  const media = channel === "mms" ? mediaChecks(mediaUrl).every((c) => c.ok) : true;
  return ok && media && textBlanks(body, channel === "mms" ? mediaUrl : "").length === 0;
}
