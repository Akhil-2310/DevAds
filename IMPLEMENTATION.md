# DevAds — implementation checkpoint

Resume doc for cross-session continuity. Spec lives in the approved plan
(`~/.claude/plans/ancient-whistling-lobster.md`).

## What this is
Terminal coding CLI (Claude Agent SDK) that plays video ads between turns and pays
the watcher in USDC on **Monad testnet** via **x402**, settled by an **autonomous
paymaster agent** (env private key) against the public molandak facilitator.

## Verified facts (don't re-derive)
- x402 packages: `@x402/core @x402/evm @x402/fetch @x402/next` **@2.16.0** (`exact` scheme).
- Facilitator `https://x402-facilitator.molandak.org` (covers gas). Chain **10143**.
  USDC `0x534b2f3A21130d7a60830c2Df862319e593943A3` (6dp). Monad **testnet** USDC is
  NOT in x402's DEFAULT_STABLECOINS → server must `registerMoneyParser` returning
  `{ amount, asset, extra: { name: "USDC", version: "2" } }`.
- Server: `new x402ResourceServer(new HTTPFacilitatorClient({url})).register(net, new ExactEvmScheme())`
  + `withX402(handler, routeConfig, server)` from `@x402/next`. See `apps/coordinator/lib/x402-server.ts`.
- Client/paymaster: `new x402Client().register(net, new ExactEvmScheme(evmSigner))` +
  `wrapFetchWithPayment(fetch, client)`. evmSigner = `{ address, signTypedData }` from a
  viem `privateKeyToAccount`. See `apps/paymaster/src/x402-client.ts`.
- **VERIFIED:** `GET /api/smoke` (no payment) → 402 with correct amount/asset/extra. Money
  parser + facilitator wiring confirmed without spending. Paymaster typechecks.

## Toolchain (all present on this machine)
Node 24, pnpm 10, Python 3.12 + cv2 4.10/Pillow/numpy, ffmpeg/ffplay, Windows Terminal (Sixel).

## Status
- [x] Monorepo scaffold + `packages/shared` (chain/types/signer/usdc).
- [x] Coordinator x402 server lib + `/api/smoke` — **402 verified**.
- [x] Coordinator API: store + /ads/next, /ads, /ads/:id/video, /claims (POST/GET),
      /claims/:id/proof (x402, per-claim payTo) — **all verified via curl**.
- [x] Paymaster: x402 client + autonomous poll/pay loop (`index.ts`) — typechecks.
- [x] **#2 settlement run — DONE, on-chain.** $0.001 settled (payer 20→19.999, payTo 0→0.001),
      tx 0x2ef369899eedd176eb8512fff43cce858aa6f4d137cd5d319ef6a6b5bef76ac2. Funded payer
      `0xe763…3214` had 20 USDC.
- [x] **#4 paymaster autonomous loop — DONE, verified on-chain** (tx 0x8d5c…3c3a; consumer 0.001→0.011).
- [x] **#5 earn loop — DONE, verified E2E on-chain.** `devads watch` → ad plays → claim →
      paymaster settles (tx 0xcf86b0…); consumer 0.011→0.021. `devads status` reads chain.
      Coding REPL (`repl.ts`) built on Agent SDK + typechecks; **runtime needs a real ANTHROPIC_API_KEY.**
- [x] **#6 Web UI — DONE** (/, /earn connect→curl+earnings, /advertise, /install.sh, /api/balance).
- [ ] **#7** — earn loop E2E done; remaining: run coding REPL with real key + final rehearsal.
- [ ] #4b optional Claude Agent SDK LLM narration layer on the paymaster (enhancement).

## Demo run order
1. `pnpm --filter @devads/coordinator dev`  (port 3000; serves web UI + API)
2. `pnpm --filter @devads/paymaster start`   (autonomous payouts; needs funded PRIVATE_KEY)
3. Browser → http://localhost:3000/earn → Connect Wallet → copy curl → run it (writes ~/.devads/config.json)
4. `pnpm --filter @devads/cli start`  (coding agent + ad breaks; needs real ANTHROPIC_API_KEY)
   or `pnpm --filter @devads/cli watch` (earn loop only — no key needed)
Note: Monad testnet RPC reads are eventually-consistent; trust the poll/explorer over a single read.

## NEEDED FROM USER (long pole)
1. A wallet **funded with Monad testnet USDC** (token `0x534b…43A3`):
   - USDC: **Circle faucet** https://faucet.circle.com → select Monad testnet.
   - (optional) MON: https://faucet.monad.xyz — facilitator pays gas, so not required.
   - Put the key in repo-root `.env`: `PRIVATE_KEY=0x…`; set `PAY_TO_ADDRESS=` a 2nd address to watch.
2. `ANTHROPIC_API_KEY` in `.env` — only for the coding CLI (#5) / optional LLM paymaster.
   **The settlement loop runs WITHOUT it.**

## Run
- Coordinator: `pnpm --filter @devads/coordinator dev` (port 3000).
- Smoke (after funding): `pnpm --filter @devads/paymaster smoke`.
