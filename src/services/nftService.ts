import type { DASAsset, DASResponse, NFTCard } from "@/types/card";
import { calculateStats } from "@/engine/statEngine";
import {
  loadInventoryCache,
  saveInventoryCache,
} from "@/services/storageService";

// ---------------------------------------------------------------------------
// Low-level: Helius DAS fetch
// ---------------------------------------------------------------------------

/**
 * Fetch all NFTs owned by a wallet via Helius DAS API.
 */
export async function fetchNFTsByOwner(
  walletAddress: string,
  page: number = 1,
  limit: number = 1000
): Promise<DASResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch("/api/inventory", {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Helius request failed (${response.status})`);
    }

    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result as DASResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Helius did not respond within 20 seconds");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch ALL pages for a wallet (handles >1000 NFT wallets).
 */
async function fetchAllNFTsByOwner(
  walletAddress: string,
  onProgress?: (message: string) => void
): Promise<DASAsset[]> {
  const allAssets: DASAsset[] = [];
  let page = 1;
  const limit = 1000;

  while (true) {
    onProgress?.(`Contacting Helius · wallet page ${page}…`);
    const result = await fetchNFTsByOwner(walletAddress, page, limit);
    allAssets.push(...result.items);
    onProgress?.(`Received ${allAssets.length} of ${result.total} wallet assets…`);
    if (allAssets.length >= result.total || result.items.length < limit) break;
    page++;
  }

  return allAssets;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

/**
 * Filter DAS assets by verified collection address.
 */
export function filterByCollection(
  assets: DASAsset[],
  collectionAddress: string
): DASAsset[] {
  return assets.filter((asset) =>
    asset.grouping.some(
      (g) => g.group_key === "collection" && g.group_value === collectionAddress
    )
  );
}

// ---------------------------------------------------------------------------
// Transform: DASAsset → NFTCard
// ---------------------------------------------------------------------------

/**
 * Convert a single DAS asset into a playable NFTCard.
 */
export function assetToCard(
  asset: DASAsset,
  holdDays: number = 0,
  overrides?: { isPFP?: boolean; costBasisSOL?: number; nickname?: string }
): NFTCard {
  const attributes = asset.content.metadata.attributes ?? [];
  const isPFP = overrides?.isPFP ?? false;
  const costBasisSOL = overrides?.costBasisSOL;

  const stats = calculateStats(attributes, holdDays, {
    isPFP,
    costBasisSOL,
  });

  const collectionGroup = asset.grouping.find(
    (g) => g.group_key === "collection"
  );

  return {
    id: asset.id,
    name: asset.content.metadata.name,
    image: asset.content.links?.image ?? "",
    collection: collectionGroup?.group_value ?? "",
    attributes,
    metadataUri: asset.content.json_uri,
    stats,
    holdDays,
    isPFP,
    costBasisSOL,
    nickname: overrides?.nickname,
  };
}

// ---------------------------------------------------------------------------
// High-level: Pluggable inventory loader
// ---------------------------------------------------------------------------

export interface LoadInventoryOptions {
  walletAddress: string;
  collectionAddress: string;

  /**
   * PLUGGABLE SOURCE: If provided, skips Helius fetch entirely.
   * Integration point for Clayno.club or any external provider
   * that supplies DASAsset-shaped data.
   *
   * Assets are still filtered by collectionAddress, so the
   * override can safely contain mixed-collection data.
   */
  inventoryOverride?: DASAsset[];

  /** Ignore locally cached ownership and fetch a fresh wallet inventory. */
  forceRefresh?: boolean;

  /** Reports human-readable loading progress to the interface. */
  onProgress?: (message: string) => void;

  /**
   * Pre-computed hold times: Map<mintAddress, days>.
   * If not provided, cards start with holdDays=0 and
   * hold times are patched in asynchronously.
   */
  holdTimes?: Map<string, number>;

  /**
   * Player overrides from localStorage (PFP, cost basis, nickname).
   */
  cardOverrides?: Record<
    string,
    { isPFP?: boolean; costBasisSOL?: number; nickname?: string }
  >;
}

/**
 * Load inventory → filter → transform → return NFTCards.
 *
 * Source priority:
 *   1. inventoryOverride (if provided) — e.g. from Clayno.club
 *   2. Helius DAS API getAssetsByOwner (default)
 */
export async function loadInventory(
  options: LoadInventoryOptions
): Promise<NFTCard[]> {
  const {
    walletAddress,
    collectionAddress,
    inventoryOverride,
    forceRefresh = false,
    onProgress,
    holdTimes,
    cardOverrides,
  } = options;

  // --- Step 1: Resolve source ---
  let allAssets: DASAsset[];

  if (inventoryOverride) {
    onProgress?.("Using supplied local inventory…");
    allAssets = inventoryOverride;
  } else {
    const cachedAssets = loadInventoryCache(walletAddress);

    if (cachedAssets && !forceRefresh) {
      onProgress?.(`Loading ${cachedAssets.length} wallet assets from this browser…`);
      allAssets = cachedAssets;
    } else {
      try {
        allAssets = await fetchAllNFTsByOwner(walletAddress, onProgress);
        onProgress?.("Saving wallet inventory in this browser…");
        saveInventoryCache(walletAddress, allAssets);
      } catch (error) {
        if (!cachedAssets) throw error;
        onProgress?.("Helius refresh failed · using previous local inventory…");
        allAssets = cachedAssets;
      }
    }
  }

  // --- Step 2: Filter by collection ---
  onProgress?.("Filtering collection and calculating card stats…");
  const collectionAssets = filterByCollection(allAssets, collectionAddress);

  // --- Step 3: Transform to NFTCards ---
  const cards = collectionAssets.map((asset) => {
    const holdDays = holdTimes?.get(asset.id) ?? 0;
    const overrides = cardOverrides?.[asset.id];
    return assetToCard(asset, holdDays, overrides);
  });

  return cards;
}

// ---------------------------------------------------------------------------
// Extended metadata fetch (fallback)
// ---------------------------------------------------------------------------

export async function fetchFullMetadata(
  jsonUri: string
): Promise<Record<string, unknown>> {
  const response = await fetch(jsonUri);
  if (!response.ok)
    throw new Error(`Metadata fetch failed: ${response.status}`);
  return response.json();
}
