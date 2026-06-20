import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { monadTestnet, USDC_ADDRESS, USDC_DECIMALS } from "./chain";
import type { Address } from "./types";

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

/** USDC balance as a decimal string, e.g. "1.230000". */
export async function usdcBalance(address: Address): Promise<string> {
  const raw = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(raw, USDC_DECIMALS);
}

/** USDC balance as a number (for arithmetic / display). */
export async function usdcBalanceNum(address: Address): Promise<number> {
  return Number(await usdcBalance(address));
}
