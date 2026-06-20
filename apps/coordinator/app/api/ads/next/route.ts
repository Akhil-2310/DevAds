import { NextResponse } from "next/server";
import { nextAd } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ad = nextAd();
  if (!ad) return NextResponse.json({ error: "no ads available" }, { status: 404 });
  return NextResponse.json(ad);
}
