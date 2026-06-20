import { NextRequest, NextResponse } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { x402Server, MONAD_NETWORK } from "@/lib/x402-server";

// Throwaway $0.001 endpoint to prove the x402 round-trip on Monad end to end.
// The paymaster (client) pays PAY_TO_ADDRESS; set it to any address you can watch.
const PAY_TO = process.env.PAY_TO_ADDRESS;
if (!PAY_TO) throw new Error("PAY_TO_ADDRESS is not set (see .env.example)");

const routeConfig: RouteConfig = {
  accepts: {
    scheme: "exact",
    network: MONAD_NETWORK,
    payTo: PAY_TO,
    price: "$0.001",
  },
  resource: "http://localhost:3000/api/smoke",
};

async function handler(_request: NextRequest) {
  return NextResponse.json({ ok: true, unlockedAt: new Date().toISOString() });
}

export const GET = withX402(handler, routeConfig, x402Server);
