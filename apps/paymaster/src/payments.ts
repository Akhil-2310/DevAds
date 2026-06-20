import { txUrl, type Claim } from "@devads/shared";

const COORDINATOR_URL = process.env.COORDINATOR_URL ?? "http://localhost:3000";

export type PayResult = {
  ok: boolean;
  status: number;
  txHash?: string;
  explorer?: string;
  error?: string;
};

export async function listPendingClaims(): Promise<Claim[]> {
  const res = await fetch(`${COORDINATOR_URL}/api/claims?status=pending`);
  if (!res.ok) return [];
  return (await res.json()) as Claim[];
}

/**
 * Pay one claim by GETting its x402-protected proof endpoint. `paymentFetch`
 * (from makePaymentFetch) transparently answers the 402 by signing a USDC
 * transferWithAuthorization advertiser→consumer; the facilitator settles it.
 */
export async function payClaim(
  paymentFetch: typeof fetch,
  claim: Claim,
): Promise<PayResult> {
  const res = await paymentFetch(
    `${COORDINATOR_URL}/api/claims/${claim.id}/proof`,
    { method: "GET" },
  );

  let txHash: string | undefined;
  const header =
    res.headers.get("x-payment-response") ?? res.headers.get("payment-response");
  if (header) {
    try {
      const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      txHash = decoded.transaction;
    } catch {
      /* ignore non-JSON header */
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    txHash,
    explorer: txHash ? txUrl(txHash) : undefined,
    error: res.ok ? undefined : await res.text().catch(() => ""),
  };
}
