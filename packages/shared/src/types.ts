export type Address = `0x${string}`;

export type Ad = {
  id: string;
  title: string;
  /** <coordinator>/ads/:id/video */
  videoUrl: string;
  /** product link shown under the ad as an OSC-8 hyperlink */
  clickUrl: string;
  /** x402 price string, e.g. "$0.01" */
  reward: string;
  durationSec: number;
  /** remaining campaign budget in whole USDC (dollars) */
  budgetRemaining: number;
  advertiser: Address;
};

export type ClaimStatus = "pending" | "paid" | "rejected";

export type Claim = {
  id: string;
  adId: string;
  consumerWallet: Address;
  /** nonce the coordinator issued when the ad was served (anti-replay) */
  sessionNonce: string;
  reward: string;
  status: ClaimStatus;
  createdAt: number;
  txHash?: string;
};

/** What the CLI receives from GET /ads/next */
export type ServedAd = Ad & { sessionNonce: string };
