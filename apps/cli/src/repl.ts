import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import type { CliConfig } from "./config";
import { COORDINATOR_URL } from "./config";
import { watchOneAd } from "./earn";
import { earningsLine } from "./statusline";

const MODEL = process.env.DEVADS_MODEL ?? "claude-opus-4-8";
const ROOT = process.cwd();

const SYSTEM = `You are DevAds, a terminal coding assistant (like Claude Code).
You work inside the user's project directory: ${ROOT}
Read, create, and edit files there with the text editor tool, and run shell
commands with the bash tool. Keep responses concise. When asked to build
something, create the actual files rather than printing code, then briefly say
what you did.`;

const tools = [
  { type: "text_editor_20250728", name: "str_replace_based_edit_tool" },
  { type: "bash_20250124", name: "bash" },
] as any;

// --- path safety: file ops stay inside the project dir --------------------
function safeResolve(p: string): string {
  if (!p) throw new Error("path is required");
  const abs = path.resolve(ROOT, p);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes the working directory: ${p}`);
  }
  return abs;
}

function runEditor(input: any): string {
  const { command } = input;
  if (command === "view") {
    const abs = safeResolve(input.path);
    if (fs.statSync(abs).isDirectory()) {
      return fs.readdirSync(abs).join("\n") || "(empty directory)";
    }
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    const [start, end] = input.view_range ?? [1, lines.length];
    return lines
      .slice(start - 1, end === -1 ? lines.length : end)
      .map((l: string, i: number) => `${start + i}\t${l}`)
      .join("\n");
  }
  if (command === "create") {
    const abs = safeResolve(input.path);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, input.file_text ?? "");
    return `created ${input.path}`;
  }
  if (command === "str_replace") {
    const abs = safeResolve(input.path);
    const src = fs.readFileSync(abs, "utf8");
    const n = src.split(input.old_str).length - 1;
    if (n === 0) throw new Error("old_str not found");
    if (n > 1) throw new Error(`old_str matched ${n} times; must be unique`);
    fs.writeFileSync(abs, src.replace(input.old_str, input.new_str ?? ""));
    return `edited ${input.path}`;
  }
  if (command === "insert") {
    const abs = safeResolve(input.path);
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    lines.splice(input.insert_line, 0, input.insert_text ?? "");
    fs.writeFileSync(abs, lines.join("\n"));
    return `inserted into ${input.path}`;
  }
  throw new Error(`unsupported editor command: ${command}`);
}

function runBash(input: any): Promise<string> {
  if (input.restart) return Promise.resolve("(bash session restarted)");
  return new Promise((resolve) => {
    execFile("bash", ["-c", input.command], { cwd: ROOT, timeout: 60_000, maxBuffer: 1 << 20 }, (err, out, errOut) => {
      const body = (out || "") + (errOut || "");
      if (err && (err as any).killed) return resolve(`(timed out)\n${body}`);
      resolve(body || (err ? `(exit ${(err as any).code})` : "(no output)"));
    });
  });
}

async function dispatchTool(block: any) {
  try {
    const result = block.name === "bash" ? await runBash(block.input) : runEditor(block.input);
    return { type: "tool_result", tool_use_id: block.id, content: String(result) };
  } catch (e: any) {
    return { type: "tool_result", tool_use_id: block.id, content: String(e.message ?? e), is_error: true };
  }
}

/**
 * The branded coding REPL. Anthropic calls route through the DevAds coordinator
 * (which holds the real key and meters credits). When credits run out the proxy
 * returns 402 — we play an ad, the viewer earns credits + USDC, then retry.
 */
export async function runCodingRepl(cfg: CliConfig) {
  if (!cfg.token) {
    console.log("Not registered. Run `devads register` first.");
    return;
  }
  const client = new Anthropic({
    apiKey: cfg.token,
    baseURL: `${COORDINATOR_URL}/api/anthropic`,
  });

  // One model call, with an ad break + retry if the gateway reports no credits.
  async function createWithCredits(messages: any[]) {
    for (;;) {
      try {
        return await client.messages.create({ model: MODEL, max_tokens: 16000, system: SYSTEM, tools, messages });
      } catch (e: any) {
        if (e instanceof Anthropic.APIError && e.status === 402) {
          console.log("\n\x1b[33mOut of credits — here's a quick ad to earn more.\x1b[0m");
          await watchOneAd(cfg.wallet);
          console.log("\x1b[2mretrying…\x1b[0m");
          continue;
        }
        throw e;
      }
    }
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("Ask me to build something (type 'exit' to quit). A short ad plays before each prompt — you earn USDC while you code.\n");
  const messages: any[] = [];

  for (;;) {
    const input = (await rl.question("\x1b[35mdevads ›\x1b[0m ")).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;

    // An ad plays on every prompt: the advertiser pays the user USDC (x402),
    // and watching it tops up the credits that fund this prompt on our key.
    await watchOneAd(cfg.wallet);

    messages.push({ role: "user", content: input });

    // Agentic tool loop for this turn.
    for (;;) {
      const res = await createWithCredits(messages);
      for (const block of res.content) {
        if (block.type === "text") stdout.write(block.text + "\n");
        else if (block.type === "tool_use") stdout.write(`\x1b[2m[${block.name}] ${(block.input as any).path ?? (block.input as any).command ?? ""}\x1b[0m\n`);
      }
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason !== "tool_use") break;
      const results = [];
      for (const t of res.content.filter((b) => b.type === "tool_use")) results.push(await dispatchTool(t));
      messages.push({ role: "user", content: results });
    }

    console.log("\n" + (await earningsLine(cfg.wallet)) + "\n");
  }
  rl.close();
}
