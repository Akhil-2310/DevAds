import { NextRequest, NextResponse } from "next/server";
import { listAds, createAd, uploadAdVideo } from "@/lib/store";
import type { Address } from "@devads/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listAds());
}

/**
 * Create a campaign + ad. Accepts either JSON (no video) or multipart/form-data
 * with a `video` file, which is uploaded to Supabase Storage and served via
 * GET /api/ads/:id/video.
 */
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const title = form.get("title") as string | null;
    const advertiser = form.get("advertiser") as string | null;
    if (!title || !advertiser) {
      return NextResponse.json({ error: "title and advertiser required" }, { status: 400 });
    }
    const ad = await createAd({
      title,
      clickUrl: (form.get("clickUrl") as string) ?? "",
      reward: (form.get("reward") as string) ?? "$0.01",
      durationSec: Number(form.get("durationSec") ?? 30),
      budgetRemaining: Number(form.get("budget") ?? 1),
      advertiser: advertiser as Address,
    });

    const video = form.get("video") as File | null;
    if (video && video.size > 0) {
      const buf = Buffer.from(await video.arrayBuffer());
      await uploadAdVideo(ad.id, buf, video.type || "video/mp4");
    }
    return NextResponse.json(ad, { status: 201 });
  }

  const body = await req.json();
  if (!body.title || !body.advertiser) {
    return NextResponse.json({ error: "title and advertiser required" }, { status: 400 });
  }
  const ad = await createAd({
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
