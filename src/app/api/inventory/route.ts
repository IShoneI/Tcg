import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import type { DASAsset, DASResponse } from "@/types/card";

export const runtime = "nodejs";

const DEFAULT_DEMO_WALLET = "BmFUGjWXwM1qbXfm8RDaqYDVkb6aDJmHbpXAvhRQav9Z";
const DEMO_WALLET_ADDRESS =
  process.env.DEMO_WALLET_ADDRESS ?? DEFAULT_DEMO_WALLET;

async function fetchWalletInventory(walletAddress: string): Promise<DASAsset[]> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) throw new Error("Server is missing HELIUS_API_KEY");

  const endpoint = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;
  const assets: DASAsset[] = [];
  const limit = 1000;
  let page = 1;

  while (true) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dinowarz-inventory",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: walletAddress,
          page,
          limit,
          displayOptions: {
            showCollectionMetadata: true,
            showUnverifiedCollections: false,
          },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Helius request failed (${response.status})`);
    }

    const payload = await response.json();
    if (payload.error) {
      throw new Error(payload.error.message || "Helius DAS API error");
    }

    const result = payload.result as DASResponse;
    assets.push(...result.items);
    if (assets.length >= result.total || result.items.length < limit) break;
    page += 1;
  }

  return assets;
}

const getCachedWalletInventory = unstable_cache(
  fetchWalletInventory,
  ["dinowarz-demo-wallet-inventory-v1"],
  { revalidate: 86_400 }
);

export async function GET() {
  try {
    const items = await getCachedWalletInventory(DEMO_WALLET_ADDRESS);
    return NextResponse.json(
      { total: items.length, limit: items.length, page: 1, items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load wallet inventory";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
