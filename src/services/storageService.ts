import type { DASAsset, PlayerProfile } from "@/types/card";

const STORAGE_PREFIX = "nft-tcg";

interface InventoryCache {
  data: DASAsset[];
  cachedAt: number;
}

/**
 * Persist the last complete DAS inventory for a wallet. This cache has no
 * automatic expiry: ownership is refreshed only when the player explicitly
 * requests it from the gallery.
 */
export function saveInventoryCache(
  walletAddress: string,
  assets: DASAsset[]
): void {
  const key = `${STORAGE_PREFIX}:inventory:${walletAddress}`;
  const value: InventoryCache = { data: assets, cachedAt: Date.now() };

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // A very large wallet can exceed the browser's localStorage quota. The
    // gallery should still work for the current session if persistence fails.
    console.warn("Unable to persist wallet inventory locally:", error);
  }
}

export function loadInventoryCache(walletAddress: string): DASAsset[] | null {
  const key = `${STORAGE_PREFIX}:inventory:${walletAddress}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const cache = JSON.parse(raw) as InventoryCache;
    return Array.isArray(cache.data) ? cache.data : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function clearInventoryCache(walletAddress: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}:inventory:${walletAddress}`);
}

export function saveProfile(profile: PlayerProfile): void {
  const key = `${STORAGE_PREFIX}:${profile.walletAddress}`;
  localStorage.setItem(key, JSON.stringify(profile));
}

export function loadProfile(walletAddress: string): PlayerProfile | null {
  const key = `${STORAGE_PREFIX}:${walletAddress}`;
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

export function createDefaultProfile(walletAddress: string): PlayerProfile {
  return {
    walletAddress,
    decks: [],
    matchHistory: [],
    cardOverrides: {},
    stats: {
      wins: 0,
      losses: 0,
      winStreak: 0,
      bestWinStreak: 0,
      totalBattles: 0,
    },
    lastUpdated: Date.now(),
  };
}

/**
 * Cache hold times so we don't re-fetch every session.
 */
export function saveHoldTimeCache(
  walletAddress: string,
  holdTimes: Record<string, number>
): void {
  const key = `${STORAGE_PREFIX}:holdtimes:${walletAddress}`;
  localStorage.setItem(
    key,
    JSON.stringify({ data: holdTimes, cachedAt: Date.now() })
  );
}

export function loadHoldTimeCache(
  walletAddress: string,
  maxAgeMs: number = Number.POSITIVE_INFINITY
): Record<string, number> | null {
  const key = `${STORAGE_PREFIX}:holdtimes:${walletAddress}`;
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  const { data, cachedAt } = JSON.parse(raw);
  if (Date.now() - cachedAt > maxAgeMs) return null;
  return data;
}
