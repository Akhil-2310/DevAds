import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { payUsdcReward } from "@/lib/payout";

/**
 * Verify an ad was watched to completion, then:
 *  - allocate funds from the campaign budget (50% platform / 50% user),
 *  - record platform revenue + the user reward,
 *  - pay the user in USDC on Monad (x402-style settlement, demo-safe),
 *  - return a single-use proofToken that unlocks one AI prompt.
 *
 * The ledger update runs atomically in the `complete_ad_view` Postgres
 * function; the on-chain payout happens here and is written back via
 * `mark_payout`.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "connect wallet" }, { status: 401 });

  const { viewId } = await req.json().catch(() => ({}));
  if (!viewId)
    return NextResponse.json({ error: "viewId required" }, { status: 400 });

  const { data: result, error } = await db.rpc("complete_ad_view", {
    p_view_id: viewId,
    p_user_id: user.id,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  if (result?.error === "view_not_found")
    return NextResponse.json({ error: "view not found" }, { status: 404 });
  if (result?.error === "ad_not_completed")
    return NextResponse.json(
      { error: "ad_not_completed", needSec: result.needSec },
      { status: 400 }
    );
  if (result?.alreadyCompleted)
    return NextResponse.json({
      ok: true,
      proofToken: result.proofToken,
      alreadyCompleted: true,
    });

  const userReward = Number(result.userReward);
  const platformFee = Number(result.platformFee);

  // Pay the user (real on-chain when PRIVATE_KEY set + funded; else simulated).
  const payout = await payUsdcReward(result.walletAddress, userReward);
  await db.rpc("mark_payout", {
    p_view_id: viewId,
    p_status: payout.status,
    p_tx_hash: payout.txHash ?? null,
  });

  return NextResponse.json({
    ok: true,
    proofToken: result.proofToken,
    reward: {
      toUser: userReward,
      toPlatform: platformFee,
      status: payout.status,
      txHash: payout.txHash ?? null,
    },
  });
}
