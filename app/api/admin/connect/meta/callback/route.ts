import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Meta OAuth return URL: exchanges ?code for a user access token, then
// upgrades it to a long-lived token and stores it in VendorConnection
// (never in env or code). Failures land back on /admin?section=connections.
export async function GET(req: NextRequest) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const code = req.nextUrl.searchParams.get("code");
  const origin = req.nextUrl.origin;
  const fail = (e: string) => NextResponse.redirect(`${origin}/admin?section=connections&meta_error=${encodeURIComponent(e)}`);

  if (!code) return fail("no code returned");
  if (!appId || !appSecret) return fail("META_APP_ID / META_APP_SECRET not set");
  const redirectUri = process.env.META_REDIRECT_URI || `${origin}/api/admin/connect/meta/callback`;

  const tokenRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
  );
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return fail(tokenJson?.error?.message || "token exchange failed");

  const longRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenJson.access_token}`
  );
  const longJson = await longRes.json().catch(() => ({}));
  const accessToken = longJson.access_token || tokenJson.access_token;
  const expiresIn = longJson.expires_in || tokenJson.expires_in || null;

  await prisma.vendorConnection.upsert({
    where: { vendor: "meta" },
    update: { status: "CONNECTED", meta: { accessToken, expiresIn, connectedAt: new Date().toISOString() } },
    create: { vendor: "meta", status: "CONNECTED", meta: { accessToken, expiresIn, connectedAt: new Date().toISOString() } },
  });
  return NextResponse.redirect(`${origin}/admin?section=connections&meta_connected=1`);
}
