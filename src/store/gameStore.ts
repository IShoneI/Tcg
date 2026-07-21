import { create } from "zustand";
import type { NFTCard, DASAsset, CollectionConfig, Deck } from "@/types/card";
import { loadInventory, assetToCard } from "@/services/nftService";
import { calculateStats } from "@/engine/statEngine";
import { batchGetHoldTimes } from "@/services/solanaService";
import {
  loadProfile,
  createDefaultProfile,
  saveProfile,
  loadHoldTimeCache,
  saveHoldTimeCache,
} from "@/services/storageService";

// ---------------------------------------------------------------------------
// Supported collections
// ---------------------------------------------------------------------------

export const COLLECTIONS: CollectionConfig[] = [
  {
    name: "Claynosaurz",
    slug: "claynosaurz",
    collectionAddress: "6mszaj17KSfVqADrQj3o4W3zoLMTykgmV37W4QadCczK",
    description: "The original seven-species Claynosaurz collection",
  },
  {
    name: "Call of Saga",
    slug: "call-of-saga",
    collectionAddress: "1yPMtWU5aqcF72RdyRD5yipmcMRC8NGNK59NvYubLkZ",
    description: "The Call of Saga expansion collection",
  },
  {
    name: "Claymakers",
    slug: "claymakers",
    collectionAddress: "HNXtJUwq9KLxXBYLNjUeX9uoFZG2mqyah3bP4QbbBF6h",
    description: "Claymaker utility and crafting assets",
  },
  {
    name: "Clay",
    slug: "clay",
    collectionAddress: "FhMPFCH2rXfkQ2AvnjuJUiBej8jgHH9D43DDkBTTL4MM",
    description: "Six clay colours and gold clay resources",
  },
  {
    name: "Cosmetics",
    slug: "cosmetics",
    collectionAddress: "AFLtCtc5BJmdysMzDCjcbrtmc8z8MStg7CFGzA9FzveG",
    description: "Head, body, feet and special artefact cosmetics",
  },
];

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface GameState {
  // Wallet
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;

  // Collection
  activeCollection: CollectionConfig;
  setActiveCollection: (collection: CollectionConfig) => void;

  // Pluggable inventory source
  inventoryOverride: DASAsset[] | null;
  setInventoryOverride: (assets: DASAsset[] | null) => void;

  // Cards
  cards: NFTCard[];
  setCards: (cards: NFTCard[]) => void;
  isLoadingCards: boolean;
  setIsLoadingCards: (loading: boolean) => void;
  loadError: string | null;
  setLoadError: (error: string | null) => void;
  loadStatus: string | null;
  lastFetchedAt: number | null;

  // Hold time loading (separate from card load — non-blocking)
  isLoadingHoldTimes: boolean;
  holdTimesLoaded: boolean;

  // Decks (Phase 2)
  decks: Deck[];

  // Utility
  getCardById: (mintAddress: string) => NFTCard | undefined;
  reset: () => void;

  // === Core action: load cards from wallet ===
  loadCards: (walletAddress: string, forceRefresh?: boolean) => Promise<void>;

  // === Refresh hold times in background ===
  loadHoldTimes: (walletAddress: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useGameStore = create<GameState>((set, get) => ({
  // Wallet
  walletAddress: null,
  setWalletAddress: (address) => set({ walletAddress: address }),

  // Collection
  activeCollection: COLLECTIONS[0],
  setActiveCollection: (collection) =>
    set({
      activeCollection: collection,
      cards: [],
      loadError: null,
      loadStatus: null,
      lastFetchedAt: null,
      holdTimesLoaded: false,
    }),

  // Pluggable source
  inventoryOverride: null,
  setInventoryOverride: (assets) => set({ inventoryOverride: assets }),

  // Cards
  cards: [],
  setCards: (cards) => set({ cards, lastFetchedAt: Date.now() }),
  isLoadingCards: false,
  setIsLoadingCards: (loading) => set({ isLoadingCards: loading }),
  loadError: null,
  setLoadError: (error) => set({ loadError: error }),
  loadStatus: null,
  lastFetchedAt: null,

  // Hold times
  isLoadingHoldTimes: false,
  holdTimesLoaded: false,

  // Decks
  decks: [],

  // Utility
  getCardById: (mintAddress) => get().cards.find((c) => c.id === mintAddress),
  reset: () =>
    set({
      walletAddress: null,
      cards: [],
      decks: [],
      isLoadingCards: false,
      isLoadingHoldTimes: false,
      holdTimesLoaded: false,
      loadError: null,
      loadStatus: null,
      lastFetchedAt: null,
      inventoryOverride: null,
    }),

  // ---------------------------------------------------------------------------
  // loadCards: Orchestrates the full pipeline
  //   1. Resolve source (override vs Helius)
  //   2. Filter by collection
  //   3. Run stat engine
  //   4. Store in Zustand
  //   5. Kick off hold time fetch in background
  // ---------------------------------------------------------------------------
  loadCards: async (walletAddress: string, forceRefresh = false) => {
    const { activeCollection, inventoryOverride } = get();

    set({
      isLoadingCards: true,
      loadError: null,
      loadStatus: "Preparing wallet inventory…",
      cards: [],
      holdTimesLoaded: false,
    });

    try {
      // Load player profile for card overrides (PFP, cost basis, etc.)
      const profile =
        loadProfile(walletAddress) ?? createDefaultProfile(walletAddress);

      // Check hold time cache
      const cachedHoldTimes = loadHoldTimeCache(walletAddress);
      const holdTimes = cachedHoldTimes
        ? new Map(Object.entries(cachedHoldTimes))
        : undefined;

      // Load inventory — uses override if set, otherwise Helius
      const cards = await loadInventory({
        walletAddress,
        collectionAddress: activeCollection.collectionAddress,
        inventoryOverride: inventoryOverride ?? undefined,
        forceRefresh,
        onProgress: (loadStatus) => set({ loadStatus }),
        holdTimes,
        cardOverrides: profile.cardOverrides,
      });

      set({
        cards,
        walletAddress,
        isLoadingCards: false,
        lastFetchedAt: Date.now(),
        holdTimesLoaded: !!cachedHoldTimes,
        loadStatus: null,
      });

      // Save profile if first visit
      if (!loadProfile(walletAddress)) {
        saveProfile(profile);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load NFTs";
      set({
        loadError: message,
        isLoadingCards: false,
        loadStatus: null,
      });
    }
  },

  // ---------------------------------------------------------------------------
  // loadHoldTimes: Fetches hold times in background, patches cards in place
  // ---------------------------------------------------------------------------
  loadHoldTimes: async (walletAddress: string) => {
    const { cards } = get();
    if (cards.length === 0) return;

    set({ isLoadingHoldTimes: true });

    try {
      const mintAddresses = cards.map((c) => c.id);
      const holdTimes = await batchGetHoldTimes(mintAddresses, 3);

      // Cache for next session
      const cacheObj: Record<string, number> = {};
      holdTimes.forEach((days, mint) => {
        cacheObj[mint] = days;
      });
      saveHoldTimeCache(walletAddress, cacheObj);

      // Recalculate stats with real hold times
      const profile = loadProfile(walletAddress);
      const updatedCards = cards.map((card) => {
        const newHoldDays = holdTimes.get(card.id) ?? card.holdDays;
        if (newHoldDays === card.holdDays) return card;

        const overrides = profile?.cardOverrides[card.id];
        const newStats = calculateStats(card.attributes, newHoldDays, {
          isPFP: overrides?.isPFP ?? card.isPFP,
          costBasisSOL: overrides?.costBasisSOL ?? card.costBasisSOL,
        });

        return { ...card, holdDays: newHoldDays, stats: newStats };
      });

      set({
        cards: updatedCards,
        isLoadingHoldTimes: false,
        holdTimesLoaded: true,
      });
    } catch (err) {
      console.warn("Hold time fetch failed:", err);
      set({ isLoadingHoldTimes: false });
    }
  },
}));
