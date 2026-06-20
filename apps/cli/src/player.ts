import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { ServedAd } from "@devads/shared";
import { COORDINATOR_URL } from "./config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/cli/src -> apps/video/play.py
const PLAY_PY = path.resolve(__dirname, "..", "..", "video", "play.py");
const CACHE_DIR = path.join(os.homedir(), ".devads", "cache");

const pythonBin = process.platform === "win32" ? "python" : "python3";

export async function downloadAd(ad: ServedAd): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${ad.id}.mp4`);
  if (!fs.existsSync(file)) {
    const url = ad.videoUrl.startsWith("http")
      ? ad.videoUrl
      : `${COORDINATOR_URL}${ad.videoUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`video download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

/** Download the next ad into cache without playing (prewarm). */
export async function prewarm(ad: ServedAd): Promise<void> {
  try {
    await downloadAd(ad);
  } catch {
    /* best-effort */
  }
}

/**
 * Play the ad in the terminal via the Sixel/half-block player. Inherits stdio so
 * the escape codes render straight to the user's TTY. Resolves with seconds watched.
 */
export function playFile(file: string, opts: { widthPx?: number } = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const args = [PLAY_PY, file, "--width-px", String(opts.widthPx ?? 800)];
    const proc = spawn(pythonBin, args, { stdio: "inherit" });
    proc.on("error", reject);
    proc.on("exit", () => resolve((Date.now() - start) / 1000));
  });
}
