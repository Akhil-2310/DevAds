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

const protocolWallet = process.env.NEXT_PUBLIC_ADDRESS_OF_PROTOCOL;

export default function Advertise() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const pickVideo = (file: File | null) => {
    if (!file) return;
    setVideo(file);
  };

  useEffect(() => {
    if (!video) return;
    const url = URL.createObjectURL(video);
    setPreviewSrc(url);
    setPreviewLabel(video.name);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (video) fd.append("video", video);
      const hadVideo = Boolean(video);
      const uploadedName = video?.name ?? null;
      const res = await fetch("/api/ads", { method: "POST", body: fd });
      if (!res.ok) return;
      const ad = (await res.json()) as Ad;
      if (hadVideo && ad.id) {
        setPreviewSrc(`/api/ads/${ad.id}/video?t=${Date.now()}`);
        setPreviewLabel(uploadedName);
      }
      setForm({ ...form, title: "", clickUrl: "" });
      setVideo(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page page--content">
      <div className="container container--md">
        <a href="/" className="back-link animate-in">← DevAds</a>
        <h1 className="page-title animate-in animate-in-delay-1">Advertise</h1>
        <p className="page-desc animate-in animate-in-delay-2">
          Launch a campaign. The autonomous paymaster pays each verified watch from the
          protocol wallet over x402 — no clicks, no humans.
        </p>

        {protocolWallet && (
          <div className="card card--info animate-in animate-in-delay-3">
            <div className="card-label">
              Fund your campaign: send your budget in USDC (Monad testnet) to the protocol wallet
            </div>
            <div className="mono card-value">{protocolWallet}</div>
          </div>
        )}

        <form onSubmit={submit} className="form animate-in animate-in-delay-3">
          <input
            className="field"
            placeholder="Campaign title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="field"
            placeholder="Product link (https://…)"
            value={form.clickUrl}
            onChange={(e) => setForm({ ...form, clickUrl: e.target.value })}
          />
          <div className="form-grid-3">
            <label className="field-label">
              Reward per watch
              <input
                className="field"
                placeholder="$0.01"
                value={form.reward}
                onChange={(e) => setForm({ ...form, reward: e.target.value })}
              />
            </label>
            <label className="field-label">
              Ad duration (seconds)
              <input
                className="field"
                type="number"
                min={1}
                placeholder="8"
                value={form.durationSec}
                onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })}
              />
            </label>
            <label className="field-label">
              Campaign budget (USDC)
              <input
                className="field"
                type="number"
                min={0}
                step={0.01}
                placeholder="1"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="field-label">
            Ad video (mp4 / webm)
            <div
              className={`file-upload${video ? " file-upload--filled" : ""}${dragging ? " file-upload--drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickVideo(e.dataTransfer.files?.[0] ?? null);
              }}
            >
              <input
                className="file-upload__input"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => pickVideo(e.target.files?.[0] ?? null)}
              />
              <svg className="file-upload__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="file-upload__btn">Choose video</span>
              <span className="file-upload__name">
                {video ? video.name : "Drop a file here or browse"}
              </span>
            </div>
          </label>
          {previewSrc && (
            <div className="video-preview">
              <video
                key={previewSrc}
                src={previewSrc}
                controls
                playsInline
                preload="metadata"
              />
              {previewLabel && (
                <div className="video-preview__label">{previewLabel}</div>
              )}
            </div>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary" style={{ justifySelf: "start" }}>
            {busy ? "Uploading…" : "Create campaign"}
          </button>
        </form>

        <div className="card-grid">
          {ads.map((ad) => (
            <div key={ad.id} className="card card--row">
              <div>
                <div className="card-title">{ad.title}</div>
                <div className="mono card-meta">
                  {ad.id} · {ad.durationSec}s · {ad.reward}/watch
                </div>
              </div>
              <div className="card-budget">${ad.budgetRemaining} left</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
