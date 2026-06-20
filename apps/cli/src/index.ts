import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Address } from "@devads/shared";
import { loadConfig, loadWallet, registerWallet } from "./config";
import { watchOneAd } from "./earn";
import { earningsLine } from "./statusline";

const BANNER = `\x1b[35m
  ██████╗ ███████╗██╗   ██╗ █████╗ ██████╗ ███████╗
  ██╔══██╗██╔════╝██║   ██║██╔══██╗██╔══██╗██╔════╝
  ██║  ██║█████╗  ██║   ██║███████║██║  ██║███████╗
  ██║  ██║██╔══╝  ╚██╗ ██╔╝██╔══██║██║  ██║╚════██║
  ██████╔╝███████╗ ╚████╔╝ ██║  ██║██████╔╝███████║
  ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝  ╚═╝╚═════╝ ╚══════╝\x1b[0m
  code in your terminal · watch ads · earn USDC · no API key needed
`;

/** First-run onboarding: ask for the reward wallet and register it. */
async function register(): Promise<void> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(
    "Welcome to DevAds. You'll watch short ads while you code; advertisers\n" +
      "pay you USDC on Monad for each one, and your prompts run on our key.\n",
  );
  const wallet = (await rl.question("Your Monad wallet address (0x…): ")).trim();
  rl.close();
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    console.error("That doesn't look like a valid address.");
    process.exit(1);
  }
  const cfg = await registerWallet(wallet as Address);
  console.log(`\n\x1b[32m✓\x1b[0m Registered ${cfg.wallet}. You're ready — run \`devads\` to start coding.`);
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
    for (;;) {
      await watchOneAd(wallet);
      console.log("\n" + (await earningsLine(wallet)));
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Default: the coding REPL (ad per prompt). Requires registration.
  let cfg = loadConfig();
  if (!cfg?.token) {
    console.log("First run — let's get you set up.\n");
    await register();
    cfg = loadConfig();
  }
  console.log(await earningsLine(cfg!.wallet) + "\n");
  const { runCodingRepl } = await import("./repl");
  await runCodingRepl(cfg!);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
