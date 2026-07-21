import { normaliseColor, normaliseSkin, type ColorName, type SkinName } from "@/data/traitCatalog";
import type { HerdMember } from "@/types/herd";

// Companion tiers are dynamic: pass only standing (non-defeated) members, so
// knocking dinos out strips the tiers they were upholding.

export type CompanionTier = "none" | "solo" | "pack" | "pride" | "full";

const TIER_ORDER: Record<CompanionTier, number> = {
  none: 0,
  solo: 1,
  pack: 2,
  pride: 3,
  full: 4,
};

export function tierForCount(count: number, formatSize: number): CompanionTier {
  if (count <= 0) return "none";
  if (count >= formatSize) return "full";
  if (count >= 4) return "pride";
  if (count >= 2) return "pack";
  return "solo";
}

export function tierAtLeast(tier: CompanionTier, floor: CompanionTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[floor];
}

export interface HerdComposition {
  formatSize: number;
  skinCounts: Partial<Record<SkinName, number>>;
  colorCounts: Partial<Record<ColorName, number>>;
}

export function composeHerd(standing: HerdMember[], formatSize: number): HerdComposition {
  const skinCounts: Partial<Record<SkinName, number>> = {};
  const colorCounts: Partial<Record<ColorName, number>> = {};
  for (const member of standing) {
    const skin = normaliseSkin(member.skin);
    if (skin) skinCounts[skin] = (skinCounts[skin] ?? 0) + 1;
    const color = normaliseColor(member.colour);
    if (color) colorCounts[color] = (colorCounts[color] ?? 0) + 1;
  }
  return { formatSize, skinCounts, colorCounts };
}

export function skinTier(composition: HerdComposition, skin: SkinName | null): CompanionTier {
  if (!skin) return "none";
  return tierForCount(composition.skinCounts[skin] ?? 0, composition.formatSize);
}

export function colorTier(composition: HerdComposition, color: ColorName | null): CompanionTier {
  if (!color) return "none";
  return tierForCount(composition.colorCounts[color] ?? 0, composition.formatSize);
}

export interface TraitGroup {
  kind: "skin" | "colour";
  value: SkinName | ColorName;
  count: number;
  tier: CompanionTier;
}

/** All trait groups at Pack tier or better, strongest first — for UI badges. */
export function activeGroups(composition: HerdComposition): TraitGroup[] {
  const groups: TraitGroup[] = [];
  for (const [value, count] of Object.entries(composition.skinCounts)) {
    const tier = tierForCount(count, composition.formatSize);
    if (tierAtLeast(tier, "pack")) groups.push({ kind: "skin", value: value as SkinName, count, tier });
  }
  for (const [value, count] of Object.entries(composition.colorCounts)) {
    const tier = tierForCount(count, composition.formatSize);
    if (tierAtLeast(tier, "pack")) groups.push({ kind: "colour", value: value as ColorName, count, tier });
  }
  return groups.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

/**
 * The herd's display identity: its dominant skin (ties broken by rarity, then
 * name). Never throws — mixed herds are legal in herd-alpha-2.
 */
export function dominantSkin(members: HerdMember[]): { skin: SkinName | null; count: number } {
  const composition = composeHerd(members, members.length || 1);
  let best: { skin: SkinName | null; count: number } = { skin: null, count: 0 };
  for (const [value, count] of Object.entries(composition.skinCounts)) {
    if (count > best.count) best = { skin: value as SkinName, count };
  }
  return best;
}
