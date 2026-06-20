import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR, getAdVideo } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Serve an ad's video. Primary source is Supabase Storage (uploaded via the
 * advertiser form); falls back to a local uploads/<id>.mp4 for seeded demos.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const stored = await getAdVideo(id);
  if (stored) {
    return new Response(new Uint8Array(stored.bytes), {
      headers: {
        "content-type": stored.contentType,
        "content-length": String(stored.bytes.length),
        "cache-control": "public, max-age=3600",
      },
    });
  }

  const file = path.join(UPLOADS_DIR, `${id}.mp4`);
  if (!fs.existsSync(file)) return new Response("video not found", { status: 404 });
  const buf = fs.readFileSync(file);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(buf.length),
      "cache-control": "public, max-age=3600",
    },
  });
}
