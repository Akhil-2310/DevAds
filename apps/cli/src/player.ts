import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stdout } from "node:process";
import type { ServedAd } from "@devads/shared";
import { COORDINATOR_URL } from "./config";

const CACHE_DIR = path.join(os.homedir(), ".devads", "cache");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function has(cmd: string, arg = "-version"): boolean {
  return spawnSync(cmd, [arg], { stdio: "ignore" }).status === 0;
}

export async function downloadAd(ad: ServedAd): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${ad.id}.mp4`);
  if (!fs.existsSync(file)) {
    const url = ad.videoUrl.startsWith("http") ? ad.videoUrl : `${COORDINATOR_URL}${ad.videoUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`video download failed: ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

export async function prewarm(ad: ServedAd): Promise<void> {
  try { await downloadAd(ad); } catch { /* best-effort */ }
}

/** Draw one RGB frame as ANSI 24-bit half-blocks (▀ = top pixel fg, bottom pixel bg). */
function drawFrame(frame: Buffer, w: number, h: number) {
  let out = "\x1b[H";
  for (let y = 0; y < h - 1; y += 2) {
    for (let x = 0; x < w; x++) {
      const t = (y * w + x) * 3;
      const b = ((y + 1) * w + x) * 3;
      out += `\x1b[38;2;${frame[t]};${frame[t + 1]};${frame[t + 2]};48;2;${frame[b]};${frame[b + 1]};${frame[b + 2]}m▀`;
    }
    out += "\x1b[0m\n";
  }
  stdout.write(out);
}

/** Render the ad in-terminal via ffmpeg (rawvideo → half-blocks). Resolves seconds shown. */
function renderInTerminal(file: string, durationSec: number): Promise<number> {
  return new Promise((resolve) => {
    const cols = Math.min(stdout.columns || 100, 100);
    const rows = Math.max(12, Math.round((cols * 9) / 16 / 2)); // ~16:9
    const w = cols;
    const h = rows * 2;
    const frameBytes = w * h * 3;

    // -stream_loop -1 loops a short clip; -t caps total playback to the ad's
    // duration so the watch window is met regardless of clip length.
    const ff = spawn(
      "ffmpeg",
      ["-loglevel", "quiet", "-stream_loop", "-1", "-re", "-i", file, "-t", String(durationSec),
       "-vf", `fps=20,scale=${w}:${h}:flags=bilinear,setsar=1`,
       "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    // Best-effort looping audio alongside the visuals.
    const audio = has("ffplay")
      ? spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "-loop", "0", "-t", String(durationSec), file], { stdio: "ignore" })
      : null;
    audio?.on("error", () => {});

    const start = Date.now();
    let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let failed = false;
    stdout.write("\x1b[2J\x1b[H\x1b[?25l"); // clear, home, hide cursor

    ff.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= frameBytes) {
        drawFrame(buf.subarray(0, frameBytes), w, h);
        buf = buf.subarray(frameBytes);
      }
    });
    ff.on("error", () => { failed = true; });
    ff.on("close", async () => {
      stdout.write("\x1b[0m\x1b[?25h\n"); // reset color, show cursor
      try { audio?.kill(); } catch { /* ignore */ }
      const elapsed = (Date.now() - start) / 1000;
      if (failed || elapsed < 1) { await sleep(Math.max(0, durationSec - elapsed) * 1000); return resolve(durationSec); }
      resolve(elapsed);
    });
  });
}

/**
 * Play the ad in the terminal. Prefers the ffmpeg half-block renderer; if ffmpeg
 * is unavailable, holds for the ad's duration so the watch still counts.
 */
export async function playFile(file: string, durationSec: number): Promise<number> {
  if (has("ffmpeg")) return renderInTerminal(file, durationSec);
  console.log(`\x1b[2m📺 playing ad (${durationSec}s)…\x1b[0m`);
  await sleep(durationSec * 1000);
  return durationSec;
}
