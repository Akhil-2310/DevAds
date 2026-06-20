import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Address } from "@devads/shared";
import { watchOneAd } from "./earn";
import { earningsLine } from "./statusline";

const AD_EVERY = Number(process.env.DEVADS_AD_EVERY ?? 2);

function hasRealKey(): boolean {
  const k = process.env.ANTHROPIC_API_KEY;
  return !!k && !k.includes("placeholder");
}

/**
 * The branded coding REPL on the Claude Agent SDK. Each user turn runs the
 * coding agent (full Claude Code toolset); every few turns an ad plays and a
 * watch claim is filed, so the user earns while they build.
 */
export async function runCodingRepl(wallet: Address) {
  if (!hasRealKey()) {
    console.log(
      "Set a real ANTHROPIC_API_KEY in .env to enable the coding agent.\n" +
        "Meanwhile, try the earn loop:  devads watch",
    );
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log("Ask me to build something (type 'exit' to quit). Ads play between turns — you earn while you code.\n");

  let turns = 0;
  let started = false;

  for (;;) {
    const input = (await rl.question("\x1b[35mdevads ›\x1b[0m ")).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;

    const q = query({
      prompt: input,
      options: {
        cwd: process.cwd(),
        permissionMode: "bypassPermissions",
        continue: started, // keep conversation context across turns
      },
    });
    started = true;

    for await (const msg of q) {
      if (msg.type === "assistant") {
        for (const block of msg.message.content as any[]) {
          if (block.type === "text") stdout.write(String(block.text));
          else if (block.type === "tool_use") stdout.write(`\n\x1b[2m[${String(block.name)}]\x1b[0m`);
        }
      } else if (msg.type === "result") {
        stdout.write("\n");
      }
    }

    turns++;
    console.log("\n" + (await earningsLine(wallet)));
    if (turns % AD_EVERY === 0) {
      await watchOneAd(wallet);
      console.log("\n" + (await earningsLine(wallet)) + "\n");
    }
  }

  rl.close();
}
