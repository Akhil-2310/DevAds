import { NextRequest, NextResponse } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { x402Server, MONAD_NETWORK } from "@/lib/x402-server";
import { getClaim, markClaimPaid, setClaimTx } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The x402-protected "proof of watch" endpoint. The advertiser's paymaster agent
 * GETs this, receives a 402 whose payTo is THIS claim's consumer wallet, signs the
 * USDC transferWithAuthorization, and the facilitator settles advertiser→consumer.
 * Fetching the proof IS the payout.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const claim = await getClaim(id);
  if (!claim) return NextResponse.json({ error: "unknown claim" }, { status: 404 });
  if (claim.status === "paid") {
    return NextResponse.json({ error: "already paid" }, { status: 409 });
  }

  const routeConfig: RouteConfig = {
    accepts: {
      scheme: "exact",
      network: MONAD_NETWORK,
      payTo: claim.consumerWallet, // ← dynamic, per claim
      price: claim.reward,
    },
    resource: `${process.env.COORDINATOR_URL ?? "http://localhost:3000"}/api/claims/${id}/proof`,
  };

  const wrapped = withX402(
    async () => {
      // Reaching the handler means the payment was verified; withX402 settles
      // after this returns < 400. Mark paid here (demo-acceptable optimism).
      await markClaimPaid(id);
      return NextResponse.json({
        proof: { claimId: id, adId: claim.adId, paidTo: claim.consumerWallet },
      });
    },
    routeConfig,
    x402Server,
  );

  const res = await wrapped(req);

  // After settlement, x402 sets x-payment-response (base64 JSON with the tx
  // hash). Persist it so the CLI can show the viewer their payout tx link.
  const header = res.headers.get("x-payment-response") ?? res.headers.get("payment-response");
  if (header) {
    try {
      const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      if (decoded.transaction) await setClaimTx(id, decoded.transaction);
    } catch {
      /* non-JSON header — ignore */
    }
  }
  return res;
}
