#!/usr/bin/env node
// DevAds demo CLI — a minimal Claude-Code-style coding agent.
// Uses ONLY the Anthropic API key. Claude can read, create, and edit files and
// run shell commands in the directory you launch it from. No ads, no wallet,
// no Supabase — this is the standalone coding demo.
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.DEVADS_MODEL ?? "claude-opus-4-8";
// The agent is confined to this directory tree. Default: where you ran the CLI.
const ROOT = process.env.DEVADS_WORKDIR
  ? path.resolve(process.env.DEVADS_WORKDIR)
  : process.cwd();

const c = {
  reset: "\x1b[0m", dim: "\x1b[2m", magenta: "\x1b[35m",
  green: "\x1b[32m", red: "\x1b[31m", cyan: "\x1b[36m",
};

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    `${c.red}ANTHROPIC_API_KEY is not set.${c.reset}\n` +
      `Run with:  node --env-file=../.env index.mjs   (or export the key first)`,
  );
  process.exit(1);
}

const client = new Anthropic();

const SYSTEM = `You are DevAds, a terminal coding assistant (like Claude Code).
You work inside the user's project directory: ${ROOT}
You can read, create, and edit files there with the text editor tool, and run
shell commands with the bash tool. Keep responses concise. When asked to build
something, create the actual files rather than just printing code. After making
changes, briefly say what you did.`;

const tools = [
  { type: "text_editor_20250728", name: "str_replace_based_edit_tool" },
  { type: "bash_20250124", name: "bash" },
];

// --- path safety: every file op must stay inside ROOT ---------------------
function safeResolve(p) {
  if (!p) throw new Error("path is required");
  const abs = path.resolve(ROOT, p);
  const rel = path.relative(ROOT, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes the working directory: ${p}`);
  }
  return abs;
}

// --- text editor tool handler --------------------------------------------
function runEditor(input) {
  const { command } = input;
  if (command === "view") {
    const abs = safeResolve(input.path);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      return fs.readdirSync(abs).join("\n") || "(empty directory)";
    }
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    const [start, end] = input.view_range ?? [1, lines.length];
    return lines
      .slice(start - 1, end === -1 ? lines.length : end)
      .map((l, i) => `${start + i}\t${l}`)
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
    const count = src.split(input.old_str).length - 1;
    if (count === 0) throw new Error("old_str not found");
    if (count > 1) throw new Error(`old_str matched ${count} times; must be unique`);
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

// --- bash tool handler ----------------------------------------------------
function runBash(input) {
  if (input.restart) return "(bash session restarted)";
  return new Promise((resolve) => {
    execFile(
      "bash",
      ["-c", input.command],
      { cwd: ROOT, timeout: 60_000, maxBuffer: 1024 * 1024 },
      (err, out, errOut) => {
        const body = (out || "") + (errOut || "");
        if (err && err.killed) return resolve(`(timed out)\n${body}`);
        resolve(body || (err ? `(exit ${err.code})` : "(no output)"));
      },
    );
  });
}

async function dispatchTool(block) {
  try {
    const result =
      block.name === "bash"
        ? await runBash(block.input)
        : runEditor(block.input);
    return { type: "tool_result", tool_use_id: block.id, content: String(result) };
  } catch (e) {
    return {
      type: "tool_result",
      tool_use_id: block.id,
      content: String(e.message ?? e),
      is_error: true,
    };
  }
}

// --- one user turn: run the agentic loop until Claude stops calling tools --
async function runTurn(messages) {
  for (;;) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      messages,
    });

    for (const block of res.content) {
      if (block.type === "text") stdout.write(block.text + "\n");
      else if (block.type === "tool_use") {
        const arg = block.input.path ?? block.input.command ?? "";
        stdout.write(`${c.dim}[${block.name}] ${arg}${c.reset}\n`);
      }
    }

    if (res.stop_reason === "refusal") {
      stdout.write(`${c.red}(request was refused)${c.reset}\n`);
      messages.push({ role: "assistant", content: res.content });
      return;
    }

    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") return;

    const toolUses = res.content.filter((b) => b.type === "tool_use");
    const results = [];
    for (const t of toolUses) results.push(await dispatchTool(t));
    messages.push({ role: "user", content: results });
  }
}

async function main() {
  console.log(
    `${c.magenta}DevAds${c.reset} — terminal coding agent (${MODEL})\n` +
      `${c.dim}workdir: ${ROOT}${c.reset}\n` +
      `Ask me to build something. Type ${c.cyan}exit${c.reset} to quit.\n`,
  );
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const messages = [];
  for (;;) {
    const input = (await rl.question(`${c.magenta}devads ›${c.reset} `)).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;
    messages.push({ role: "user", content: input });
    try {
      await runTurn(messages);
    } catch (e) {
      console.error(`${c.red}error:${c.reset} ${e.message ?? e}`);
    }
    stdout.write("\n");
  }
  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
