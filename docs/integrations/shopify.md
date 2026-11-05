# Shopify

Purpose: sync the venue's sellable catalog — rooms, packages, add-ons — so Ad studio can turn inventory into creative and track what sells.

How Larven connects: they ship a Shopify App Store app ($99/mo listing). "Connect store" installs it inside Shopify; the app then syncs catalog, images, inventory, and daily sales.

Ours: planned — `GET /api/admin/connect/shopify` answers 501. Needs `SHOPIFY_APP_ID`, `SHOPIFY_APP_SECRET` and a registered Shopify app (OAuth install flow). Alternative if HB never runs a real store: model the room/package catalog internally in our DB and skip Shopify entirely.
