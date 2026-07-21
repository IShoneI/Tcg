"use client";

import { motion } from "framer-motion";
import type { NFTCard } from "@/types/card";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeEffect(card: NFTCard): string {
  const e = card.stats.ability.effect;
  switch (e.type) {
    case "damage":
      return `Deals ${e.multiplier}× attack damage`;
    case "heal":
      return `Restores ${e.amount} HP`;
    case "buff":
      return `+${e.amount} ${e.stat} for ${e.turns} turns`;
    case "debuff":
      return `−${e.amount} enemy ${e.stat} for ${e.turns} turns`;
  }
}

function getLevelTier(level: number): { label: string; color: string } {
  if (level >= 40) return { label: "Legendary", color: "text-yellow-400" };
  if (level >= 30) return { label: "Epic", color: "text-purple-400" };
  if (level >= 20) return { label: "Rare", color: "text-blue-400" };
  if (level >= 10) return { label: "Uncommon", color: "text-green-400" };
  return { label: "Common", color: "text-gray-400" };
}

function StatRow({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-10 text-right text-sm text-gray-300 tabular-nums font-medium">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CardDetailProps {
  card: NFTCard;
  onClose: () => void;
}

export default function CardDetail({ card, onClose }: CardDetailProps) {
  const tier = getLevelTier(card.stats.level);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-[#111827] border border-white/10
                   rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center
                     rounded-full bg-black/50 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>

        {/* Image */}
        <div className="relative h-64 sm:h-72 bg-black/40">
          <img
            src={card.image}
            alt={card.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent" />

          {/* Overlay badges */}
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <span className="px-2 py-1 rounded-md text-xs font-bold bg-black/60 backdrop-blur-sm text-white tabular-nums">
              Level {card.stats.level}
            </span>
            <span className={`px-2 py-1 rounded-md text-xs font-semibold bg-black/60 backdrop-blur-sm ${tier.color}`}>
              {tier.label}
            </span>
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-black/60 backdrop-blur-sm text-gray-300">
              {card.stats.className}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">
                {card.nickname ?? card.name}
              </h2>
              {card.nickname && (
                <p className="text-xs text-gray-600">{card.name}</p>
              )}
            </div>
            <div className="flex gap-1.5 shrink-0">
              {card.isPFP && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-clay-500/20 text-clay-300">
                  PFP
                </span>
              )}
              {card.holdDays > 0 && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-gray-400">
                  {card.holdDays}d held
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2.5">
            <StatRow label="HP" value={card.stats.hp} max={250} color="bg-green-500" />
            <StatRow label="Attack" value={card.stats.attack} max={80} color="bg-red-500" />
            <StatRow label="Defense" value={card.stats.defense} max={80} color="bg-blue-500" />
            <StatRow label="Rarity" value={card.stats.rarityScore} max={140} color="bg-yellow-500" />
          </div>

          {/* Ability */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-200">
                {card.stats.ability.name}
              </span>
              <span className="text-[10px] text-gray-600">
                {card.stats.ability.cooldown} turn cooldown
              </span>
            </div>
            <p className="text-xs text-gray-400">{describeEffect(card)}</p>
            {card.stats.ability.damage > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                +{card.stats.ability.damage} bonus damage
              </p>
            )}
          </div>

          {/* Traits */}
          {card.attributes.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Traits</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {card.attributes.map((attr) => (
                  <div key={`${attr.trait_type}-${attr.value}`} className="flex justify-between text-xs">
                    <span className="text-gray-600">{attr.trait_type}</span>
                    <span className="text-gray-300">{String(attr.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mint address */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-gray-700 truncate font-mono" title={card.id}>
              {card.id}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
