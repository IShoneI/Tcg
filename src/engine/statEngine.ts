import type { CardStats } from "@/types/card";
import type { ClassName, Species } from "@/types/herd";
import { computeTraitScore } from "./rarityScoring";
import { resolveAbility } from "./abilityResolver";
import { applyClass, createClassState, SPECIES_STATS, traitTier } from "./herdRules";

interface StatOptions {
  rarityTable?: Record<string, number>;
  isPFP?: boolean;
  costBasisSOL?: number;
}

const CLASS_ABILITIES: Record<ClassName, string> = {
  Defender: "Fortify",
  Warrior: "Tail Smash",
  Mender: "Heal",
  Tracker: "Swift Strike",
  Stalker: "Ambush",
  Mystic: "Curse",
  Soarer: "Dodge",
};

/**
 * Gallery compatibility adapter for the equal-budget herd rules.
 * Hold time, PFP status and purchase price are deliberately ignored.
 */
export function calculateStats(
  attributes: Array<{ trait_type: string; value: string | number }>,
  _holdDays: number,
  options: StatOptions = {}
): CardStats {
  const species = readSpecies(attributes);
  const classState = createClassState(species, readAttribute(attributes, "Class"));
  const core = applyClass(SPECIES_STATS[species], classState.className);
  const traitScore = computeTraitScore(attributes, options.rarityTable);
  const rarity = options.rarityTable
    ? traitTier(Math.max(0.001, Math.min(1, 1 / Math.max(traitScore, 1))))
    : "common";
  const level = { common: 1, uncommon: 2, rare: 3, epic: 4, mythic: 5 }[rarity];

  return {
    hp: 40 + core.health * 10,
    attack: 6 + core.power * 2,
    defense: core.guard * 3,
    ability: resolveAbility(CLASS_ABILITIES[classState.className], 1),
    rarityScore: traitScore,
    className: classState.className,
    level,
  };
}

function readSpecies(attributes: Array<{ trait_type: string; value: string | number }>): Species {
  const raw = readAttribute(attributes, "Species") || "Rex";
  return (Object.keys(SPECIES_STATS).find((candidate) => candidate.toLowerCase() === raw.toLowerCase()) as Species | undefined) ?? "Rex";
}

function readAttribute(attributes: Array<{ trait_type: string; value: string | number }>, name: string): string | undefined {
  const value = attributes.find((attribute) => attribute.trait_type.toLowerCase() === name.toLowerCase())?.value;
  const result = value == null ? "" : String(value).trim();
  return result || undefined;
}
