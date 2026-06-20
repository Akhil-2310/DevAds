import { privateKeyToAccount } from "viem/accounts";
import type { Address } from "./types";

/** Load the paymaster account from PRIVATE_KEY (demo wallet). */
export function loadAccount() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY is not set (see .env.example)");
  const hex = (pk.startsWith("0x") ? pk : `0x${pk}`) as Address;
  return privateKeyToAccount(hex);
}
