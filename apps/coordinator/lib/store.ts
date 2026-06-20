import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Ad, Claim, ClaimStatus, Address, ServedAd } from "@devads/shared";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type DB = { ads: Ad[]; claims: Claim[] };

// Seeded demo campaign. Its video lives at uploads/demo-ad.mp4 (copied from the
// videoterminal sample). Reward is a small x402 price so a funded wallet lasts.
const DEMO_AD: Ad = {
  id: "demo-ad",
  title: "BLD — ship onchain",
  videoUrl: "/api/ads/demo-ad/video",
  clickUrl: "https://monad.xyz",
  reward: process.env.DEFAULT_REWARD ?? "$0.01",
  durationSec: 8,
  budgetRemaining: 5,
  advertiser: "0x000000000000000000000000000000000000dEaD",
};

function load(): DB {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const seed: DB = { ads: [DEMO_AD], claims: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DB;
}

function save(db: DB) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function rewardToDollars(reward: string): number {
  return Number(reward.replace("$", "")) || 0;
}

export function listAds(): Ad[] {
  return load().ads;
}

export function getAd(id: string): Ad | undefined {
  return load().ads.find((a) => a.id === id);
}

export function createAd(input: {
  id?: string;
  title: string;
  clickUrl: string;
  reward: string;
  durationSec: number;
  budgetRemaining: number;
  advertiser: Address;
}): Ad {
  const db = load();
  const id = input.id ?? randomUUID().slice(0, 8);
  const ad: Ad = {
    id,
    title: input.title,
    videoUrl: `/api/ads/${id}/video`,
    clickUrl: input.clickUrl,
    reward: input.reward,
    durationSec: input.durationSec,
    budgetRemaining: input.budgetRemaining,
    advertiser: input.advertiser,
  };
  db.ads.push(ad);
  save(db);
  return ad;
}

/** Pick the next ad with budget left and attach a fresh anti-replay nonce. */
export function nextAd(): ServedAd | undefined {
  const ad = load().ads.find((a) => a.budgetRemaining > 0);
  if (!ad) return undefined;
  return { ...ad, sessionNonce: randomUUID() };
}

export function createClaim(
  adId: string,
  consumerWallet: Address,
  sessionNonce: string,
): Claim | { error: string } {
  const db = load();
  const ad = db.ads.find((a) => a.id === adId);
  if (!ad) return { error: "unknown ad" };
  if (ad.budgetRemaining <= 0) return { error: "campaign out of budget" };
  const claim: Claim = {
    id: randomUUID(),
    adId,
    consumerWallet,
    sessionNonce,
    reward: ad.reward,
    status: "pending",
    createdAt: Date.now(),
  };
  db.claims.push(claim);
  save(db);
  return claim;
}

export function listClaims(status?: ClaimStatus): Claim[] {
  const claims = load().claims;
  return status ? claims.filter((c) => c.status === status) : claims;
}

export function getClaim(id: string): Claim | undefined {
  return load().claims.find((c) => c.id === id);
}

/** Mark a claim paid and draw down the campaign budget. */
export function markClaimPaid(id: string, txHash?: string): Claim | undefined {
  const db = load();
  const claim = db.claims.find((c) => c.id === id);
  if (!claim) return undefined;
  claim.status = "paid";
  if (txHash) claim.txHash = txHash;
  const ad = db.ads.find((a) => a.id === claim.adId);
  if (ad) ad.budgetRemaining = Math.max(0, ad.budgetRemaining - rewardToDollars(claim.reward));
  save(db);
  return claim;
}
