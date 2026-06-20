import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";

const BUCKET = "ad-media";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const hasSupabaseStorage = () => Boolean(supabaseAdmin());

/**
 * Upload ad media. Uses Supabase Storage when configured; otherwise falls back
 * to the local public/uploads folder so uploads work out of the box in dev.
 */
export async function uploadAdMedia(
  bytes: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const safe = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const supabase = supabaseAdmin();

  if (supabase) {
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(safe, bytes, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(safe);
    return data.publicUrl;
  }

  // Local dev fallback
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, safe), bytes);
  return `/uploads/${safe}`;
}
