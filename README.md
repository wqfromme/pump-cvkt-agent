# CVKT Agent — Pump Tokenized Agent

AI answers gated behind a randomly-priced SOL payment (0.10–0.50 SOL per request).
Revenue flows to the CVKT token on pump.fun.

## Stack

- **Next.js 14** (App Router)
- **@pump-fun/agent-payments-sdk** — invoice + on-chain verification
- **@solana/wallet-adapter** — Phantom, Solflare, Backpack
- **Anthropic API** — service delivered after payment confirmed

## Quick start

```bash
cp .env.local.example .env.local   # fill in your keys
npm install
npm run dev
```

## Deploy (browser only — no CLI needed)

1. Push this repo to GitHub
2. Import on vercel.com → auto-detects Next.js
3. Add env vars (see `.env.local.example`)
4. Deploy

## Environment variables

| Variable | Value |
|---|---|
| `SOLANA_RPC_URL` | `https://rpc.solanatracker.io/public` |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | same |
| `AGENT_TOKEN_MINT_ADDRESS` | `CVKT5ixEzwZm5CHFU7EeLfzxTSEF6GV2oJ3GevkZpump` |
| `CURRENCY_MINT` | `So11111111111111111111111111111111111111112` |
| `PRICE_MIN_LAMPORTS` | `100000000` (0.10 SOL) |
| `PRICE_MAX_LAMPORTS` | `500000000` (0.50 SOL) |
| `ANTHROPIC_API_KEY` | your key |

## Pricing logic

Each request generates a random price between 0.10 and 0.50 SOL in 0.01 SOL increments.
The price is shown to the user before they sign — they can cancel and re-quote for a new price.
