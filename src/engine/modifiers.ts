/**
 * Hold time bonus — diminishing returns via log2.
 * Rewards long-term holders up to ~1024 days.
 */
export function holdTimeBonus(holdDays: number): {
  hp: number;
  attack: number;
  defense: number;
} {
  const factor = Math.min(Math.log2(Math.max(holdDays, 0) + 1), 10);
  return {
    hp: Math.round(factor * 3), // up to +30
    attack: Math.round(factor * 1.5), // up to +15
    defense: Math.round(factor * 1.5), // up to +15
  };
}

/**
 * PFP bonus — flat boost if user flags this NFT as their profile picture.
 */
export function pfpBonus(isPFP: boolean): number {
  return isPFP ? 10 : 0;
}

/**
 * Cost basis modifier — optional, rewards conviction.
 * Higher cost basis = more skin in the game.
 */
export function costBasisModifier(costBasisSOL?: number): number {
  if (!costBasisSOL || costBasisSOL <= 0) return 0;
  return Math.min(Math.round(costBasisSOL * 2), 20); // cap +20
}

// === Future stubs ===

export function stakingXPBonus(xp: number): number {
  return Math.round(xp / 100);
}

export function achievementBonus(badges: string[]): number {
  return badges.length * 5;
}
