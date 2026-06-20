import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";
import { X402_NETWORK, USDC_ADDRESS, FACILITATOR_URL } from "@devads/shared";

export const MONAD_NETWORK = X402_NETWORK as Network;

// One resource-server singleton for the whole coordinator process.
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
export const x402Server = new x402ResourceServer(facilitatorClient);

// Monad testnet USDC isn't in @x402/evm's DEFAULT_STABLECOINS (only mainnet is),
// so we teach the exact scheme how to price "$x" in this token, including the
// EIP-712 domain (name/version) the client needs to sign transferWithAuthorization.
const monadScheme = new ExactEvmScheme();
monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === MONAD_NETWORK) {
    return {
      amount: Math.floor(amount * 1_000_000).toString(), // USDC has 6 decimals
      asset: USDC_ADDRESS,
      extra: { name: "USDC", version: "2" },
    };
  }
  return null; // fall through to defaults for any other network
});

x402Server.register(MONAD_NETWORK, monadScheme);
