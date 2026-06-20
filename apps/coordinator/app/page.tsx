import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 52, margin: 0, letterSpacing: -1 }}>
          Dev<span style={{ color: "var(--accent)" }}>Ads</span>
        </h1>
        <p style={{ fontSize: 20, color: "var(--muted)", marginTop: 12 }}>
          A terminal-native coding agent that pays you in USDC for the ads you
          watch — settled autonomously over x402 on Monad.
        </p>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/earn"
          style={{
            background: "var(--accent)",
            color: "#fff",
            padding: "14px 28px",
            borderRadius: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Earn by watching →
        </Link>
        <Link
          href="/advertise"
          style={{
            background: "transparent",
            color: "var(--fg)",
            border: "1px solid var(--border)",
            padding: "14px 28px",
            borderRadius: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Advertise
        </Link>
      </div>
    </main>
  );
}
