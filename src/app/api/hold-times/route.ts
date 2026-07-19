import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function fetchHoldTimeDays(mintAddress: string): Promise<number> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) throw new Error("Server is missing HELIUS_API_KEY");

  const base = `https://api.helius.xyz/v0/addresses/${mintAddress}/transactions`;
  const transferResponse = await fetch(
    `${base}?api-key=${apiKey}&type=TRANSFER&limit=1`,
    { signal: AbortSignal.timeout(20_000) }
  );

  if (!transferResponse.ok) {
    throw new Error(`Helius history request failed (${transferResponse.status})`);
  }

  const transfers = await transferResponse.json();
  if (transfers.length > 0) {
    return Math.max(
      0,
      Math.floor((Date.now() - transfers[0].timestamp * 1000) / 86_400_000)
    );
  }

  const mintResponse = await fetch(
    `${base}?api-key=${apiKey}&type=NFT_MINT&limit=1`,
    { signal: AbortSignal.timeout(20_000) }
  );
  if (!mintResponse.ok) return 0;

  const mintTransactions = await mintResponse.json();
  if (mintTransactions.length === 0) return 0;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - mintTransactions[0].timestamp * 1000) / 86_400_000
    )
  );
}

const getCachedHoldTimeDays = unstable_cache(
  fetchHoldTimeDays,
  ["dinowarz-hold-time-v1"],
  { revalidate: 86_400 }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mintAddresses = Array.isArray(body.mintAddresses)
      ? [...new Set(body.mintAddresses)].slice(0, 100)
      : [];

    if (
      mintAddresses.length === 0 ||
      mintAddresses.some(
        (mint) => typeof mint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)
      )
    ) {
      return NextResponse.json({ error: "Invalid mint addresses" }, { status: 400 });
    }

    const entries: Array<[string, number]> = [];
    const queue = [...mintAddresses] as string[];

    async function worker() {
      while (queue.length > 0) {
        const mint = queue.shift();
        if (!mint) return;
        try {
          entries.push([mint, await getCachedHoldTimeDays(mint)]);
        } catch {
          entries.push([mint, 0]);
        }
      }
    }

    await Promise.all(Array.from({ length: 3 }, () => worker()));
    return NextResponse.json({ holdTimes: Object.fromEntries(entries) });
  } catch {
    return NextResponse.json({ error: "Unable to load hold times" }, { status: 502 });
  }
}
