import { privateKeyToAccount } from "viem/accounts";
import { usdcBalance, type Address } from "@devads/shared";

const pk = process.env.PRIVATE_KEY;
if (!pk) throw new Error("PRIVATE_KEY not set");
const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Address);
const payTo = process.env.PAY_TO_ADDRESS as Address | undefined;

console.log("payer:", account.address, "USDC:", await usdcBalance(account.address));
if (payTo) console.log("payTo:", payTo, "USDC:", await usdcBalance(payTo));
