import type { Address } from "@devads/shared";
import { fetchNextAd, postClaim } from "./coordinator";
import { downloadAd, playFile } from "./player";

const link = (url: string, label = url) => `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;

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

  const file = await downloadAd(ad);
  const watched = await playFile(file);

  if (watched >= 0.9 * ad.durationSec) {
    const claim = await postClaim(ad, wallet);
    console.log(
      `\n\x1b[32m✓\x1b[0m watched ${watched.toFixed(0)}s — reward ${ad.reward} queued ` +
        `(claim ${claim.id.slice(0, 8)}). The paymaster settles it on Monad.`,
    );
    return true;
  }

  console.log(
    `\n⏭  only ${watched.toFixed(0)}s/${ad.durationSec}s watched — no reward.`,
  );
  return false;
}
