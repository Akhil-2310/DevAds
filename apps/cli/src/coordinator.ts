import type { ServedAd, Claim, Address } from "@devads/shared";
import { COORDINATOR_URL } from "./config";

export async function fetchNextAd(): Promise<ServedAd | null> {
  const res = await fetch(`${COORDINATOR_URL}/api/ads/next`);
  if (!res.ok) return null;
  return (await res.json()) as ServedAd;
}

export async function postClaim(ad: ServedAd, wallet: Address): Promise<Claim> {
  const res = await fetch(`${COORDINATOR_URL}/api/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      adId: ad.id,
      consumerWallet: wallet,
      sessionNonce: ad.sessionNonce,
    }),
  });
  if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as Claim;
}
