import { loadWallet } from "./config";
import { watchOneAd } from "./earn";
import { earningsLine } from "./statusline";

const BANNER = `\x1b[35m
  ██████╗ ███████╗██╗   ██╗ █████╗ ██████╗ ███████╗
  ██╔══██╗██╔════╝██║   ██║██╔══██╗██╔══██╗██╔════╝
  ██║  ██║█████╗  ██║   ██║███████║██║  ██║███████╗
  ██║  ██║██╔══╝  ╚██╗ ██╔╝██╔══██║██║  ██║╚════██║
  ██████╔╝███████╗ ╚████╔╝ ██║  ██║██████╔╝███████║
  ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝  ╚═╝╚═════╝ ╚══════╝\x1b[0m
  code in your terminal · earn USDC for the ads you watch
`;

async function main() {
  const cmd = process.argv[2];
  const wallet = loadWallet();

  if (cmd === "status") {
    console.log(await earningsLine(wallet));
    return;
  }

  console.log(BANNER);
  console.log(await earningsLine(wallet) + "\n");

  if (cmd === "watch") {
    // Standalone earn demo — watch ads back to back.
    for (;;) {
      await watchOneAd(wallet);
      console.log("\n" + (await earningsLine(wallet)));
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Default: coding REPL with ad breaks.
  const { runCodingRepl } = await import("./repl");
  await runCodingRepl(wallet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
