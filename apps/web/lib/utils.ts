import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddr(addr?: string | null) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function usd(n: number | string, digits = 4) {
  const v = typeof n === "string" ? Number(n) : n;
  return `$${(v || 0).toFixed(digits)}`;
}

export function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

/** Convert a decimal USDC amount to a base-units bigint (6 dp). */
export function toUsdcUnits(amount: number | string): bigint {
  const v = typeof amount === "string" ? Number(amount) : amount;
  return BigInt(Math.round(v * 1_000_000));
}

export function fromUsdcUnits(units: bigint): number {
  return Number(units) / 1_000_000;
}
