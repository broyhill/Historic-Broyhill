import { NextResponse } from "next/server";
import { createBrand, listBrands } from "@/lib/brands";

export const maxDuration = 30;

// Agency spine. GET: every client brand with its silo counts.
// POST {name, website}: lift the kit off the site and open a new brand silo.
export async function GET() {
  try {
    return NextResponse.json({ success: true, brands: await listBrands() });
  } catch (error: any) {
    console.error("brands list failed", error);
    return NextResponse.json({ error: "Could not load the brands." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}));
    const website = typeof b.website === "string" ? b.website : "";
    if (!website.trim()) return NextResponse.json({ error: "Give the client's website address." }, { status: 400 });
    const brand = await createBrand({ name: typeof b.name === "string" ? b.name : "", website });
    return NextResponse.json({ success: true, brand });
  } catch (error: any) {
    const aborted = error?.name === "AbortError";
    console.error("brand create failed", error);
    return NextResponse.json(
      { error: aborted ? "The site took too long to answer." : error?.message || "Could not add that brand." },
      { status: aborted ? 504 : 500 },
    );
  }
}
