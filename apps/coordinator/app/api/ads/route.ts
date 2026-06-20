import { NextRequest, NextResponse } from "next/server";
import { listAds, createAd } from "@/lib/store";
import type { Address } from "@devads/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(listAds());
}

// JSON create. The mp4 is uploaded separately (or seeded into uploads/<id>.mp4).
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.title || !body.advertiser) {
    return NextResponse.json({ error: "title and advertiser required" }, { status: 400 });
  }
  const ad = createAd({
    id: body.id,
    title: body.title,
    clickUrl: body.clickUrl ?? "",
    reward: body.reward ?? "$0.01",
    durationSec: body.durationSec ?? 30,
    budgetRemaining: body.budget ?? 1,
    advertiser: body.advertiser as Address,
  });
  return NextResponse.json(ad, { status: 201 });
}
