# Meta (Facebook + Instagram)

Purpose: Ad studio publishes FB/IG campaigns; leads and post engagement feed the pipeline.

How Larven connects: OAuth dialog inside Facebook — user picks business portfolio, catalog (optional), Page, Instagram Pro account, dataset, and ad account, then grants.

Ours:
- Start: `GET /api/admin/connect/meta` → redirects to `facebook.com/v19.0/dialog/oauth` with scopes `ads_management,ads_read,pages_read_engagement,instagram_basic`.
- Callback: `META_REDIRECT_URI` (default `/api/admin/connect/meta/callback`) — token exchange + ad-account store: TODO.
- Needs in Vercel env: `META_APP_ID`, `META_APP_SECRET`. Create the app at developers.facebook.com (type: Business), add Marketing API, set the redirect URI to the production callback.
