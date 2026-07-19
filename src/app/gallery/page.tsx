"use client";

import { useEffect, useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import CardDisplay from "@/components/CardDisplay";
import CardDetail from "@/components/CardDetail";
import type { NFTCard } from "@/types/card";
import { demoWalletAddress, isDemoWalletEnabled } from "@/config/wallet";

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortKey = "level" | "hp" | "attack" | "defense" | "rarity" | "name" | "holdDays";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "level", label: "Level" },
  { key: "hp", label: "HP" },
  { key: "attack", label: "Attack" },
  { key: "defense", label: "Defense" },
  { key: "rarity", label: "Rarity" },
  { key: "holdDays", label: "Hold Time" },
  { key: "name", label: "Name" },
];

function sortCards(cards: NFTCard[], sortKey: SortKey, ascending: boolean): NFTCard[] {
  const sorted = [...cards].sort((a, b) => {
    switch (sortKey) {
      case "level":    return b.stats.level - a.stats.level;
      case "hp":       return b.stats.hp - a.stats.hp;
      case "attack":   return b.stats.attack - a.stats.attack;
      case "defense":  return b.stats.defense - a.stats.defense;
      case "rarity":   return b.stats.rarityScore - a.stats.rarityScore;
      case "holdDays": return b.holdDays - a.holdDays;
      case "name":     return a.name.localeCompare(b.name);
      default:         return 0;
    }
  });
  return ascending ? sorted.reverse() : sorted;
}

// ---------------------------------------------------------------------------
// Class filter options
// ---------------------------------------------------------------------------

const ALL_CLASSES = [
  "All", "Warrior", "Tracker", "Tank", "Defender",
  "Mystic", "Support", "Fortress", "Wildcard",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GalleryPage() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const activeWalletAddress = demoWalletAddress || publicKey?.toBase58() || null;
  const hasWallet = activeWalletAddress !== null;

  const {
    cards,
    isLoadingCards,
    isLoadingHoldTimes,
    holdTimesLoaded,
    loadError,
    loadStatus,
    loadCards,
    loadHoldTimes,
    activeCollection,
    lastFetchedAt,
  } = useGameStore();

  // Local UI state
  const [sortKey, setSortKey] = useState<SortKey>("level");
  const [ascending, setAscending] = useState(false);
  const [classFilter, setClassFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCard, setSelectedCard] = useState<NFTCard | null>(null);

  // --- Redirect if neither a development wallet nor a connected wallet exists ---
  useEffect(() => {
    if (!hasWallet) router.push("/");
  }, [hasWallet, router]);

  // --- Load cards on wallet connect ---
  useEffect(() => {
    if (activeWalletAddress && !lastFetchedAt && !isLoadingCards) {
      loadCards(activeWalletAddress);
    }
  }, [activeWalletAddress, lastFetchedAt, isLoadingCards, loadCards]);

  // --- Kick off hold time fetch after cards load ---
  useEffect(() => {
    if (cards.length > 0 && activeWalletAddress && !holdTimesLoaded && !isLoadingHoldTimes) {
      loadHoldTimes(activeWalletAddress);
    }
  }, [cards.length, activeWalletAddress, holdTimesLoaded, isLoadingHoldTimes, loadHoldTimes]);

  // --- Filtered + sorted cards ---
  const displayedCards = useMemo(() => {
    let filtered = cards;

    // Class filter
    if (classFilter !== "All") {
      filtered = filtered.filter((c) => c.stats.className === classFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.nickname?.toLowerCase().includes(q) ?? false) ||
          c.stats.className.toLowerCase().includes(q) ||
          c.attributes.some((a) => String(a.value).toLowerCase().includes(q))
      );
    }

    return sortCards(filtered, sortKey, ascending);
  }, [cards, classFilter, searchQuery, sortKey, ascending]);

  // --- Class counts for filter badges ---
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = { All: cards.length };
    cards.forEach((c) => {
      counts[c.stats.className] = (counts[c.stats.className] ?? 0) + 1;
    });
    return counts;
  }, [cards]);

  // --- Refresh handler ---
  const handleRefresh = () => {
    if (activeWalletAddress) {
      useGameStore.setState({
        lastFetchedAt: null,
        holdTimesLoaded: false,
        cards: [],
      });
      loadCards(activeWalletAddress, true);
    }
  };

  // --- Keep selected card in sync with store (hold times patch) ---
  useEffect(() => {
    if (selectedCard) {
      const updated = cards.find((c) => c.id === selectedCard.id);
      if (updated && updated !== selectedCard) setSelectedCard(updated);
    }
  }, [cards, selectedCard]);

  // Don't render until wallet is ready
  if (!hasWallet) return null;

  return (
    <main className="min-h-screen flex flex-col">
      {/* ================================================================= */}
      {/* Top Bar                                                           */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Left: logo + collection */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/")} className="shrink-0">
              <h1 className="font-display text-lg font-bold">
                NFT <span className="text-clay-400">TCG</span>
              </h1>
            </button>
            <span className="text-gray-600">|</span>
            <span className="text-sm text-gray-400 truncate">
              {activeCollection.name}
            </span>
          </div>

          {/* Right: status + wallet */}
          <div className="flex items-center gap-3 shrink-0">
            {isLoadingHoldTimes && (
              <span className="text-[10px] text-gray-500 animate-pulse">
                Loading hold times…
              </span>
            )}
            {holdTimesLoaded && (
              <span className="text-[10px] text-clay-600">
                ✓ Hold times loaded
              </span>
            )}
            {isDemoWalletEnabled ? (
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                Demo wallet · read-only · {activeWalletAddress?.slice(0, 4)}…{activeWalletAddress?.slice(-4)}
              </span>
            ) : (
              <WalletMultiButton />
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* ================================================================= */}
        {/* Loading state                                                     */}
        {/* ================================================================= */}
        {isLoadingCards && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-2 border-clay-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">
              {loadStatus ?? `Loading ${activeCollection.name}…`}
            </p>
            <p className="text-gray-600 text-xs max-w-md text-center">
              The first successful visit contacts Helius. Later visits use the wallet inventory saved in this browser.
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* Error state                                                       */}
        {/* ================================================================= */}
        {loadError && (
          <div className="flex flex-col items-center py-32 gap-4">
            <div className="text-red-400 text-sm text-center max-w-md">
              <p className="font-semibold mb-1">Failed to load NFTs</p>
              <p className="text-gray-500">{loadError}</p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 border border-white/10
                         hover:bg-white/10 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* Empty state                                                       */}
        {/* ================================================================= */}
        {!isLoadingCards && !loadError && cards.length === 0 && lastFetchedAt && (
          <div className="flex flex-col items-center py-32 gap-4">
            <p className="text-gray-400 text-sm text-center">
              No {activeCollection.name} found in this wallet.
            </p>
            <p className="text-gray-600 text-xs text-center max-w-sm">
              Make sure you're connected with a wallet that holds {activeCollection.name} NFTs,
              or switch to a different collection.
            </p>
          </div>
        )}

        {/* ================================================================= */}
        {/* Card gallery                                                      */}
        {/* ================================================================= */}
        {!isLoadingCards && cards.length > 0 && (
          <>
            {/* --- Controls bar --- */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="Search name, trait, class…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-8 py-2 rounded-lg text-sm bg-white/5
                             border border-white/10 text-gray-200 placeholder-gray-600
                             focus:outline-none focus:border-clay-500/50 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600
                               hover:text-gray-400 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10
                             text-gray-300 focus:outline-none focus:border-clay-500/50"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setAscending(!ascending)}
                  className="px-2.5 py-2 rounded-lg text-sm bg-white/5 border border-white/10
                             text-gray-400 hover:text-gray-200 transition-colors"
                  title={ascending ? "Ascending" : "Descending"}
                >
                  {ascending ? "↑" : "↓"}
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isLoadingCards}
                className="px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10
                           text-gray-400 hover:text-gray-200 disabled:opacity-40 transition-colors"
              >
                ↻ Refresh
              </button>

              {/* Count */}
              <span className="text-xs text-gray-600 ml-auto">
                {displayedCards.length} / {cards.length} cards
              </span>
            </div>

            {/* --- Class filter pills --- */}
            <div className="flex flex-wrap gap-1.5 mb-6">
              {ALL_CLASSES.map((cls) => {
                const count = classCounts[cls] ?? 0;
                if (cls !== "All" && count === 0) return null;
                const active = classFilter === cls;
                return (
                  <button
                    key={cls}
                    onClick={() => setClassFilter(cls)}
                    className={`
                      px-3 py-1 rounded-full text-xs font-medium transition-all
                      ${
                        active
                          ? "bg-clay-500/20 text-clay-300 border border-clay-500/40"
                          : "bg-white/5 text-gray-500 border border-white/5 hover:text-gray-300"
                      }
                    `}
                  >
                    {cls}
                    {count > 0 && (
                      <span className="ml-1 opacity-60">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* --- Card grid --- */}
            <motion.div
              layout
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              }}
            >
              <AnimatePresence mode="popLayout">
                {displayedCards.map((card, i) => (
                  <motion.div
                    key={card.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.5) }}
                  >
                    <CardDisplay
                      card={card}
                      onClick={(c) => setSelectedCard(c)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* No results after filtering */}
            {displayedCards.length === 0 && (
              <div className="text-center py-16 text-gray-600 text-sm">
                No cards match your filters.
              </div>
            )}
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* Card detail modal                                                 */}
      {/* ================================================================= */}
      <AnimatePresence>
        {selectedCard && (
          <CardDetail
            card={selectedCard}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
