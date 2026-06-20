import { usdcBalance, type Address } from "@devads/shared";

/** A compact earnings status line, rendered between turns and after each ad. */
export async function earningsLine(wallet: Address): Promise<string> {
  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
  try {
    const bal = Number(await usdcBalance(wallet));
    return `\x1b[35m▮ DevAds\x1b[0m  earned \x1b[32m${bal.toFixed(3)} USDC\x1b[0m  ·  ${short}`;
  } catch {
    return `\x1b[35m▮ DevAds\x1b[0m  earnings unavailable  ·  ${short}`;
  }
}
