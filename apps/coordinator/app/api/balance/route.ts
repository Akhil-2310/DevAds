import { NextRequest, NextResponse } from "next/server";
import { usdcBalance, type Address } from "@devads/shared";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  try {
    const balance = await usdcBalance(address as Address);
    return NextResponse.json({ address, balance });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
