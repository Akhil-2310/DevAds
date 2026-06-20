import { usdcBalance, txUrl } from "@devads/shared";
import { makePaymentFetch } from "./x402-client";

const COORDINATOR_URL = process.env.COORDINATOR_URL ?? "http://localhost:3000";
const PAY_TO = process.env.PAY_TO_ADDRESS as `0x${string}` | undefined;

async function main() {
  const { paymentFetch, address } = makePaymentFetch();
  console.log("Paymaster (payer):", address);
  console.log("USDC before:", await usdcBalance(address));
  if (PAY_TO) console.log("PAY_TO   before:", await usdcBalance(PAY_TO));

  console.log(`\n→ GET ${COORDINATOR_URL}/api/smoke (expect 402 → pay → 200)\n`);
  const res = await paymentFetch(`${COORDINATOR_URL}/api/smoke`, { method: "GET" });
  console.log("HTTP status:", res.status);

  // withX402 returns the settlement details in a payment-response header (base64 JSON).
  const header =
    res.headers.get("x-payment-response") ??
    res.headers.get("payment-response") ??
    res.headers.get("x-payment");
  if (header) {
    try {
      const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      console.log("Settlement:", decoded);
      if (decoded.transaction) console.log("Explorer:", txUrl(decoded.transaction));
    } catch {
      console.log("Payment-response header (raw):", header);
    }
  } else {
    console.log("(no payment-response header found; headers:)", [...res.headers.keys()]);
  }

  console.log("\nBody:", await res.text());
  console.log("\nUSDC after :", await usdcBalance(address));
  if (PAY_TO) console.log("PAY_TO   after :", await usdcBalance(PAY_TO));
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
