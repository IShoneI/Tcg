// Canonical Claynosaurz trait space, verified against HowRare.is (July 2026).
// Background, Mood and Motion traits never affect battle.

export const SKIN_NAMES = [
  "Apres",
  "Toxic",
  "Elektra",
  "Coral",
  "Oceania",
  "Cristalline",
  "Savanna",
  "Jurassic",
  "Amazonia",
  "Mirage",
] as const;

export type SkinName = (typeof SKIN_NAMES)[number];

export const COLOR_NAMES = [
  "Mist",
  "Charcoal",
  "Amethyst",
  "Spring",
  "Aqua",
  "Tropic",
  "Desert",
  "Volcanic",
] as const;

export type ColorName = (typeof COLOR_NAMES)[number];

interface TraitCensus {
  genesis: number;
  saga: number;
}

// Rarity rank = array order above (rarest first). Counts are the mint census
// and set each trait's power ceiling, never its stat budget.
export const SKIN_CENSUS: Record<SkinName, TraitCensus> = {
  Apres: { genesis: 281, saga: 61 },
  Toxic: { genesis: 587, saga: 122 },
  Elektra: { genesis: 784, saga: 160 },
  Coral: { genesis: 805, saga: 175 },
  Oceania: { genesis: 814, saga: 164 },
  Cristalline: { genesis: 893, saga: 181 },
  Savanna: { genesis: 1154, saga: 233 },
  Jurassic: { genesis: 1227, saga: 238 },
  Amazonia: { genesis: 1358, saga: 279 },
  Mirage: { genesis: 2083, saga: 383 },
};

export const COLOR_CENSUS: Record<ColorName, TraitCensus> = {
  Mist: { genesis: 388, saga: 83 },
  Charcoal: { genesis: 484, saga: 105 },
  Amethyst: { genesis: 889, saga: 143 },
  Spring: { genesis: 977, saga: 219 },
  Aqua: { genesis: 1703, saga: 336 },
  Tropic: { genesis: 1710, saga: 345 },
  Desert: { genesis: 1877, saga: 376 },
  Volcanic: { genesis: 1958, saga: 389 },
};

export function normaliseSkin(value: string | undefined): SkinName | null {
  const needle = value?.trim().toLowerCase();
  return SKIN_NAMES.find((name) => name.toLowerCase() === needle) ?? null;
}

export function normaliseColor(value: string | undefined): ColorName | null {
  const needle = value?.trim().toLowerCase();
  return COLOR_NAMES.find((name) => name.toLowerCase() === needle) ?? null;
}

export function skinRarityRank(skin: SkinName): number {
  return SKIN_NAMES.indexOf(skin);
}
