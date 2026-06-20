import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, upsertUserByAddress } from "@/lib/auth";

export async function POST(req: Request) {
  const { address } = await req.json().catch(() => ({}));
  if (!address || typeof address !== "string") {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }
  const user = await upsertUserByAddress(address);
  cookies().set(SESSION_COOKIE, address.toLowerCase(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json({
    user: { id: user.id, address: user.walletAddress, role: user.role },
  });
}
