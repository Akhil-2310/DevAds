import { NextRequest, NextResponse } from "next/server";
import { getClaim } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Fetch a single claim (the CLI polls this for the settlement tx hash). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) return NextResponse.json({ error: "unknown claim" }, { status: 404 });
  return NextResponse.json(claim);
}
