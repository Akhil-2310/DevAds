import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key. All DB access in the
 * coordinator happens in API routes (server), so we use the privileged key
 * which bypasses RLS. Never import this into a client component.
 */
const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

function create(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const db: SupabaseClient =
  globalForSupabase.supabaseAdmin ?? create();

if (process.env.NODE_ENV !== "production") globalForSupabase.supabaseAdmin = db;
