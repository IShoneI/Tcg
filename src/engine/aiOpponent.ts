// AI opponent logic — Phase 2 implementation

import type { CardStats } from "@/types/card";

export interface AIOpponent {
  name: string;
  difficulty: "easy" | "medium" | "hard";
  deck: CardStats[];
  avatarUrl: string;
}

/**
 * Placeholder — will generate AI opponents
 * with difficulty-scaled stats.
 */
export function generateAIOpponent(
  _difficulty: "easy" | "medium" | "hard"
): AIOpponent {
  // Phase 2
  throw new Error("AI opponent not yet implemented");
}
