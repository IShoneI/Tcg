"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { NFTCard } from "@/types/card";

// ---------------------------------------------------------------------------
// Class → color mapping
// ---------------------------------------------------------------------------

const CLASS_COLORS: Record<string, { border: string; badge: string; glow: string }> = {
  Warrior:  { border: "border-red-500/40",    badge: "bg-red-500/20 text-red-300",    glow: "shadow-red-500/10" },
  Tracker:  { border: "border-emerald-500/40", badge: "bg-emerald-500/20 text-emerald-300", glow: "shadow-emerald-500/10" },
  Tank:     { border: "border-amber-500/40",   badge: "bg-amber-500/20 text-amber-300",   glow: "shadow-amber-500/10" },
  Defender: { border: "border-blue-500/40",    badge: "bg-blue-500/20 text-blue-300",    glow: "shadow-blue-500/10" },
  Mystic:   { border: "border-purple-500/40",  badge: "bg-purple-500/20 text-purple-300",  glow: "shadow-purple-500/10" },
  Support:  { border: "border-cyan-500/40",    badge: "bg-cyan-500/20 text-cyan-300",    glow: "shadow-cyan-500/10" },
  Fortress: { border: "border-orange-500/40",  badge: "bg-orange-500/20 text-orange-300",  glow: "shadow-orange-500/10" },
  Wildcard: { border: "border-gray-500/40",    badge: "bg-gray-500/20 text-gray-300",    glow: "shadow-gray-500/10" },
};

function getClassStyle(className: string) {
  return CLASS_COLORS[className] ?? CLASS_COLORS.Wildcard;
}

// ---------------------------------------------------------------------------
// Stat bar
// ---------------------------------------------------------------------------

function StatBar({
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
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-gray-500 font-medium shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 text-right text-gray-400 tabular-nums">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ability effect description
// ---------------------------------------------------------------------------

function describeAbility(card: NFTCard): string {
  const { ability } = card.stats;
  const e = ability.effect;
  switch (e.type) {
    case "damage":
      return `${e.multiplier}x dmg`;
    case "heal":
      return `Heal ${e.amount}`;
    case "buff":
      return `+${e.amount} ${e.stat} (${e.turns}t)`;
    case "debuff":
      return `-${e.amount} ${e.stat} (${e.turns}t)`;
  }
}

// ---------------------------------------------------------------------------
// Level badge rarity tier
// ---------------------------------------------------------------------------

function getLevelTier(level: number): { label: string; color: string } {
  if (level >= 40) return { label: "Legendary", color: "text-yellow-400" };
  if (level >= 30) return { label: "Epic", color: "text-purple-400" };
  if (level >= 20) return { label: "Rare", color: "text-blue-400" };
  if (level >= 10) return { label: "Uncommon", color: "text-green-400" };
  return { label: "Common", color: "text-gray-400" };
}

// ---------------------------------------------------------------------------
// CardDisplay
// ---------------------------------------------------------------------------

interface CardDisplayProps {
  card: NFTCard;
  onClick?: (card: NFTCard) => void;
  selected?: boolean;
  compact?: boolean;
}

export default function CardDisplay({
  card,
  onClick,
  selected = false,
  compact = false,
}: CardDisplayProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const classStyle = getClassStyle(card.stats.className);
  const tier = getLevelTier(card.stats.level);

  return (
    <motion.div
      layout
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(card)}
      className={`
        relative flex flex-col rounded-xl border overflow-hidden
        bg-[#111827] cursor-pointer transition-shadow duration-200
        ${classStyle.border}
        ${selected ? `ring-2 ring-clay-400 ${classStyle.glow} shadow-lg` : "shadow-md shadow-black/40"}
        ${compact ? "w-40" : "w-56"}
      `}
    >
      {/* --- Image --- */}
      <div className={`relative ${compact ? "h-40" : "h-52"} bg-black/40 overflow-hidden`}>
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 loading-shimmer" />
        )}
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
            No image
          </div>
        ) : (
          <img
            src={card.image}
            alt={card.nickname ?? card.name}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Level badge — top left */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold
                       bg-black/70 backdrop-blur-sm tabular-nums text-white"
          >
            Lv.{card.stats.level}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold
                        bg-black/70 backdrop-blur-sm ${tier.color}`}
          >
            {tier.label}
          </span>
        </div>

        {/* Class badge — top right */}
        <span
          className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded
                      text-[10px] font-semibold backdrop-blur-sm ${classStyle.badge}`}
        >
          {card.stats.className}
        </span>

        {/* Hold time — bottom right */}
        {card.holdDays > 0 && (
          <span
            className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded
                       text-[10px] text-gray-300 bg-black/60 backdrop-blur-sm"
          >
            {card.holdDays}d held
          </span>
        )}

        {/* PFP indicator */}
        {card.isPFP && (
          <span
            className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded
                       text-[10px] font-semibold bg-clay-500/30 text-clay-300 backdrop-blur-sm"
          >
            PFP
          </span>
        )}
      </div>

      {/* --- Info --- */}
      <div className={`flex flex-col gap-2 ${compact ? "p-2" : "p-3"}`}>
        {/* Name */}
        <h3
          className={`font-display font-semibold truncate ${
            compact ? "text-xs" : "text-sm"
          }`}
          title={card.nickname ?? card.name}
        >
          {card.nickname ?? card.name}
        </h3>

        {/* Stat bars */}
        {!compact && (
          <div className="flex flex-col gap-1.5">
            <StatBar label="HP" value={card.stats.hp} max={250} color="bg-green-500" />
            <StatBar label="ATK" value={card.stats.attack} max={80} color="bg-red-500" />
            <StatBar label="DEF" value={card.stats.defense} max={80} color="bg-blue-500" />
          </div>
        )}

        {/* Compact: inline stats */}
        {compact && (
          <div className="flex gap-2 text-[10px] text-gray-400">
            <span>
              <span className="text-green-400">{card.stats.hp}</span> HP
            </span>
            <span>
              <span className="text-red-400">{card.stats.attack}</span> ATK
            </span>
            <span>
              <span className="text-blue-400">{card.stats.defense}</span> DEF
            </span>
          </div>
        )}

        {/* Ability */}
        {!compact && (
          <div
            className="flex items-center justify-between mt-0.5 px-2 py-1.5
                        rounded-md bg-white/[0.03] border border-white/[0.06]"
          >
            <span className="text-xs font-medium text-gray-200 truncate">
              {card.stats.ability.name}
            </span>
            <span className="text-[10px] text-gray-500 shrink-0 ml-2">
              {describeAbility(card)} · {card.stats.ability.cooldown}t cd
            </span>
          </div>
        )}

        {/* Traits summary */}
        {!compact && card.attributes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {card.attributes.slice(0, 4).map((attr) => (
              <span
                key={`${attr.trait_type}-${attr.value}`}
                className="px-1.5 py-0.5 rounded text-[10px] text-gray-500 bg-white/[0.03]"
                title={`${attr.trait_type}: ${attr.value}`}
              >
                {String(attr.value)}
              </span>
            ))}
            {card.attributes.length > 4 && (
              <span className="px-1.5 py-0.5 text-[10px] text-gray-600">
                +{card.attributes.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
