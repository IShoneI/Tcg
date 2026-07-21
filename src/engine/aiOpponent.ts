import { activeMembers, isActionLegal, legalStrikeTargets, masteryCost, reserveMembers } from "@/engine/battleEngine";
import type { BattleState, PlannedAction, TeamId } from "@/engine/battleEngine";

export type AIDifficulty = "easy" | "medium" | "hard";

export function planAIActions(
  state: BattleState,
  teamId: TeamId = "opponent",
  difficulty: AIDifficulty = "medium"
): PlannedAction[] {
  const team = state[teamId];
  const actions: PlannedAction[] = [];

  for (const actor of activeMembers(team)) {
    const masteryTarget = masteryTargetId(state, teamId, actor.member.classState.className);
    if (
      actor.member.classState.source === "on-chain" &&
      !actor.masteryUsed &&
      team.clay >= masteryCost(team) &&
      (difficulty === "hard" || actor.currentHP < actor.maxHP * 0.65)
    ) {
      actions.push({ teamId, actorId: actor.member.id, type: "mastery", targetId: masteryTarget });
      continue;
    }

    if (actor.currentHP < actor.maxHP * (difficulty === "easy" ? 0.25 : 0.4)) {
      const reserve = reserveMembers(team).sort((a, b) => b.currentHP - a.currentHP)[0];
      if (reserve && team.clay >= 1) {
        actions.push({ teamId, actorId: actor.member.id, type: "substitute", reserveId: reserve.member.id });
        continue;
      }
      actions.push({ teamId, actorId: actor.member.id, type: "guard" });
      continue;
    }

    const targets = legalStrikeTargets(state, { teamId, actorId: actor.member.id });
    const target = difficulty === "easy"
      ? targets[0]
      : [...targets].sort((a, b) => a.currentHP - b.currentHP)[0];
    if (target) actions.push({ teamId, actorId: actor.member.id, type: "strike", targetId: target.member.id });
  }

  if (team.herd.isVeteranHerd && !team.teamMasteryUsed && team.clay >= 4 && state.round >= 3 && actions.length > 0) {
    actions[0] = { ...actions[0], type: "team-mastery", targetId: undefined, reserveId: undefined };
  }

  // Play one affordable card: hard AI always looks; others keep 2 Clay spare.
  if (difficulty !== "easy") {
    const anchor = activeMembers(team)[0];
    for (const card of team.hand) {
      if (difficulty !== "hard" && team.clay < card.clayCost + 2) continue;
      const play: PlannedAction = { teamId, actorId: anchor?.member.id ?? "", type: "play-card", cardId: card.id };
      if (isActionLegal(state, play)) {
        actions.push(play);
        break;
      }
    }
  }
  return actions;
}

/**
 * Ancient raid-boss planner: the solo Ancient strikes once at full strength,
 * twice below two-thirds health and three times in its final third, always
 * hunting the weakest standing targets.
 */
export function planAncientActions(state: BattleState, teamId: TeamId = "opponent"): PlannedAction[] {
  const team = state[teamId];
  const boss = activeMembers(team)[0];
  if (!boss) return [];
  const ratio = boss.currentHP / boss.maxHP;
  const strikes = ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3;
  const targets = legalStrikeTargets(state, { teamId, actorId: boss.member.id })
    .sort((a, b) => a.currentHP - b.currentHP)
    .slice(0, strikes);
  return targets.map((target) => ({
    teamId,
    actorId: boss.member.id,
    type: "strike" as const,
    targetId: target.member.id,
  }));
}

function masteryTargetId(state: BattleState, teamId: TeamId, className: string): string | undefined {
  if (className === "Mender") {
    return [...activeMembers(state[teamId])].sort(
      (a, b) => a.currentHP / a.maxHP - b.currentHP / b.maxHP
    )[0]?.member.id;
  }
  const opponentId = teamId === "player" ? "opponent" : "player";
  return [...activeMembers(state[opponentId])].sort((a, b) => a.currentHP - b.currentHP)[0]?.member.id;
}
