# DevAds

**A coding agent that pays you in USDC for the ads you watch — settled autonomously over x402 on Monad testnet.**

DevAds is a terminal-native earn-as-you-watch platform built for [Monad Blitz Mumbai](https://github.com/monad-developers/monad-blitz-mumbai). Developers run a Claude-powered coding CLI that plays short video ads between agent turns. When a watch is verified, an autonomous paymaster settles USDC rewards on-chain via the [x402](https://x402.org) payment protocol — no clicks, no manual payouts, no humans in the loop.

---

## What it does

| Role | Experience |
|------|------------|
| **Developer / watcher** | Connect a wallet, install the CLI, and earn USDC while coding. Ads play in the terminal; verified watches create on-chain claims. |
| **Advertiser** | Launch campaigns through the web UI. Each verified watch is paid from a funded wallet by the paymaster agent. |
| **Paymaster agent** | Polls pending claims and settles them over x402 using the molandak facilitator (gas included). |

---

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#7c3aed', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#5b21b6', 'secondaryColor': '#a78bfa', 'secondaryTextColor': '#1e1b4b', 'secondaryBorderColor': '#6d28d9', 'tertiaryColor': '#ddd6fe', 'tertiaryTextColor': '#1e1b4b', 'tertiaryBorderColor': '#8b5cf6', 'lineColor': '#8b5cf6', 'textColor': '#312e81', 'mainBkg': '#ede9fe', 'nodeBorder': '#7c3aed', 'clusterBkg': '#f5f3ff', 'clusterBorder': '#a78bfa', 'titleColor': '#5b21b6', 'edgeLabelBackground': '#ede9fe'}}}%%
flowchart TB
    subgraph Terminal["Terminal"]
        CLI["@devads/cli<br/>Coding agent + ad player"]
    end

    subgraph Web["Web UI"]
        UI["Coordinator frontend<br/>/ · /earn · /advertise"]
    end

    subgraph Backend["Coordinator API"]
        API["Next.js API routes<br/>ads · claims · x402 proof"]
        Store[("In-memory ad store")]
    end

    subgraph Agents["Autonomous agents"]
        PM["@devads/paymaster<br/>Poll & settle claims"]
    end

    subgraph Chain["Monad testnet · chain 10143"]
        Fac["x402 facilitator<br/>molandak.org"]
        USDC[("USDC<br/>0x534b…43A3")]
    end

    CLI -->|"fetch ad · post claim"| API
    UI -->|"campaigns · wallet setup"| API
    API --> Store
    PM -->|"GET pending claims"| API
    PM -->|"x402 payment"| Fac
    Fac --> USDC
    API -->|"402 + proof route"| Fac

    style CLI fill:#7c3aed,stroke:#5b21b6,color:#fff
    style PM fill:#6d28d9,stroke:#5b21b6,color:#fff
    style Fac fill:#8b5cf6,stroke:#5b21b6,color:#fff
```

---

## Earn flow

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#7c3aed', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#5b21b6', 'lineColor': '#8b5cf6', 'actorBkg': '#a78bfa', 'actorBorder': '#6d28d9', 'actorTextColor': '#1e1b4b', 'signalColor': '#7c3aed', 'signalTextColor': '#312e81', 'labelBoxBkgColor': '#ede9fe', 'labelBoxBorderColor': '#8b5cf6', 'labelTextColor': '#5b21b6', 'loopTextColor': '#5b21b6', 'noteBkgColor': '#ddd6fe', 'noteBorderColor': '#8b5cf6', 'noteTextColor': '#312e81', 'activationBkgColor': '#c4b5fd', 'activationBorderColor': '#7c3aed'}}}%%
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant CLI as DevAds CLI
    participant Coord as Coordinator
    participant PM as Paymaster
    participant Fac as x402 Facilitator
    participant Chain as Monad USDC

    Dev->>Coord: Connect wallet on /earn
    Coord-->>Dev: Install curl + config (~/.devads/config.json)
    Dev->>CLI: devads watch (or devads start)
    CLI->>Coord: GET /api/ads/next
    Coord-->>CLI: Ad metadata + video URL
    CLI->>CLI: Play ad in terminal (≥90% watched)
    CLI->>Coord: POST /api/claims
    Coord-->>CLI: Claim queued (pending)
    loop Every ~4s
        PM->>Coord: GET /api/claims?status=pending
        PM->>Coord: GET /api/claims/:id/proof (x402)
        Coord-->>PM: 402 Payment Required
        PM->>Fac: Sign & submit x402 payment
        Fac->>Chain: Settle USDC to consumer wallet
        Fac-->>PM: Receipt + tx hash
    end
    Dev->>CLI: devads status
    CLI->>Chain: Read USDC balance
```

---

## x402 settlement

Payments use the **exact** x402 scheme (`@x402/core` v2.16). The coordinator returns HTTP 402 on proof routes; the paymaster signs EIP-3009 USDC authorizations and the public facilitator verifies and settles — covering gas on Monad testnet.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#7c3aed', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#5b21b6', 'secondaryColor': '#a78bfa', 'secondaryTextColor': '#1e1b4b', 'lineColor': '#8b5cf6', 'textColor': '#312e81'}}}%%
flowchart LR
    A["Advertiser wallet<br/>(paymaster PRIVATE_KEY)"] -->|"funds campaigns"| B["Claim created<br/>reward + consumer address"]
    B --> C["GET /claims/:id/proof"]
    C --> D{"HTTP 402<br/>amount · asset · payTo"}
    D --> E["Paymaster signs<br/>ExactEvmScheme"]
    E --> F["molandak facilitator<br/>verify + settle"]
    F --> G["Consumer receives USDC<br/>on Monad testnet"]

    style A fill:#6d28d9,stroke:#5b21b6,color:#fff
    style D fill:#8b5cf6,stroke:#5b21b6,color:#fff
    style F fill:#7c3aed,stroke:#5b21b6,color:#fff
    style G fill:#a78bfa,stroke:#6d28d9,color:#1e1b4b
```

---

## Monorepo layout

```
devads/
├── apps/
│   ├── cli/           # Terminal coding agent + ad player (Claude Agent SDK)
│   ├── coordinator/   # Next.js web UI + REST/x402 API (port 3000)
│   └── paymaster/     # Autonomous claim settlement loop
├── packages/
│   └── shared/        # Chain config, USDC helpers, shared types
└── .env               # PRIVATE_KEY, ANTHROPIC_API_KEY, etc.
```

| Package | Description |
|---------|-------------|
| `@devads/cli` | `devads start` — coding REPL with ad breaks; `devads watch` — earn loop only; `devads status` — on-chain balance |
| `@devads/coordinator` | Campaign management, ad delivery, claim queue, x402 proof endpoints, install scripts |
| `@devads/paymaster` | Polls pending claims and pays them via x402 without human intervention |
| `@devads/shared` | Monad testnet chain ID `10143`, USDC address, facilitator URL, viem helpers |

---

## Tech stack

- **Chain:** [Monad testnet](https://monad.xyz) (chain ID `10143`)
- **Payments:** [x402](https://x402.org) exact scheme via `@x402/core`, `@x402/evm`, `@x402/fetch`, `@x402/next`
- **Facilitator:** `https://x402-facilitator.molandak.org` (gas sponsored)
- **Token:** USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6 decimals)
- **Agent:** Claude Agent SDK (coding CLI)
- **Runtime:** Node ≥20, pnpm workspaces

---

## Getting started

### Prerequisites

- Node.js ≥20 and [pnpm](https://pnpm.io)
- [ffmpeg / ffplay](https://ffmpeg.org) for terminal video playback
- A wallet funded with **Monad testnet USDC** ([Circle faucet](https://faucet.circle.com) → select Monad testnet)
- Optional: `ANTHROPIC_API_KEY` for the full coding agent (earn loop works without it)

### Install

```bash
pnpm install
```

### Environment

Create a `.env` at the repo root:

```env
PRIVATE_KEY=0x…          # Paymaster / advertiser wallet (must hold USDC)
PAY_TO_ADDRESS=0x…      # Optional: address to watch for incoming payouts
ANTHROPIC_API_KEY=sk-…   # Optional: only for devads start (coding REPL)
```

### Run the demo

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#7c3aed', 'primaryTextColor': '#ffffff', 'primaryBorderColor': '#5b21b6', 'secondaryColor': '#c4b5fd', 'lineColor': '#8b5cf6', 'textColor': '#312e81'}}}%%
flowchart TD
    S1["1. pnpm run coordinator<br/>→ localhost:3000"] --> S2["2. pnpm run paymaster<br/>→ autonomous payouts"]
    S2 --> S3["3. Open /earn · connect wallet · run install curl"]
    S3 --> S4["4. pnpm run cli<br/>or: devads watch"]

    style S1 fill:#7c3aed,stroke:#5b21b6,color:#fff
    style S2 fill:#8b5cf6,stroke:#5b21b6,color:#fff
    style S3 fill:#a78bfa,stroke:#6d28d9,color:#1e1b4b
    style S4 fill:#6d28d9,stroke:#5b21b6,color:#fff
```

**Terminal 1 — Coordinator (API + web UI)**

```bash
pnpm run coordinator
```

**Terminal 2 — Paymaster**

```bash
pnpm run paymaster
```

**Browser — Set up your wallet**

1. Open [http://localhost:3000/earn](http://localhost:3000/earn)
2. Connect wallet and run the generated install command (writes `~/.devads/config.json`)

**Terminal 3 — Start earning**

```bash
pnpm run cli              # Full coding agent + ad breaks (needs ANTHROPIC_API_KEY)
# or
pnpm --filter @devads/cli watch   # Earn loop only — no API key required
```

**Check balance**

```bash
pnpm --filter @devads/cli status
```

---

## API overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ads/next` | GET | Next ad for the CLI player |
| `/api/ads` | GET / POST | List or create campaigns |
| `/api/ads/:id/video` | GET | Stream ad video |
| `/api/claims` | GET / POST | List or create watch claims |
| `/api/claims/:id/proof` | GET | x402-gated proof route (triggers settlement) |
| `/api/balance` | GET | USDC balance for a wallet |
| `/api/smoke` | GET | x402 smoke test (returns 402) |

---

## Monad Blitz submission

This repo is a fork of the [monad-blitz-mumbai](https://github.com/monad-developers/monad-blitz-mumbai) template. To submit:

1. Fork the [monad-blitz-mumbai](https://github.com/monad-developers/monad-blitz-mumbai) repo under your project name.
2. Replace the template contents with this codebase and update this README with your demo link.
3. Follow the hackathon submission checklist in the upstream repo.

---

## License

Private — Monad Blitz Mumbai hackathon project.
