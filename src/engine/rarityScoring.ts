/**
 * Compute a rarity score for an NFT based on its traits.
 *
 * If a pre-computed rarity table is provided (recommended),
 * uses inverse-percentage scoring. Otherwise falls back to
 * a simple heuristic based on trait count.
 *
 * Rarity table format: { "trait_type::value": percentOfCollection }
 * e.g. { "Eyes::Laser": 0.02, "Skin::Forest": 0.15 }
 */
export function computeTraitScore(
  attributes: Array<{ trait_type: string; value: string | number }>,
  rarityTable?: Record<string, number>
): number {
  if (!rarityTable) {
    // Fallback: each filled trait slot = 2 points
    // Typical Claynosaurz has 5-7 traits → 10-14 points
    return attributes.length * 2;
  }

  return attributes.reduce((score, attr) => {
    const key = `${attr.trait_type}::${attr.value}`;
    const pct = rarityTable[key] ?? 0.5; // unknown trait = assume common
    // Inverse: 2% rarity → (1 - 0.02) * 20 = 19.6 → 20 points
    // 50% rarity → (1 - 0.5) * 20 = 10 points
    const rarityBonus = Math.round((1 - pct) * 20);
    return score + rarityBonus;
  }, 0);
}

/**
 * Generate a rarity table from a full collection snapshot.
 * Input: array of all NFTs' attributes in the collection.
 * Output: Record<"trait_type::value", percentage>
 *
 * You can run this once offline using your existing Claynosaurz
 * dataset and export the result as a JSON file.
 */
export function buildRarityTable(
  allNFTAttributes: Array<Array<{ trait_type: string; value: string | number }>>
): Record<string, number> {
  const total = allNFTAttributes.length;
  const counts: Record<string, number> = {};

  for (const attrs of allNFTAttributes) {
    for (const attr of attrs) {
      const key = `${attr.trait_type}::${attr.value}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const table: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    table[key] = count / total;
  }

  return table;
}
