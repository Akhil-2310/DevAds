import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { x402Client } from "@x402/core/client";
import { X402_NETWORK, type Address } from "@devads/shared";

/**
 * Build a fetch() that transparently pays x402 402-challenges by signing an
 * EIP-3009 transferWithAuthorization with the paymaster's env key. This is the
 * exact "agent is the x402 client that pays the consumer" mechanism.
 */
export function makePaymentFetch() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY is not set (see .env.example)");
  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : `0x${pk}`) as Address,
  );

  // The scheme only needs { address, signTypedData }. A viem LocalAccount's
  // signTypedData already matches the { domain, types, primaryType, message } shape.
  const evmSigner = {
    address: account.address,
    signTypedData: (message: any) => account.signTypedData(message),
  };

  const exactScheme = new ExactEvmScheme(evmSigner);
  const client = new x402Client().register(X402_NETWORK, exactScheme);
  const paymentFetch = wrapFetchWithPayment(fetch, client);

  return { paymentFetch, address: account.address };
}
