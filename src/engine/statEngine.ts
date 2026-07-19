import type { CardStats } from "@/types/card";
import { resolveClass } from "./classMapping";
import { computeTraitScore } from "./rarityScoring";
import { holdTimeBonus, pfpBonus, costBasisModifier } from "./modifiers";
import { resolveAbility } from "./abilityResolver";

interface StatOptions {
  rarityTable?: Record<string, number>;
  isPFP?: boolean;
  costBasisSOL?: number;
}

/**
 * Calculate final card stats from NFT attributes and on-chain data.
 * This is the core function that turns an NFT into a playable card.
 */
export function calculateStats(
  attributes: Array<{ trait_type: string; value: string | number }>,
  holdDays: number,
  options: StatOptions = {}
): CardStats {
  // 1. Base stats from class
  const classProfile = resolveClass(attributes);

  // 2. Trait rarity score
  const traitScore = computeTraitScore(attributes, options.rarityTable);

  // 3. Hold time modifier
  const holdMod = holdTimeBonus(holdDays);

  // 4. Optional modifiers
  const pfp = pfpBonus(options.isPFP ?? false);
  const cost = costBasisModifier(options.costBasisSOL);

  // 5. Assemble final stats
  const hp =
    classProfile.baseHP +
    holdMod.hp +
    pfp +
    Math.round(traitScore * 0.5);

  const attack =
    classProfile.baseAttack +
    holdMod.attack +
    pfp +
    Math.round(traitScore * 0.3) +
    cost;

  const defense =
    classProfile.baseDefense +
    holdMod.defense +
    pfp +
    Math.round(traitScore * 0.2);

  // 6. Level (power indicator, 1–50 scale)
  const totalModifiers =
    traitScore +
    holdMod.hp +
    holdMod.attack +
    holdMod.defense +
    pfp +
    cost;
  const level = Math.min(Math.max(Math.round(totalModifiers / 5), 1), 50);

  // 7. Ability — deterministic selection from class pool based on trait score
  const abilityIndex = traitScore % classProfile.abilityPool.length;
  const abilityName = classProfile.abilityPool[abilityIndex];
  const ability = resolveAbility(abilityName, level);

  return {
    hp,
    attack,
    defense,
    ability,
    rarityScore: traitScore,
    className: classProfile.name,
    level,
  };
}
