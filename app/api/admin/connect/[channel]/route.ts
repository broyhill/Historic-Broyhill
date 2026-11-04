import { NextRequest, NextResponse } from "next/server";

// Starts the provider OAuth handoff for a channel. Only Meta is wired today:
// with META_APP_ID + META_APP_SECRET + META_REDIRECT_URI set, this redirects the
// admin browser into Facebook's business-asset dialog. Other channels answer
// 501 until their flows land — nothing fakes a connection.
const CHANNELS = ["meta", "tiktok", "shopify", "wordpress"] as const;
type Channel = (typeof CHANNELS)[number];

export async function GET(req: NextRequest, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params;
  if (!CHANNELS.includes(channel as Channel)) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  }

  if (channel === "meta") {
    const appId = process.env.META_APP_ID;
    const redirectUri =
      process.env.META_REDIRECT_URI ?? `${req.nextUrl.origin}/api/admin/connect/meta/callback`;
    if (!appId || !process.env.META_APP_SECRET) {
      return NextResponse.json(
        {
          error: "Meta connect is not configured",
          needs: ["META_APP_ID", "META_APP_SECRET"],
          hint: "Create a Meta app at developers.facebook.com, add Marketing API, then set these in Vercel env.",
        },
        { status: 501 },
      );
    }
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "ads_management,ads_read,pages_read_engagement,instagram_basic");
    return NextResponse.redirect(url.toString());
  }

  return NextResponse.json(
    { error: `${channel} connect is not built yet`, channel },
    { status: 501 },
  );
}
