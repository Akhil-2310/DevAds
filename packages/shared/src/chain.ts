import { defineChain } from "viem";

/** Monad testnet — the chain everything settles on. */
export const MONAD_TESTNET_ID = 10143;

/** x402 network id (CAIP-2 form the facilitator expects). */
export const X402_NETWORK = "eip155:10143" as const;

/** USDC on Monad testnet (EIP-3009 transferWithAuthorization). 6 decimals. */
export const USDC_ADDRESS =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3" as const;
export const USDC_DECIMALS = 6;

/** Public x402 facilitator for Monad — verifies + settles, and pays gas. */
export const FACILITATOR_URL = "https://x402-facilitator.molandak.org";

export const MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
export const MONAD_EXPLORER_URL = "https://testnet.monadexplorer.com";

export const monadTestnet = defineChain({
  id: MONAD_TESTNET_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [MONAD_RPC_URL] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: MONAD_EXPLORER_URL },
  },
  testnet: true,
});

/** Build a clickable explorer link for a settled tx. */
export const txUrl = (hash: string) => `${MONAD_EXPLORER_URL}/tx/${hash}`;
