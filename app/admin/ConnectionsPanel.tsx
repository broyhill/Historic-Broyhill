"use client";

import React, { useEffect, useState } from "react";

type ChannelKey = "meta" | "tiktok" | "shopify" | "wordpress";

const CHANNELS: { key: ChannelKey; name: string; what: string; needs: string[] }[] = [
  {
    key: "meta",
    name: "Meta",
    what: "Facebook + Instagram ads — the business portfolio, Page, Instagram account and ad account Ad studio will publish through.",
    needs: ["META_APP_ID", "META_APP_SECRET"],
  },
  {
    key: "tiktok",
    name: "TikTok",
    what: "TikTok for Business ad account for short-video campaigns.",
    needs: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"],
  },
  {
    key: "shopify",
    name: "Shopify",
    what: "Sync the venue's product catalog (rooms, packages) into campaign creative and track what sells.",
    needs: ["SHOPIFY_APP_ID", "SHOPIFY_APP_SECRET"],
  },
  {
    key: "wordpress",
    name: "WordPress",
    what: "Publish landing pages and blog posts to a WordPress site.",
    needs: ["WORDPRESS_SITE_URL"],
  },
];

export default function ConnectionsPanel() {
  const [configured, setConfigured] = useState<Record<ChannelKey, boolean> | null>(null);
  const [open, setOpen] = useState<ChannelKey | null>(null);

  useEffect(() => {
    fetch("/api/admin/connections")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setConfigured(d.channels))
      .catch(() => setConfigured(null));
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="ibox p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="hb-display text-[22px] text-ink">Historic Broyhill</h3>
            <p className="text-[13px] text-muted mt-0.5">https://historic-broyhill.vercel.app</p>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted mt-1">Brand</span>
        </div>
      </div>

      <div className="ibox divide-y divide-line">
        {CHANNELS.map((c) => {
          const ready = configured?.[c.key] ?? false;
          const expanded = open === c.key;
          return (
            <div key={c.key} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <h4 className="text-[15px] font-semibold text-ink">{c.name}</h4>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      ready ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {ready ? "Ready to connect" : "Not connected"}
                  </span>
                </div>
                {ready ? (
                  <a
                    href={`/api/admin/connect/${c.key}`}
                    className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 transition"
                  >
                    Connect {c.name}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : c.key)}
                    className="shrink-0 rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-slate-50 transition"
                  >
                    {expanded ? "Close" : `Connect ${c.name}`}
                  </button>
                )}
              </div>
              <p className="text-[13px] text-muted mt-2 leading-relaxed">{c.what}</p>
              {expanded && !ready && (
                <div className="mt-3 rounded-lg bg-canvas border border-line p-4">
                  <p className="text-[13px] text-ink font-medium">Waiting on credentials</p>
                  <p className="text-[13px] text-muted mt-1 leading-relaxed">
                    The connect flow is built — it goes live when these are set in Vercel env:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {c.needs.map((n) => (
                      <li key={n} className="text-[13px] font-mono text-ink">{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
