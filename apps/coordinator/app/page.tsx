import Link from "next/link";

export default function Home() {
  return (
    <main className="page page--center">
      <div className="container container--hero animate-in">
        <h1 className="hero-title">
          Dev<span className="accent">Ads</span>
        </h1>
        <p className="hero-desc">
          A terminal-native coding agent that pays you in USDC for the ads you
          watch — settled autonomously over x402 on Monad.
        </p>
      </div>
      <div className="btn-row animate-in animate-in-delay-2">
        <Link href="/earn" className="btn btn-primary">
          Earn by watching →
        </Link>
        <Link href="/advertise" className="btn btn-ghost">
          Advertise
        </Link>
      </div>
    </main>
  );
}
