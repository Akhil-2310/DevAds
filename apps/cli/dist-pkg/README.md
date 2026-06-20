# devads

An ad-funded coding agent in your terminal. Watch a short ad before each prompt,
get paid **USDC on Monad** (settled via x402 by the advertiser), and your prompt
runs on our model — **no API key required.**

## Install

```bash
npm install -g devads
```

Requires Node ≥ 18 and `ffmpeg` (for in-terminal ad playback):
`brew install ffmpeg` (macOS) · `apt install ffmpeg` (Linux).

## Use

```bash
devads register     # one-time: enter the Monad wallet that receives your rewards
devads              # start coding — an ad plays each prompt, you earn, it answers
```

Other commands:

- `devads status` — earnings + on-chain balance
- `devads watch` — watch ads back-to-back to earn (no coding)

By default it talks to the hosted coordinator. Point it elsewhere with
`COORDINATOR_URL=https://your-coordinator devads`.
