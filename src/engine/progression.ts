// Collector Level: earned from battles played, won and herds published.
// Levels never buy stats — they unlock access (Ancient encounters, future
// apex riders), keeping the equal-budget fairness model intact.

export const XP_RULES = {
  battlePlayed: 10,
  battleWon: 15,
  herdPublished: 20,
  ancientDefeated: 100,
} as const;

/** Cumulative XP required to reach a level: 25·n·(n−1). L2=50, L3=150, L5=500. */
export function xpForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export function levelForXP(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

export function progressWithinLevel(xp: number): { level: number; current: number; needed: number } {
  const level = levelForXP(xp);
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  return { level, current: xp - floor, needed: ceiling - floor };
}

export interface CollectorProgress {
  xp: number;
  battles: number;
  wins: number;
  publishedHerdIds: string[];
  defeatedAncientIds: string[];
}

export const EMPTY_PROGRESS: CollectorProgress = {
  xp: 0,
  battles: 0,
  wins: 0,
  publishedHerdIds: [],
  defeatedAncientIds: [],
};

export function recordBattle(progress: CollectorProgress, won: boolean): CollectorProgress {
  return {
    ...progress,
    xp: progress.xp + XP_RULES.battlePlayed + (won ? XP_RULES.battleWon : 0),
    battles: progress.battles + 1,
    wins: progress.wins + (won ? 1 : 0),
  };
}

/** Publishing the same herd id twice never double-pays. */
export function recordPublish(progress: CollectorProgress, herdId: string): CollectorProgress {
  if (progress.publishedHerdIds.includes(herdId)) return progress;
  return {
    ...progress,
    xp: progress.xp + XP_RULES.herdPublished,
    publishedHerdIds: [...progress.publishedHerdIds, herdId],
  };
}

export function recordAncientDefeat(progress: CollectorProgress, ancientId: string): CollectorProgress {
  if (progress.defeatedAncientIds.includes(ancientId)) return progress;
  return {
    ...progress,
    xp: progress.xp + XP_RULES.ancientDefeated,
    defeatedAncientIds: [...progress.defeatedAncientIds, ancientId],
  };
}
