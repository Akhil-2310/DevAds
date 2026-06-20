import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key. All DB access in
 * this app happens in API routes (server), so we use the privileged key which
 * bypasses RLS. Never import this into client components.
 */
const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

function create(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const db: SupabaseClient =
  globalForSupabase.supabaseAdmin ?? create();

if (process.env.NODE_ENV !== "production") globalForSupabase.supabaseAdmin = db;

// --- Row types (kept in sync with supabase/migrations/*_init.sql) ----------

export type Role = "USER" | "ADVERTISER" | "ADMIN";
export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
export type AdType = "VIDEO" | "IMAGE" | "INTERACTIVE";
export type AdViewStatus = "STARTED" | "COMPLETED" | "ABANDONED";
export type PayoutStatus = "PENDING" | "PAID" | "FAILED" | "SIMULATED";

export interface User {
  id: string;
  walletAddress: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  totalRewards: number;
  totalViews: number;
  createdAt: string;
  updatedAt: string;
}

export interface Advertiser {
  id: string;
  userId: string;
  companyName: string;
  contactEmail: string | null;
  website: string | null;
  treasuryBalance: number;
  totalDeposited: number;
  totalSpent: number;
}

export interface Ad {
  id: string;
  campaignId: string;
  type: AdType;
  title: string;
  description: string | null;
  mediaUrl: string;
  durationSec: number;
  ctaText: string | null;
  ctaUrl: string | null;
}

export interface Campaign {
  id: string;
  advertiserId: string;
  name: string;
  status: CampaignStatus;
  budget: number;
  spent: number;
  rewardPerView: number;
  impressions: number;
  completions: number;
  createdAt: string;
}
