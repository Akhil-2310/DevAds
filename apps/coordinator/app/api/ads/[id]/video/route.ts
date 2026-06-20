import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = path.join(UPLOADS_DIR, `${id}.mp4`);
  if (!fs.existsSync(file)) {
    return new Response("video not found", { status: 404 });
  }
  // Demo videos are a few MB — read into memory for a simple, range-free response.
  const buf = fs.readFileSync(file);
  return new Response(buf, {
    headers: {
      "content-type": "video/mp4",
      "content-length": String(buf.length),
      "cache-control": "public, max-age=3600",
    },
  });
}
