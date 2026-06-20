import { makePaymentFetch } from "./x402-client";
import { listPendingClaims, payClaim } from "./payments";

const POLL_MS = Number(process.env.PAYMASTER_POLL_MS ?? 4000);

/**
 * The autonomous paymaster. It owns the advertiser wallet (env key) and settles
 * every valid proof-of-watch claim over x402 — no human in the loop.
 */
async function main() {
  const { paymentFetch, address } = makePaymentFetch();
  console.log("🤖 DevAds paymaster online");
  console.log(`   wallet : ${address}`);
  console.log(`   polling: every ${POLL_MS}ms — no human in the loop\n`);

  const inFlight = new Set<string>();

  for (;;) {
    try {
      const pending = await listPendingClaims();
      for (const claim of pending) {
        if (inFlight.has(claim.id)) continue;
        inFlight.add(claim.id);
        console.log(`→ claim ${claim.id} — paying ${claim.reward} to ${claim.consumerWallet}`);
        payClaim(paymentFetch, claim)
          .then((r) => {
            if (r.ok) console.log(`  ✓ settled${r.explorer ? ` — ${r.explorer}` : ""}`);
            else {
              console.log(`  ✗ failed (${r.status}): ${r.error}`);
              inFlight.delete(claim.id); // allow retry next tick
            }
          })
          .catch((e) => {
            console.error(`  ✗ error:`, e);
            inFlight.delete(claim.id);
          });
      }
    } catch (e) {
      console.error("loop error:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
