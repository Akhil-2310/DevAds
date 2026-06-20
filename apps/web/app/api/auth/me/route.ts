import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/supabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });

  const { data: advertiser } = await db
    .from("Advertiser")
    .select("id, companyName")
    .eq("userId", user.id)
    .maybeSingle();

  return NextResponse.json({
    user: {
      id: user.id,
      address: user.walletAddress,
      role: user.role,
      displayName: user.displayName,
      totalRewards: Number(user.totalRewards),
      totalViews: user.totalViews,
      advertiser: advertiser ?? null,
    },
  });
}
