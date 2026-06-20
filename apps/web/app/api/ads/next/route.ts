import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { db, type Ad, type Campaign } from "@/lib/supabase";

type CampaignWithAds = Campaign & {
  Ad: Ad[];
  Advertiser: { companyName: string } | null;
};

/** Serve the next eligible ad and open an AdView (impression). */
export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "connect wallet" }, { status: 401 });

  // Active campaigns + their ads + advertiser name.
  const { data, error } = await db
    .from("Campaign")
    .select("*, Ad(*), Advertiser(companyName)")
    .eq("status", "ACTIVE")
    .order("createdAt", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const campaigns = (data ?? []) as CampaignWithAds[];

  // Must have at least one ad and enough budget for one more reward.
  const eligible = campaigns.filter(
    (c) =>
      c.Ad.length > 0 &&
      Number(c.spent) + Number(c.rewardPerView) <= Number(c.budget)
  );
  if (eligible.length === 0) {
    return NextResponse.json({ ad: null, reason: "no_inventory" });
  }

  // Prefer the highest reward, then a random ad within that campaign.
  const campaign = eligible.sort(
    (a, b) => Number(b.rewardPerView) - Number(a.rewardPerView)
  )[0];
  const ad = campaign.Ad[Math.floor(Math.random() * campaign.Ad.length)];

  const reward = Number(campaign.rewardPerView);
  const { data: viewId, error: rpcErr } = await db.rpc("open_ad_view", {
    p_ad_id: ad.id,
    p_campaign_id: campaign.id,
    p_user_id: user.id,
    p_reward: reward,
    p_proof_token: randomUUID(),
  });
  if (rpcErr)
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });

  return NextResponse.json({
    viewId,
    ad: {
      id: ad.id,
      type: ad.type,
      title: ad.title,
      description: ad.description,
      mediaUrl: ad.mediaUrl,
      durationSec: ad.durationSec,
      ctaText: ad.ctaText,
      ctaUrl: ad.ctaUrl,
      advertiser: campaign.Advertiser?.companyName ?? null,
    },
    reward: {
      total: reward,
      toUser: reward / 2,
      toPlatform: reward / 2,
    },
  });
}
