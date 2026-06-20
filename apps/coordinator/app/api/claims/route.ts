import { NextRequest, NextResponse } from "next/server";
import { listClaims, createClaim } from "@/lib/store";
import type { Address, ClaimStatus } from "@devads/shared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as ClaimStatus | null;
  return NextResponse.json(listClaims(status ?? undefined));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.adId || !body.consumerWallet || !body.sessionNonce) {
    return NextResponse.json(
      { error: "adId, consumerWallet, sessionNonce required" },
      { status: 400 },
    );
  }
  const result = createClaim(
    body.adId,
    body.consumerWallet as Address,
    body.sessionNonce,
  );
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
