import { activeMembers, legalStrikeTargets, masteryCost, reserveMembers } from "@/engine/battleEngine";
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
  return actions;
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
