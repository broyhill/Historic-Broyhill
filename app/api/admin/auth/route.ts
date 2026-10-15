import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_MAX_AGE, createSessionToken, safeEqual } from "@/lib/admin-auth";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Admin access is not configured" }, { status: 500 });
  }

  try {
    const { passcode } = await request.json();
    if (typeof passcode !== "string" || !safeEqual(passcode, secret)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, await createSessionToken(secret), {
      ...cookieOptions,
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
