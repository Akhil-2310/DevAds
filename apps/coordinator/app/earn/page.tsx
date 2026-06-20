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
    <main className="page page--content">
      <div className="container container--sm">
        <a href="/" className="back-link animate-in">← DevAds</a>
        <h1 className="page-title animate-in animate-in-delay-1">Earn by watching</h1>
        <p className="page-desc animate-in animate-in-delay-2">
          Connect your wallet, paste one command, and start earning USDC for the ads you watch
          while you code.
        </p>

        {!address ? (
          <button
            onClick={connect}
            className="btn btn-primary animate-in animate-in-delay-3"
            style={{ marginTop: 24 }}
          >
            Connect Wallet
          </button>
        ) : (
          <div className="stack animate-in animate-in-delay-3" style={{ marginTop: 24 }}>
            <div className="card wallet-bar">
              <span className="mono card-meta">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
              <span>
                earned{" "}
                <span className="balance-highlight">
                  {balance ?? "…"} USDC
                </span>
              </span>
            </div>

            <div>
              <div className="step-label">
                1 — Install the CLI (paste in your terminal)
              </div>
              <div className="code-block">
                <code className="mono">{cmd}</code>
                <button
                  onClick={copy}
                  className={`btn btn-primary btn-sm btn-copy${copied ? " is-copied" : ""}`}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="step-text">
              2 — Run <span className="mono">devads</span> and start
              coding. Ads play between turns; your balance above updates as the paymaster settles
              each watch on Monad.
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
