import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * CLI onboarding. The user provides their wallet address; we upsert the User
 * row and issue an opaque token the CLI stores and presents to the gateway
 * proxy as its Anthropic key. Re-registering rotates the token.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const wallet = body.wallet as string | undefined;
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json({ error: "valid wallet address required" }, { status: 400 });
  }
  const token = `devads_${randomUUID().replace(/-/g, "")}`;
  const { data, error } = await db.rpc("register_cli", {
    p_wallet: wallet,
    p_token: token,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
