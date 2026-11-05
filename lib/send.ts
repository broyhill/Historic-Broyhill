// Unified outbound send for the wizard's hands.
// Email: SendGrid when SENDGRID_API_KEY is set, else Resend (RESEND_API_KEY).
// SMS:   Twilio REST when TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER are set.
// Every function degrades honestly: returns { sent: false, reason } — never throws
// on a missing provider so callers can record DRY_RUN instead of dying.

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; id?: string; provider?: string; reason?: string }> {
  const from = process.env.EMAIL_FROM || "Historic Broyhill <info@broyhill.net>";

  if (process.env.SENDGRID_API_KEY) {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: from.replace(/.*<|>.*/g, ""), name: from.replace(/<.*>/, "").trim() },
        subject: opts.subject,
        content: [
          { type: "text/plain", value: opts.text },
          ...(opts.html ? [{ type: "text/html", value: opts.html }] : []),
        ],
      }),
    });
    if (r.ok || r.status === 202) {
      return { sent: true, provider: "sendgrid", id: r.headers.get("x-message-id") ?? undefined };
    }
    const body = await r.text().catch(() => "");
    return { sent: false, reason: `sendgrid ${r.status}: ${body.slice(0, 200)}` };
  }

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    if (error || !data) return { sent: false, reason: error?.message || "resend returned no id" };
    return { sent: true, provider: "resend", id: data.id };
  }

  return { sent: false, reason: "no email provider configured (SENDGRID_API_KEY or RESEND_API_KEY)" };
}

export async function sendSms(opts: {
  to: string; // E.164 phone
  body: string;
}): Promise<{ sent: boolean; id?: string; provider?: string; reason?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { sent: false, reason: "twilio not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER)" };
  }
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: opts.to, From: from, Body: opts.body }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) return { sent: false, reason: `twilio ${r.status}: ${json?.message ?? "send failed"}` };
  return { sent: true, provider: "twilio", id: json.sid };
}
