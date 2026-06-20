import type { Address } from "@devads/shared";
import { txUrl } from "@devads/shared";
import { fetchNextAd, postClaim, fetchClaim } from "./coordinator";
import { downloadAd, playFile } from "./player";

const link = (url: string, label = url) => `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll the claim until the paymaster settles it on-chain; returns the tx hash. */
async function waitForPayout(id: string, tries = 15): Promise<string | undefined> {
  for (let i = 0; i < tries; i++) {
    const c = await fetchClaim(id);
    if (c?.txHash) return c.txHash;
    await sleep(2000);
  }
  return undefined;
}

/**
 * Show one ad in the terminal and, if watched to (near) the end, file a claim.
 * Returns true if a reward was queued.
 */
export async function watchOneAd(wallet: Address): Promise<boolean> {
  const ad = await fetchNextAd();
  if (!ad) {
    console.log("No ads available right now.");
    return false;
  }

  console.log(`\n\x1b[35m📺 ${ad.title}\x1b[0m — watch to earn \x1b[32m${ad.reward}\x1b[0m`);
  console.log(`   ${link(ad.clickUrl)}\n`);

  let watched: number;
  try {
    const file = await downloadAd(ad);
    watched = await playFile(file, ad.durationSec);
  } catch {
    // No video on file (or download failed) — still let the viewer earn.
    console.log(`\x1b[2m📺 playing ad (${ad.durationSec}s)…\x1b[0m`);
    await new Promise((r) => setTimeout(r, ad.durationSec * 1000));
    watched = ad.durationSec;
  }

  if (watched >= 0.9 * ad.durationSec) {
    const claim = await postClaim(ad, wallet);
    console.log(
      `\n\x1b[32m✓\x1b[0m watched ${watched.toFixed(0)}s — reward ${ad.reward} queued. ` +
        `\x1b[2msettling on Monad…\x1b[0m`,
    );
    const tx = await waitForPayout(claim.id);
    if (tx) {
      console.log(`\x1b[32m💸 paid ${ad.reward} → ${link(txUrl(tx), txUrl(tx))}\x1b[0m`);
    } else {
      console.log(`\x1b[2m   (still settling — run \`devads status\` in a moment)\x1b[0m`);
    }
    return true;
  }

  console.log(
    `\n⏭  only ${watched.toFixed(0)}s/${ad.durationSec}s watched — no reward.`,
  );
  return false;
}
