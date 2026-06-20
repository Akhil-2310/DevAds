import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ANTHROPIC_BASE = "https://api.anthropic.com";

/**
 * Anthropic gateway proxy. The CLI points ANTHROPIC_BASE_URL here and sends its
 * DevAds token as x-api-key. We map the token → wallet, spend one credit per
 * /v1/messages turn, swap in the real ANTHROPIC_API_KEY, and stream Anthropic's
 * response straight back. The real key never leaves the server, and usage is
 * gated by ad-watching credits.
 */
async function proxy(req: NextRequest, path: string[]) {
  const token = req.headers.get("x-api-key");
  if (!token) {
    return NextResponse.json({ error: "missing x-api-key (DevAds token)" }, { status: 401 });
  }

  const { data: user } = await db
    .from("User")
    .select("walletAddress")
    .eq("cliToken", token)
    .single();
  if (!user) {
    return NextResponse.json({ error: "unknown token — run `devads register`" }, { status: 401 });
  }

  const isTurn = req.method === "POST" && path[path.length - 1] === "messages";
  if (isTurn) {
    const { data: remaining } = await db.rpc("consume_credit", {
      p_wallet: user.walletAddress,
    });
    if (remaining === null || remaining < 0) {
      // Sentinel the CLI watches for → triggers an ad break, then retries.
      return NextResponse.json(
        { type: "error", error: { type: "devads_no_credits", message: "Out of credits — watch an ad to earn more." } },
        { status: 402 },
      );
    }
  }

  const realKey = process.env.ANTHROPIC_API_KEY;
  if (!realKey) {
    return NextResponse.json({ error: "gateway misconfigured: no upstream key" }, { status: 500 });
  }

  const url = `${ANTHROPIC_BASE}/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  headers.set("x-api-key", realKey);
  headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  headers.set("anthropic-version", req.headers.get("anthropic-version") ?? "2023-06-01");
  const beta = req.headers.get("anthropic-beta");
  if (beta) headers.set("anthropic-beta", beta);

  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
  });

  // Stream the response body (SSE or JSON) back to the client unchanged.
  const outHeaders = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) outHeaders.set("content-type", ct);
  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await ctx.params).path);
}
