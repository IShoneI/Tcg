// Battle engine — Phase 2 implementation
// Structure is in place per the design doc.
// This file will be built out when we reach the battle phase.

export type ActionType = "attack" | "ability" | "swap";

export interface BattleAction {
  type: ActionType;
  cardIndex?: number; // for swap
}

/**
 * Placeholder — will contain turn resolution, damage calc,
 * class advantage matrix, and KO checks.
 */
export function resolveTurn(
  _playerAction: BattleAction,
  _opponentAction: BattleAction
): void {
  // Phase 2
  throw new Error("Battle engine not yet implemented");
}
