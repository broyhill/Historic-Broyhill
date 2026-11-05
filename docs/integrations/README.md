# Vendor Integrations — outside services the platform connects to

How Larven wires third-party connections (from Ed's walkthrough of their
settings + Shopify App Store listing, 2026-10-29) and how we mirror it.

## Their model (observed)

Larven keeps one **Settings → Organization** block with a row per vendor:
Meta, TikTok, Shopify, WordPress, plus Brands / Members / Credits / Billing /
Agents-MCP. Each vendor row opens a connections page that lists the org's
brands; every brand gets a card per channel showing **Not connected** and a
Connect button. Connect runs a real OAuth handoff (Facebook Business dialog:
pick business portfolio → catalog → Page → Instagram account → dataset → ad
account; TikTok: TikTok for Business login). Shopify is not just OAuth — they
ship a **Shopify App Store app** so "Connect store" installs the app inside
Shopify, and the engine then syncs the product catalog, images, inventory,
and daily sales to drive ad generation.

## Our model

Same surface, different core: our "product catalog" is the venue inventory
(rooms, packages, availability), not a store. Admin → **Connections** lists
one brand card (Historic Broyhill) with a row per channel. Status is reported
by `GET /api/admin/connections` (env-driven, never faked); **Connect** hits
`/api/admin/connect/<channel>`, which starts the provider's OAuth flow once
that vendor's credentials are in Vercel env, or answers 501 until built.

## Vendors

| Vendor | Purpose for us | How Larven connects | What we need | Status |
|--------|----------------|---------------------|--------------|--------|
| Meta | Facebook/Instagram ads via Ad studio | OAuth into Meta Business → pick portfolio, Page, IG, ad account | `META_APP_ID`, `META_APP_SECRET` (+ Meta app with Marketing API) | Flow built, awaiting creds |
| TikTok | Short-video ad campaigns | TikTok for Business OAuth login | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` (TikTok developer app) | 501 — not built |
| Shopify | Product catalog sync (rooms/packages as products) | Shopify App Store install + catalog/inventory/sales sync | `SHOPIFY_APP_ID`, `SHOPIFY_APP_SECRET` + a Shopify app | 501 — not built |
| WordPress | Publish landing pages/posts | Connect site | `WORDPRESS_SITE_URL` (+ site app password) | 501 — not built |
| Adobe Firefly | Image/video generation | n/a (our own vendored SDK) | `ADOBE_FIREFLY_CLIENT_ID`, `ADOBE_FIREFLY_CLIENT_SECRET` | Code shipped, awaiting creds |
| Agents / MCP | External agent tool access | Row in their settings | Decided per-need | Not planned |

Notes per vendor live in this folder as `<vendor>.md` as each gets built.
