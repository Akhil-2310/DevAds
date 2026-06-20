import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Ad, Claim, ClaimStatus, Address, ServedAd } from "@devads/shared";
import { db } from "./supabase";

// Kept for the local-file fallback in the video route until Phase 3 moves
// uploads to Supabase Storage.
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const CREDITS_PER_VIEW = Number(process.env.CREDITS_PER_VIEW ?? 10);

const dollars = (reward: string): number => Number(reward.replace("$", "")) || 0;
const toReward = (n: number): string => `$${n}`;

/** Map a joined Ad+Campaign(+Advertiser→User) row to the shared Ad shape. */
function mapAd(row: any): Ad {
  const camp = row.Campaign ?? {};
  const wallet: Address =
    camp.Advertiser?.User?.walletAddress ??
    "0x0000000000000000000000000000000000000000";
  return {
    id: row.id,
    title: row.title,
    videoUrl: `/api/ads/${row.id}/video`,
    clickUrl: row.ctaUrl ?? "",
    reward: toReward(Number(camp.rewardPerView ?? 0)),
    durationSec: row.durationSec ?? 8,
    budgetRemaining: Number(camp.budget ?? 0) - Number(camp.spent ?? 0),
    advertiser: wallet,
  };
}

const AD_SELECT =
  "id, title, durationSec, ctaUrl, mediaUrl, Campaign(status, budget, spent, rewardPerView, Advertiser(User(walletAddress)))";

export async function listAds(): Promise<Ad[]> {
  const { data, error } = await db.from("Ad").select(AD_SELECT);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAd);
}

export async function getAd(id: string): Promise<Ad | undefined> {
  const { data } = await db.from("Ad").select(AD_SELECT).eq("id", id).single();
  return data ? mapAd(data) : undefined;
}

export async function createAd(input: {
  id?: string;
  title: string;
  clickUrl: string;
  reward: string;
  durationSec: number;
  budgetRemaining: number;
  advertiser: Address;
}): Promise<Ad> {
  // Ensure the advertiser User + Advertiser rows exist.
  const { data: userId, error: uErr } = await db.rpc("ensure_user", {
    p_wallet: input.advertiser,
    p_role: "ADVERTISER",
  });
  if (uErr) throw new Error(uErr.message);

  const { data: adv, error: aErr } = await db
    .from("Advertiser")
    .upsert({ userId, companyName: input.advertiser }, { onConflict: "userId" })
    .select("id")
    .single();
  if (aErr) throw new Error(aErr.message);

  const { data: camp, error: cErr } = await db
    .from("Campaign")
    .insert({
      advertiserId: adv.id,
      name: input.title,
      status: "ACTIVE",
      budget: input.budgetRemaining,
      rewardPerView: dollars(input.reward),
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const { data: ad, error: adErr } = await db
    .from("Ad")
    .insert({
      campaignId: camp.id,
      type: "VIDEO",
      title: input.title,
      mediaUrl: "", // Phase 3: Supabase Storage object path
      durationSec: input.durationSec,
      ctaUrl: input.clickUrl,
    })
    .select(AD_SELECT)
    .single();
  if (adErr) throw new Error(adErr.message);
  return mapAd(ad);
}

/** Pick the next ACTIVE ad with budget left and attach a fresh anti-replay nonce. */
export async function nextAd(): Promise<ServedAd | undefined> {
  const { data, error } = await db.from("Ad").select(AD_SELECT);
  if (error) throw new Error(error.message);
  const eligible = (data ?? []).filter((r: any) => {
    const c = r.Campaign;
    return (
      c?.status === "ACTIVE" &&
      Number(c.budget) - Number(c.spent) >= Number(c.rewardPerView)
    );
  });
  // Prefer an ad that actually has an uploaded video; fall back to any eligible.
  const row = eligible.find((r: any) => r.mediaUrl && r.mediaUrl.length > 0) ?? eligible[0];
  if (!row) return undefined;
  return { ...mapAd(row), sessionNonce: randomUUID() };
}

/** Map an AdView row (joined to its viewer) to the shared Claim shape. */
function mapClaim(row: any): Claim {
  return {
    id: row.id,
    adId: row.adId,
    consumerWallet: row.User?.walletAddress as Address,
    sessionNonce: row.proofToken,
    reward: toReward(Number(row.rewardAmount ?? 0)),
    status: row.payoutStatus === "PAID" ? "paid" : "pending",
    createdAt: row.startedAt ? Date.parse(row.startedAt) : Date.now(),
    txHash: row.txHash ?? undefined,
  };
}

const CLAIM_SELECT =
  "id, adId, proofToken, rewardAmount, payoutStatus, txHash, startedAt, User(walletAddress)";

export async function createClaim(
  adId: string,
  consumerWallet: Address,
  sessionNonce: string,
): Promise<Claim | { error: string }> {
  const { data, error } = await db.rpc("record_claim", {
    p_ad_id: adId,
    p_wallet: consumerWallet,
    p_nonce: sessionNonce,
    p_credits: CREDITS_PER_VIEW,
  });
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return {
    id: data.id,
    adId: data.adId,
    consumerWallet: data.consumerWallet,
    sessionNonce: data.sessionNonce,
    reward: toReward(Number(data.rewardAmount)),
    status: "pending",
    createdAt: Number(data.createdAt),
  };
}

export async function listClaims(status?: ClaimStatus): Promise<Claim[]> {
  let q = db.from("AdView").select(CLAIM_SELECT);
  if (status === "pending") q = q.eq("payoutStatus", "PENDING");
  else if (status === "paid") q = q.eq("payoutStatus", "PAID");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapClaim);
}

export async function getClaim(id: string): Promise<Claim | undefined> {
  const { data } = await db
    .from("AdView")
    .select(CLAIM_SELECT)
    .eq("id", id)
    .single();
  return data ? mapClaim(data) : undefined;
}

const BUCKET = "ads";

/** Upload an ad's video to Supabase Storage and point the Ad row at it. */
export async function uploadAdVideo(
  id: string,
  bytes: Buffer | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const objectPath = `${id}.mp4`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(objectPath, bytes, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  const { error: uErr } = await db.from("Ad").update({ mediaUrl: objectPath }).eq("id", id);
  if (uErr) throw new Error(uErr.message);
}

/** Fetch an ad's video bytes from Storage; null if not uploaded yet. */
export async function getAdVideo(
  id: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const { data, error } = await db.storage.from(BUCKET).download(`${id}.mp4`);
  if (error || !data) return null;
  return {
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "video/mp4",
  };
}

/** Record the on-chain settlement tx hash on a claim (after x402 settles). */
export async function setClaimTx(id: string, txHash: string): Promise<void> {
  await db.from("AdView").update({ txHash }).eq("id", id);
  await db.from("Reward").update({ txHash }).eq("adViewId", id);
}

/** Mark a claim paid + run the settlement ledger. Returns the updated claim. */
export async function markClaimPaid(
  id: string,
  txHash?: string,
): Promise<Claim | undefined> {
  const { error } = await db.rpc("settle_claim", {
    p_view_id: id,
    p_tx: txHash ?? null,
  });
  if (error) throw new Error(error.message);
  return getClaim(id);
}
