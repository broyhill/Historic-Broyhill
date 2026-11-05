import { NextResponse } from "next/server";

// Reports which ad/sales channels have OAuth credentials configured in env.
// Never returns secret values — only whether each channel is wired.
export async function GET() {
  return NextResponse.json({
    channels: {
      meta: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET),
      tiktok: Boolean(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET),
      shopify: Boolean(process.env.SHOPIFY_APP_ID && process.env.SHOPIFY_APP_SECRET),
      wordpress: Boolean(process.env.WORDPRESS_SITE_URL),
    },
  });
}
