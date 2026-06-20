import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  monadTestnet,
  USDC_ADDRESS,
  USDC_DECIMALS,
  erc20Abi,
} from "./chain";
import { toUsdcUnits } from "./utils";

export const hasPaymaster = () => Boolean(process.env.PRIVATE_KEY);

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

function paymasterAccount() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) return null;
  const hex = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  return privateKeyToAccount(hex);
}

export type PayoutResult = {
  status: "PAID" | "FAILED" | "SIMULATED";
  txHash?: string;
  error?: string;
};

/**
 * Pay a USDC reward to a user on Monad testnet.
 * Real on-chain transfer when PRIVATE_KEY is set + wallet is funded; otherwise
 * returns SIMULATED so the platform's reward flow always completes in demo mode.
 */
export async function payUsdcReward(
  to: string,
  amount: number
): Promise<PayoutResult> {
  const account = paymasterAccount();
  if (!account || amount <= 0) {
    return { status: "SIMULATED" };
  }
  try {
    const wallet = createWalletClient({
      account,
      chain: monadTestnet,
      transport: http(),
    });
    const hash = await wallet.writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, toUsdcUnits(amount)],
    });
    return { status: "PAID", txHash: hash };
  } catch (err) {
    return {
      status: "FAILED",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function usdcBalance(address: string): Promise<number> {
  try {
    const raw = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return Number(formatUnits(raw as bigint, USDC_DECIMALS));
  } catch {
    return 0;
  }
}

export function paymasterAddress(): string | null {
  return paymasterAccount()?.address ?? null;
}
