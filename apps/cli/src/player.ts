import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { stdout } from "node:process";
import type { ServedAd } from "@devads/shared";
import { COORDINATOR_URL } from "./config";

const CACHE_DIR = path.join(os.homedir(), ".devads", "cache");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function has(cmd: string, arg = "-version"): boolean {
  return spawnSync(cmd, [arg], { stdio: "ignore" }).status === 0;
}

/** Pick the best available renderer for this terminal. */
function termMode(): "kitty" | "iterm" | "halfblock" | "none" {
  if (!has("ffmpeg")) return "none";
  const tp = process.env.TERM_PROGRAM;
  // Kitty graphics protocol → crisp HD. Supported by kitty, WezTerm, and Warp
  // (post-init, which is exactly when the ad plays).
  if (process.env.KITTY_WINDOW_ID || process.env.TERM === "xterm-kitty" ||
      tp === "WarpTerminal" || tp === "WezTerm" || tp === "ghostty" || process.env.TERM_PROGRAM === "ghostty") {
    return "kitty";
  }
  // iTerm2's own inline-image protocol.
  if (tp === "iTerm.app" || process.env.LC_TERMINAL === "iTerm2") return "iterm";
  return "halfblock";
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

function startAudio(file: string, durationSec: number) {
  if (!has("ffplay")) return null;
  const a = spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "-loop", "0", "-t", String(durationSec), file], { stdio: "ignore" });
  a.on("error", () => {});
  return a;
}

/** HD path: ffmpeg → PNG frame stream → iTerm2 inline-image escapes (true pixels). */
function renderITerm(file: string, durationSec: number): Promise<number> {
  return new Promise((resolve) => {
    const cols = Math.min(stdout.columns || 80, 90);
    const ff = spawn(
      "ffmpeg",
      ["-loglevel", "quiet", "-stream_loop", "-1", "-re", "-i", file, "-t", String(durationSec),
       "-vf", "fps=20,scale=1280:-2:flags=lanczos", "-f", "image2pipe", "-vcodec", "png", "-"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const audio = startAudio(file, durationSec);
    const PNG_END = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1b[2J\x1b[H\x1b[?25l");

    ff.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      let i: number;
      while ((i = buf.indexOf(PNG_END)) !== -1) {
        const end = i + 12;
        const png = buf.subarray(0, end);
        buf = buf.subarray(end);
        // Redraw in place at the top-left each frame.
        stdout.write(`\x1b[H\x1b]1337;File=inline=1;width=${cols};preserveAspectRatio=1:${png.toString("base64")}\x07`);
      }
    });
    ff.on("error", () => { failed = true; });
    ff.on("close", async () => {
      stdout.write("\x1b[?25h\n");
      try { audio?.kill(); } catch { /* ignore */ }
      const el = (Date.now() - start) / 1000;
      if (failed || el < 1) { await sleep(Math.max(0, durationSec - el) * 1000); return resolve(durationSec); }
      resolve(Math.max(el, durationSec)); // played to the -t cap = full watch
    });
  });
}

/** HD path: ffmpeg → PNG frame stream → Kitty graphics protocol (Warp/kitty/WezTerm). */
function renderKitty(file: string, durationSec: number): Promise<number> {
  return new Promise((resolve) => {
    const ff = spawn(
      "ffmpeg",
      ["-loglevel", "quiet", "-stream_loop", "-1", "-re", "-i", file, "-t", String(durationSec),
       "-vf", "fps=15,scale=1280:-2:flags=lanczos", "-f", "image2pipe", "-vcodec", "png", "-"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const audio = startAudio(file, durationSec);
    const PNG_END = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1b[2J\x1b[H\x1b[?25l");

    const sendFrame = (png: Buffer<ArrayBufferLike>) => {
      const b64 = png.toString("base64");
      const CHUNK = 4096;
      let out = "\x1b[H"; // redraw in place
      for (let i = 0; i < b64.length; i += CHUNK) {
        const piece = b64.slice(i, i + CHUNK);
        const more = i + CHUNK < b64.length ? 1 : 0;
        // First chunk carries control keys (transmit+display PNG, reuse image id
        // 1 so each frame replaces the last → video). Rest carry only m=.
        out += i === 0
          ? `\x1b_Ga=T,f=100,q=2,C=1,i=1,m=${more};${piece}\x1b\\`
          : `\x1b_Gm=${more};${piece}\x1b\\`;
      }
      stdout.write(out);
    };

    ff.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      let i: number;
      while ((i = buf.indexOf(PNG_END)) !== -1) {
        const end = i + 12;
        sendFrame(buf.subarray(0, end));
        buf = buf.subarray(end);
      }
    });
    ff.on("error", () => { failed = true; });
    ff.on("close", async () => {
      stdout.write("\x1b_Ga=d,i=1,q=2\x1b\\\x1b[?25h\n"); // delete image, show cursor
      try { audio?.kill(); } catch { /* ignore */ }
      const el = (Date.now() - start) / 1000;
      if (failed || el < 1) { await sleep(Math.max(0, durationSec - el) * 1000); return resolve(durationSec); }
      resolve(Math.max(el, durationSec)); // played to the -t cap = full watch
    });
  });
}

/** Draw one RGB frame as ANSI 24-bit half-blocks (fallback for plain terminals). */
function drawFrame(frame: Buffer<ArrayBufferLike>, w: number, h: number) {
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

function renderHalfblock(file: string, durationSec: number): Promise<number> {
  return new Promise((resolve) => {
    const cols = Math.min(stdout.columns || 100, 120);
    const rows = Math.max(12, Math.round((cols * 9) / 16 / 2));
    const w = cols, h = rows * 2;
    const frameBytes = w * h * 3;
    const ff = spawn(
      "ffmpeg",
      ["-loglevel", "quiet", "-stream_loop", "-1", "-re", "-i", file, "-t", String(durationSec),
       "-vf", `fps=20,scale=${w}:${h}:flags=lanczos,setsar=1`,
       "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const audio = startAudio(file, durationSec);
    let buf: Buffer<ArrayBufferLike> = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1b[2J\x1b[H\x1b[?25l");
    ff.stdout.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= frameBytes) {
        drawFrame(buf.subarray(0, frameBytes), w, h);
        buf = buf.subarray(frameBytes);
      }
    });
    ff.on("error", () => { failed = true; });
    ff.on("close", async () => {
      stdout.write("\x1b[0m\x1b[?25h\n");
      try { audio?.kill(); } catch { /* ignore */ }
      const el = (Date.now() - start) / 1000;
      if (failed || el < 1) { await sleep(Math.max(0, durationSec - el) * 1000); return resolve(durationSec); }
      resolve(Math.max(el, durationSec)); // played to the -t cap = full watch
    });
  });
}

/**
 * Play the ad in the terminal — HD via the iTerm2 image protocol when available,
 * otherwise sharp half-blocks; if ffmpeg is missing, hold for the duration.
 */
export async function playFile(file: string, durationSec: number): Promise<number> {
  const mode = termMode();
  if (mode === "kitty") return renderKitty(file, durationSec);
  if (mode === "iterm") return renderITerm(file, durationSec);
  if (mode === "halfblock") return renderHalfblock(file, durationSec);
  console.log(`\x1b[2m📺 playing ad (${durationSec}s)…\x1b[0m`);
  await sleep(durationSec * 1000);
  return durationSec;
}
