import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Address } from "@devads/shared";

export const CONFIG_DIR = path.join(os.homedir(), ".devads");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const COORDINATOR_URL =
  process.env.COORDINATOR_URL ?? "http://localhost:3000";

export type CliConfig = { wallet: Address };

/** Resolve the consumer wallet from --wallet flag, then ~/.devads/config.json. */
export function loadWallet(): Address {
  const i = process.argv.indexOf("--wallet");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1] as Address;
  if (fs.existsSync(CONFIG_FILE)) {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as CliConfig;
    if (cfg.wallet) return cfg.wallet;
  }
  throw new Error(
    "No wallet configured. Pass --wallet 0x... or install via the DevAds web onboarding.",
  );
}

export function saveWallet(wallet: Address) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ wallet }, null, 2));
}
