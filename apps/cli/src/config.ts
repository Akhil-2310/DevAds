import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Address } from "@devads/shared";

export const CONFIG_DIR = path.join(os.homedir(), ".devads");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const COORDINATOR_URL =
  process.env.COORDINATOR_URL ?? "https://devads-coordinator.vercel.app";

/** Wallet receives USDC rewards; token authenticates the gateway proxy. */
export type CliConfig = { wallet: Address; token?: string };

export function loadConfig(): CliConfig | null {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as CliConfig;
  }
  return null;
}

export function saveConfig(cfg: CliConfig) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/** Resolve the wallet from --wallet flag, then ~/.devads/config.json. */
export function loadWallet(): Address {
  const i = process.argv.indexOf("--wallet");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1] as Address;
  const cfg = loadConfig();
  if (cfg?.wallet) return cfg.wallet;
  throw new Error("No wallet configured. Run `devads register` first.");
}

/** Register a wallet with the coordinator and persist the issued token. */
export async function registerWallet(wallet: Address): Promise<CliConfig> {
  const res = await fetch(`${COORDINATOR_URL}/api/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const { token } = (await res.json()) as { token: string };
  const cfg: CliConfig = { wallet, token };
  saveConfig(cfg);
  return cfg;
}
