"use client";

import { useCallback, useEffect, useState } from "react";

type Eth = {
  request: (args: { method: string; params?: unknown[] }) => Promise<string[]>;
};

export default function Earn() {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => setOrigin(window.location.origin), []);

  const connect = useCallback(async () => {
    const eth = (window as unknown as { ethereum?: Eth }).ethereum;
    if (!eth) {
      alert("No EVM wallet found. Install MetaMask (or any injected wallet).");
      return;
    }
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    setAddress(accounts[0] ?? null);
  }, []);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    const tick = () =>
      fetch(`/api/balance?address=${address}`)
        .then((r) => r.json())
        .then((d) => alive && setBalance(d.balance))
        .catch(() => {});
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [address]);

  const cmd = address
    ? `curl -fsSL ${origin}/install.sh | sh -s -- --wallet ${address}`
    : "";

  const copy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "64px 24px" }}>
      <div style={{ width: "100%", maxWidth: 680 }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>← DevAds</a>
        <h1 style={{ fontSize: 36, marginTop: 16, marginBottom: 8 }}>Earn by watching</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Connect your wallet, paste one command, and start earning USDC for the ads you watch
          while you code.
        </p>

        {!address ? (
          <button
            onClick={connect}
            style={{
              marginTop: 24,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              padding: "14px 28px",
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Connect Wallet
          </button>
        ) : (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <span className="mono" style={{ color: "var(--muted)" }}>
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
              <span>
                earned{" "}
                <span style={{ color: "var(--accent-2)", fontWeight: 700 }}>
                  {balance ?? "…"} USDC
                </span>
              </span>
            </div>

            <div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 8 }}>
                1 — Install the CLI (paste in your terminal)
              </div>
              <div
                style={{
                  position: "relative",
                  background: "#0c0c14",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "16px 18px",
                }}
              >
                <code className="mono" style={{ fontSize: 13, wordBreak: "break-all", color: "#cdd2ec" }}>
                  {cmd}
                </code>
                <button
                  onClick={copy}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    background: copied ? "var(--accent-2)" : "var(--accent)",
                    color: "#0a0a0f",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 14 }}>
              2 — Run <span className="mono" style={{ color: "#cdd2ec" }}>devads</span> and start
              coding. Ads play between turns; your balance above updates as the paymaster settles
              each watch on Monad.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
