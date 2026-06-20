"use client";

import { useEffect, useState } from "react";

type Ad = {
  id: string;
  title: string;
  reward: string;
  durationSec: number;
  budgetRemaining: number;
  clickUrl: string;
};

export default function Advertise() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [form, setForm] = useState({
    title: "",
    clickUrl: "",
    reward: "$0.01",
    durationSec: 8,
    budget: 1,
    advertiser: "0x000000000000000000000000000000000000dEaD",
  });

  const refresh = () =>
    fetch("/api/ads").then((r) => r.json()).then(setAds).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/ads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ ...form, title: "", clickUrl: "" });
    refresh();
  };

  const field: React.CSSProperties = {
    background: "#0c0c14",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    color: "var(--fg)",
    width: "100%",
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "64px 24px" }}>
      <div style={{ width: "100%", maxWidth: 720 }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 14 }}>← DevAds</a>
        <h1 style={{ fontSize: 36, marginTop: 16, marginBottom: 8 }}>Advertise</h1>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Launch a campaign. The autonomous paymaster pays each verified watch from your funded
          wallet over x402 — no clicks, no humans.
        </p>

        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <input
            style={field}
            placeholder="Campaign title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            style={field}
            placeholder="Product link (https://…)"
            value={form.clickUrl}
            onChange={(e) => setForm({ ...form, clickUrl: e.target.value })}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <input style={field} placeholder="Reward $" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
            <input style={field} type="number" placeholder="Duration s" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} />
            <input style={field} type="number" placeholder="Budget $" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
          </div>
          <button
            type="submit"
            style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 10, fontWeight: 600, cursor: "pointer", justifySelf: "start" }}
          >
            Create campaign
          </button>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            Note: upload the ad mp4 to <span className="mono">uploads/&lt;id&gt;.mp4</span> (demo seeds one).
          </p>
        </form>

        <h2 style={{ fontSize: 20, marginTop: 40 }}>Campaigns</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {ads.map((ad) => (
            <div
              key={ad.id}
              style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 18px", display: "flex", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{ad.title}</div>
                <div className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>{ad.id} · {ad.durationSec}s · {ad.reward}/watch</div>
              </div>
              <div style={{ color: "var(--accent-2)", fontWeight: 700 }}>${ad.budgetRemaining} left</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
