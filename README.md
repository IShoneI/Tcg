# DinoWarz TCG

DinoWarz turns NFTs from the configured Solana wallet into playable trading
cards. The current release includes the card gallery and card-generation
systems; deck building and battles remain in development.

## Run locally

Requirements: Node.js 20 or newer and a Helius API key.

1. Copy `.env.example` to `.env.local`.
2. Replace `HELIUS_API_KEY` with a rotated key.
3. Install dependencies with `npm install`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

The configured demo wallet is read-only. It is never used for signing,
authentication, or transactions.

## Inventory caching

The browser first checks its local inventory cache. When the inventory is not
available locally, it requests `/api/inventory`. That server route reads Helius
using the server-only key and shares a 24-hour cached response across visitors.
The Helius key is never included in browser JavaScript.

## Deploy with Vercel

1. Import this GitHub repository into Vercel.
2. Keep the project root as the repository root and framework as Next.js.
3. Add the three values from `.env.example` to the Vercel project settings.
4. Deploy the production branch.
5. Add `dinowarz.shones.xyz` in the Vercel Domains settings and apply the DNS
   record Vercel provides.

Every push to the production branch will then deploy automatically.

## Checks

```sh
npm run build
```

