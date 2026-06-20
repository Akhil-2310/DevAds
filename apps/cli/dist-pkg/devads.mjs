#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  }
  return null;
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}
function loadWallet() {
  const i = process.argv.indexOf("--wallet");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const cfg = loadConfig();
  if (cfg?.wallet) return cfg.wallet;
  throw new Error("No wallet configured. Run `devads register` first.");
}
async function registerWallet(wallet) {
  const res = await fetch(`${COORDINATOR_URL}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet })
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  const cfg = { wallet, token };
  saveConfig(cfg);
  return cfg;
}
var CONFIG_DIR, CONFIG_FILE, COORDINATOR_URL;
var init_config = __esm({
  "src/config.ts"() {
    "use strict";
    CONFIG_DIR = path.join(os.homedir(), ".devads");
    CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
    COORDINATOR_URL = process.env.COORDINATOR_URL ?? "https://devads-coordinator.vercel.app";
  }
});

// ../../packages/shared/src/chain.ts
import { defineChain } from "viem";
var MONAD_TESTNET_ID, USDC_ADDRESS, USDC_DECIMALS, MONAD_RPC_URL, MONAD_EXPLORER_URL, monadTestnet, txUrl;
var init_chain = __esm({
  "../../packages/shared/src/chain.ts"() {
    "use strict";
    MONAD_TESTNET_ID = 10143;
    USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
    USDC_DECIMALS = 6;
    MONAD_RPC_URL = "https://testnet-rpc.monad.xyz";
    MONAD_EXPLORER_URL = "https://testnet.monadexplorer.com";
    monadTestnet = defineChain({
      id: MONAD_TESTNET_ID,
      name: "Monad Testnet",
      nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
      rpcUrls: { default: { http: [MONAD_RPC_URL] } },
      blockExplorers: {
        default: { name: "Monad Explorer", url: MONAD_EXPLORER_URL }
      },
      testnet: true
    });
    txUrl = (hash) => `${MONAD_EXPLORER_URL}/tx/${hash}`;
  }
});

// ../../packages/shared/src/types.ts
var init_types = __esm({
  "../../packages/shared/src/types.ts"() {
    "use strict";
  }
});

// ../../packages/shared/src/signer.ts
import { privateKeyToAccount } from "viem/accounts";
var init_signer = __esm({
  "../../packages/shared/src/signer.ts"() {
    "use strict";
  }
});

// ../../packages/shared/src/usdc.ts
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
async function usdcBalance(address) {
  const raw = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address]
  });
  return formatUnits(raw, USDC_DECIMALS);
}
var publicClient;
var init_usdc = __esm({
  "../../packages/shared/src/usdc.ts"() {
    "use strict";
    init_chain();
    publicClient = createPublicClient({
      chain: monadTestnet,
      transport: http()
    });
  }
});

// ../../packages/shared/src/index.ts
var init_src = __esm({
  "../../packages/shared/src/index.ts"() {
    "use strict";
    init_chain();
    init_types();
    init_signer();
    init_usdc();
  }
});

// src/coordinator.ts
async function fetchNextAd() {
  const res = await fetch(`${COORDINATOR_URL}/api/ads/next`);
  if (!res.ok) return null;
  return await res.json();
}
async function fetchClaim(id) {
  const res = await fetch(`${COORDINATOR_URL}/api/claims/${id}`);
  if (!res.ok) return null;
  return await res.json();
}
async function postClaim(ad, wallet) {
  const res = await fetch(`${COORDINATOR_URL}/api/claims`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      adId: ad.id,
      consumerWallet: wallet,
      sessionNonce: ad.sessionNonce
    })
  });
  if (!res.ok) throw new Error(`claim failed: ${res.status} ${await res.text()}`);
  return await res.json();
}
var init_coordinator = __esm({
  "src/coordinator.ts"() {
    "use strict";
    init_config();
  }
});

// src/player.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { stdout } from "node:process";
function has(cmd, arg = "-version") {
  return spawnSync(cmd, [arg], { stdio: "ignore" }).status === 0;
}
function termMode() {
  if (!has("ffmpeg")) return "none";
  const tp = process.env.TERM_PROGRAM;
  if (process.env.KITTY_WINDOW_ID || process.env.TERM === "xterm-kitty" || tp === "WarpTerminal" || tp === "WezTerm" || tp === "ghostty" || process.env.TERM_PROGRAM === "ghostty") {
    return "kitty";
  }
  if (tp === "iTerm.app" || process.env.LC_TERMINAL === "iTerm2") return "iterm";
  return "halfblock";
}
async function downloadAd(ad) {
  fs2.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path2.join(CACHE_DIR, `${ad.id}.mp4`);
  if (!fs2.existsSync(file)) {
    const url = ad.videoUrl.startsWith("http") ? ad.videoUrl : `${COORDINATOR_URL}${ad.videoUrl}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`video download failed: ${res.status}`);
    fs2.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}
function startAudio(file, durationSec) {
  if (!has("ffplay")) return null;
  const a = spawn("ffplay", ["-nodisp", "-autoexit", "-loglevel", "quiet", "-loop", "0", "-t", String(durationSec), file], { stdio: "ignore" });
  a.on("error", () => {
  });
  return a;
}
function renderITerm(file, durationSec) {
  return new Promise((resolve) => {
    const cols = Math.min(stdout.columns || 80, 90);
    const ff = spawn(
      "ffmpeg",
      [
        "-loglevel",
        "quiet",
        "-stream_loop",
        "-1",
        "-re",
        "-i",
        file,
        "-t",
        String(durationSec),
        "-vf",
        "fps=20,scale=1280:-2:flags=lanczos",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-"
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    const audio = startAudio(file, durationSec);
    const PNG_END = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    let buf = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1B[2J\x1B[H\x1B[?25l");
    ff.stdout.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let i;
      while ((i = buf.indexOf(PNG_END)) !== -1) {
        const end = i + 12;
        const png = buf.subarray(0, end);
        buf = buf.subarray(end);
        stdout.write(`\x1B[H\x1B]1337;File=inline=1;width=${cols};preserveAspectRatio=1:${png.toString("base64")}\x07`);
      }
    });
    ff.on("error", () => {
      failed = true;
    });
    ff.on("close", async () => {
      stdout.write("\x1B[?25h\n");
      try {
        audio?.kill();
      } catch {
      }
      const el = (Date.now() - start) / 1e3;
      if (failed || el < 1) {
        await sleep(Math.max(0, durationSec - el) * 1e3);
        return resolve(durationSec);
      }
      resolve(Math.max(el, durationSec));
    });
  });
}
function renderKitty(file, durationSec) {
  return new Promise((resolve) => {
    const ff = spawn(
      "ffmpeg",
      [
        "-loglevel",
        "quiet",
        "-stream_loop",
        "-1",
        "-re",
        "-i",
        file,
        "-t",
        String(durationSec),
        "-vf",
        "fps=15,scale=1280:-2:flags=lanczos",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-"
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    const audio = startAudio(file, durationSec);
    const PNG_END = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    let buf = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1B[2J\x1B[H\x1B[?25l");
    const sendFrame = (png) => {
      const b64 = png.toString("base64");
      const CHUNK = 4096;
      let out = "\x1B[H";
      for (let i = 0; i < b64.length; i += CHUNK) {
        const piece = b64.slice(i, i + CHUNK);
        const more = i + CHUNK < b64.length ? 1 : 0;
        out += i === 0 ? `\x1B_Ga=T,f=100,q=2,C=1,i=1,m=${more};${piece}\x1B\\` : `\x1B_Gm=${more};${piece}\x1B\\`;
      }
      stdout.write(out);
    };
    ff.stdout.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      let i;
      while ((i = buf.indexOf(PNG_END)) !== -1) {
        const end = i + 12;
        sendFrame(buf.subarray(0, end));
        buf = buf.subarray(end);
      }
    });
    ff.on("error", () => {
      failed = true;
    });
    ff.on("close", async () => {
      stdout.write("\x1B_Ga=d,i=1,q=2\x1B\\\x1B[?25h\n");
      try {
        audio?.kill();
      } catch {
      }
      const el = (Date.now() - start) / 1e3;
      if (failed || el < 1) {
        await sleep(Math.max(0, durationSec - el) * 1e3);
        return resolve(durationSec);
      }
      resolve(Math.max(el, durationSec));
    });
  });
}
function drawFrame(frame, w, h) {
  let out = "\x1B[H";
  for (let y = 0; y < h - 1; y += 2) {
    for (let x = 0; x < w; x++) {
      const t = (y * w + x) * 3;
      const b = ((y + 1) * w + x) * 3;
      out += `\x1B[38;2;${frame[t]};${frame[t + 1]};${frame[t + 2]};48;2;${frame[b]};${frame[b + 1]};${frame[b + 2]}m\u2580`;
    }
    out += "\x1B[0m\n";
  }
  stdout.write(out);
}
function renderHalfblock(file, durationSec) {
  return new Promise((resolve) => {
    const cols = Math.min(stdout.columns || 100, 120);
    const rows = Math.max(12, Math.round(cols * 9 / 16 / 2));
    const w = cols, h = rows * 2;
    const frameBytes = w * h * 3;
    const ff = spawn(
      "ffmpeg",
      [
        "-loglevel",
        "quiet",
        "-stream_loop",
        "-1",
        "-re",
        "-i",
        file,
        "-t",
        String(durationSec),
        "-vf",
        `fps=20,scale=${w}:${h}:flags=lanczos,setsar=1`,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-"
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    const audio = startAudio(file, durationSec);
    let buf = Buffer.alloc(0);
    let failed = false;
    const start = Date.now();
    stdout.write("\x1B[2J\x1B[H\x1B[?25l");
    ff.stdout.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= frameBytes) {
        drawFrame(buf.subarray(0, frameBytes), w, h);
        buf = buf.subarray(frameBytes);
      }
    });
    ff.on("error", () => {
      failed = true;
    });
    ff.on("close", async () => {
      stdout.write("\x1B[0m\x1B[?25h\n");
      try {
        audio?.kill();
      } catch {
      }
      const el = (Date.now() - start) / 1e3;
      if (failed || el < 1) {
        await sleep(Math.max(0, durationSec - el) * 1e3);
        return resolve(durationSec);
      }
      resolve(Math.max(el, durationSec));
    });
  });
}
async function playFile(file, durationSec) {
  const mode = termMode();
  if (mode === "kitty") return renderKitty(file, durationSec);
  if (mode === "iterm") return renderITerm(file, durationSec);
  if (mode === "halfblock") return renderHalfblock(file, durationSec);
  console.log(`\x1B[2m\u{1F4FA} playing ad (${durationSec}s)\u2026\x1B[0m`);
  await sleep(durationSec * 1e3);
  return durationSec;
}
var CACHE_DIR, sleep;
var init_player = __esm({
  "src/player.ts"() {
    "use strict";
    init_config();
    CACHE_DIR = path2.join(os2.homedir(), ".devads", "cache");
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// src/earn.ts
async function waitForPayout(id, tries = 15) {
  for (let i = 0; i < tries; i++) {
    const c = await fetchClaim(id);
    if (c?.txHash) return c.txHash;
    await sleep2(2e3);
  }
  return void 0;
}
async function watchOneAd(wallet) {
  const ad = await fetchNextAd();
  if (!ad) {
    console.log("No ads available right now.");
    return false;
  }
  console.log(`
\x1B[35m\u{1F4FA} ${ad.title}\x1B[0m \u2014 watch to earn \x1B[32m${ad.reward}\x1B[0m`);
  console.log(`   ${link(ad.clickUrl)}
`);
  let watched;
  try {
    const file = await downloadAd(ad);
    watched = await playFile(file, ad.durationSec);
  } catch {
    console.log(`\x1B[2m\u{1F4FA} playing ad (${ad.durationSec}s)\u2026\x1B[0m`);
    await new Promise((r) => setTimeout(r, ad.durationSec * 1e3));
    watched = ad.durationSec;
  }
  if (watched >= 0.9 * ad.durationSec) {
    const claim = await postClaim(ad, wallet);
    console.log(
      `
\x1B[32m\u2713\x1B[0m watched ${watched.toFixed(0)}s \u2014 reward ${ad.reward} queued. \x1B[2msettling on Monad\u2026\x1B[0m`
    );
    const tx = await waitForPayout(claim.id);
    if (tx) {
      console.log(`\x1B[32m\u{1F4B8} paid ${ad.reward} \u2192 ${link(txUrl(tx), txUrl(tx))}\x1B[0m`);
    } else {
      console.log(`\x1B[2m   (still settling \u2014 run \`devads status\` in a moment)\x1B[0m`);
    }
    return true;
  }
  console.log(
    `
\u23ED  only ${watched.toFixed(0)}s/${ad.durationSec}s watched \u2014 no reward.`
  );
  return false;
}
var link, sleep2;
var init_earn = __esm({
  "src/earn.ts"() {
    "use strict";
    init_src();
    init_coordinator();
    init_player();
    link = (url, label = url) => `\x1B]8;;${url}\x1B\\${label}\x1B]8;;\x1B\\`;
    sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// src/statusline.ts
async function earningsLine(wallet) {
  const short = `${wallet.slice(0, 6)}\u2026${wallet.slice(-4)}`;
  try {
    const bal = Number(await usdcBalance(wallet));
    return `\x1B[35m\u25AE DevAds\x1B[0m  earned \x1B[32m${bal.toFixed(3)} USDC\x1B[0m  \xB7  ${short}`;
  } catch {
    return `\x1B[35m\u25AE DevAds\x1B[0m  earnings unavailable  \xB7  ${short}`;
  }
}
var init_statusline = __esm({
  "src/statusline.ts"() {
    "use strict";
    init_src();
  }
});

// src/repl.ts
var repl_exports = {};
__export(repl_exports, {
  runCodingRepl: () => runCodingRepl
});
import * as readline from "node:readline/promises";
import { stdin, stdout as stdout2 } from "node:process";
import fs3 from "node:fs";
import path3 from "node:path";
import { execFile } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
function safeResolve(p) {
  if (!p) throw new Error("path is required");
  const abs = path3.resolve(ROOT, p);
  const rel = path3.relative(ROOT, abs);
  if (rel.startsWith("..") || path3.isAbsolute(rel)) {
    throw new Error(`path escapes the working directory: ${p}`);
  }
  return abs;
}
function runEditor(input) {
  const { command } = input;
  if (command === "view") {
    const abs = safeResolve(input.path);
    if (fs3.statSync(abs).isDirectory()) {
      return fs3.readdirSync(abs).join("\n") || "(empty directory)";
    }
    const lines = fs3.readFileSync(abs, "utf8").split("\n");
    const [start, end] = input.view_range ?? [1, lines.length];
    return lines.slice(start - 1, end === -1 ? lines.length : end).map((l, i) => `${start + i}	${l}`).join("\n");
  }
  if (command === "create") {
    const abs = safeResolve(input.path);
    fs3.mkdirSync(path3.dirname(abs), { recursive: true });
    fs3.writeFileSync(abs, input.file_text ?? "");
    return `created ${input.path}`;
  }
  if (command === "str_replace") {
    const abs = safeResolve(input.path);
    const src = fs3.readFileSync(abs, "utf8");
    const n = src.split(input.old_str).length - 1;
    if (n === 0) throw new Error("old_str not found");
    if (n > 1) throw new Error(`old_str matched ${n} times; must be unique`);
    fs3.writeFileSync(abs, src.replace(input.old_str, input.new_str ?? ""));
    return `edited ${input.path}`;
  }
  if (command === "insert") {
    const abs = safeResolve(input.path);
    const lines = fs3.readFileSync(abs, "utf8").split("\n");
    lines.splice(input.insert_line, 0, input.insert_text ?? "");
    fs3.writeFileSync(abs, lines.join("\n"));
    return `inserted into ${input.path}`;
  }
  throw new Error(`unsupported editor command: ${command}`);
}
function runBash(input) {
  if (input.restart) return Promise.resolve("(bash session restarted)");
  return new Promise((resolve) => {
    execFile("bash", ["-c", input.command], { cwd: ROOT, timeout: 6e4, maxBuffer: 1 << 20 }, (err, out, errOut) => {
      const body = (out || "") + (errOut || "");
      if (err && err.killed) return resolve(`(timed out)
${body}`);
      resolve(body || (err ? `(exit ${err.code})` : "(no output)"));
    });
  });
}
async function dispatchTool(block) {
  try {
    const result = block.name === "bash" ? await runBash(block.input) : runEditor(block.input);
    return { type: "tool_result", tool_use_id: block.id, content: String(result) };
  } catch (e) {
    return { type: "tool_result", tool_use_id: block.id, content: String(e.message ?? e), is_error: true };
  }
}
async function runCodingRepl(cfg) {
  if (!cfg.token) {
    console.log("Not registered. Run `devads register` first.");
    return;
  }
  const client = new Anthropic({
    apiKey: cfg.token,
    baseURL: `${COORDINATOR_URL}/api/anthropic`
  });
  async function createWithCredits(messages2) {
    for (; ; ) {
      try {
        return await client.messages.create({ model: MODEL, max_tokens: 16e3, system: SYSTEM, tools, messages: messages2 });
      } catch (e) {
        if (e instanceof Anthropic.APIError && e.status === 402) {
          console.log("\n\x1B[33mOut of credits \u2014 here's a quick ad to earn more.\x1B[0m");
          await watchOneAd(cfg.wallet);
          console.log("\x1B[2mretrying\u2026\x1B[0m");
          continue;
        }
        throw e;
      }
    }
  }
  const rl = readline.createInterface({ input: stdin, output: stdout2 });
  console.log("Ask me to build something (type 'exit' to quit). A short ad plays before each prompt \u2014 you earn USDC while you code.\n");
  const messages = [];
  for (; ; ) {
    const input = (await rl.question("\x1B[35mdevads \u203A\x1B[0m ")).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;
    await watchOneAd(cfg.wallet);
    messages.push({ role: "user", content: input });
    for (; ; ) {
      const res = await createWithCredits(messages);
      for (const block of res.content) {
        if (block.type === "text") stdout2.write(block.text + "\n");
        else if (block.type === "tool_use") stdout2.write(`\x1B[2m[${block.name}] ${block.input.path ?? block.input.command ?? ""}\x1B[0m
`);
      }
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason !== "tool_use") break;
      const results = [];
      for (const t of res.content.filter((b) => b.type === "tool_use")) results.push(await dispatchTool(t));
      messages.push({ role: "user", content: results });
    }
    console.log("\n" + await earningsLine(cfg.wallet) + "\n");
  }
  rl.close();
}
var MODEL, ROOT, SYSTEM, tools;
var init_repl = __esm({
  "src/repl.ts"() {
    "use strict";
    init_config();
    init_earn();
    init_statusline();
    MODEL = process.env.DEVADS_MODEL ?? "claude-opus-4-8";
    ROOT = process.cwd();
    SYSTEM = `You are DevAds, a terminal coding assistant (like Claude Code).
You work inside the user's project directory: ${ROOT}
Read, create, and edit files there with the text editor tool, and run shell
commands with the bash tool. Keep responses concise. When asked to build
something, create the actual files rather than printing code, then briefly say
what you did.`;
    tools = [
      { type: "text_editor_20250728", name: "str_replace_based_edit_tool" },
      { type: "bash_20250124", name: "bash" }
    ];
  }
});

// src/index.ts
init_config();
init_earn();
init_statusline();
import * as readline2 from "node:readline/promises";
import { stdin as stdin2, stdout as stdout3 } from "node:process";
var BANNER = `\x1B[35m
  \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557   \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557
  \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D
  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557
  \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  \u255A\u2588\u2588\u2557 \u2588\u2588\u2554\u255D\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u255A\u2550\u2550\u2550\u2550\u2588\u2588\u2551
  \u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u255A\u2588\u2588\u2588\u2588\u2554\u255D \u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551
  \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D  \u255A\u2550\u2550\u2550\u255D  \u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D\x1B[0m
  code in your terminal \xB7 watch ads \xB7 earn USDC \xB7 no API key needed
`;
async function register() {
  const rl = readline2.createInterface({ input: stdin2, output: stdout3 });
  console.log(
    "Welcome to DevAds. You'll watch short ads while you code; advertisers\npay you USDC on Monad for each one, and your prompts run on our key.\n"
  );
  const wallet = (await rl.question("Your Monad wallet address (0x\u2026): ")).trim();
  rl.close();
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    console.error("That doesn't look like a valid address.");
    process.exit(1);
  }
  const cfg = await registerWallet(wallet);
  console.log(`
\x1B[32m\u2713\x1B[0m Registered ${cfg.wallet}. You're ready \u2014 run \`devads\` to start coding.`);
}
async function main() {
  const cmd = process.argv[2];
  if (cmd === "register") {
    await register();
    return;
  }
  if (cmd === "status") {
    console.log(await earningsLine(loadWallet()));
    return;
  }
  console.log(BANNER);
  if (cmd === "watch") {
    const wallet = loadWallet();
    console.log(await earningsLine(wallet) + "\n");
    for (; ; ) {
      await watchOneAd(wallet);
      console.log("\n" + await earningsLine(wallet));
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  let cfg = loadConfig();
  if (!cfg?.token) {
    console.log("First run \u2014 let's get you set up.\n");
    await register();
    cfg = loadConfig();
  }
  console.log(await earningsLine(cfg.wallet) + "\n");
  const { runCodingRepl: runCodingRepl2 } = await Promise.resolve().then(() => (init_repl(), repl_exports));
  await runCodingRepl2(cfg);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
