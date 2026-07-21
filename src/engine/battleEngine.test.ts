import { describe, expect, it } from "vitest";
import {
  activeMembers,
  createBattle,
  isActionLegal,
  legalStrikeTargets,
  maxHP,
  resolveRound,
  reserveMembers,
  strikeDamage,
  type BattleState,
  type PlannedAction,
  type TeamId,
} from "@/engine/battleEngine";
import { planAIActions, type AIDifficulty } from "@/engine/aiOpponent";
import { FORMAT_ROUND_CAP } from "@/engine/herdRules";
import { SAMPLE_HERDS } from "@/data/sampleHerds";

const [HERD_A, HERD_B] = SAMPLE_HERDS;

function defaultStrikes(state: BattleState, teamId: TeamId): PlannedAction[] {
  return activeMembers(state[teamId]).map((member) => {
    const target = legalStrikeTargets(state, { teamId, actorId: member.member.id })[0];
    return target
      ? { teamId, actorId: member.member.id, type: "strike" as const, targetId: target.member.id }
      : { teamId, actorId: member.member.id, type: "guard" as const };
  });
}

function allGuard(state: BattleState, teamId: TeamId): PlannedAction[] {
  return activeMembers(state[teamId]).map((member) => ({
    teamId,
    actorId: member.member.id,
    type: "guard" as const,
  }));
}

function playOut(
  seed: number,
  plan: (state: BattleState, teamId: TeamId) => PlannedAction[]
): BattleState {
  let state = createBattle(HERD_A, HERD_B, seed);
  const cap = FORMAT_ROUND_CAP[state.player.herd.format];
  for (let safety = 0; safety < cap + 5 && !state.winner; safety += 1) {
    state = resolveRound(state, plan(state, "player"), plan(state, "opponent"));
  }
  return state;
}

describe("battle setup", () => {
  it("derives HP and strike damage from the core stats", () => {
    const member = HERD_A.members[0];
    expect(maxHP(member)).toBe(40 + member.stats.health * 10);
    expect(strikeDamage(member)).toBe(6 + member.stats.power * 2);
  });

  it("starts with a full formation, full health, 3 Clay and a 5-card hand", () => {
    const state = createBattle(HERD_A, HERD_B, 42);
    for (const team of [state.player, state.opponent]) {
      expect(activeMembers(team)).toHaveLength(3);
      expect(reserveMembers(team)).toHaveLength(team.herd.members.length - 3);
      expect(team.clay).toBe(3);
      expect(team.hand).toHaveLength(5);
      for (const member of team.members) {
        expect(member.currentHP).toBe(member.maxHP);
        expect(member.defeated).toBe(false);
      }
    }
  });
});

describe("targeting rules", () => {
  it("restricts grounded classes to the enemy vanguard", () => {
    const state = createBattle(HERD_A, HERD_B, 7);
    for (const actor of activeMembers(state.player)) {
      const targets = legalStrikeTargets(state, { teamId: "player", actorId: actor.member.id });
      const className = actor.member.classState.className;
      if (className === "Soarer" || className === "Stalker") {
        expect(targets.length).toBe(3);
      } else {
        expect(targets).toHaveLength(1);
        expect(targets[0].slot).toBe("vanguard");
      }
    }
  });

  it("rejects an illegal wing strike from a grounded class", () => {
    const state = createBattle(HERD_A, HERD_B, 7);
    const grounded = activeMembers(state.player).find((member) => {
      const className = member.member.classState.className;
      return className !== "Soarer" && className !== "Stalker";
    });
    const wing = activeMembers(state.opponent).find((member) => member.slot !== "vanguard");
    expect(grounded).toBeDefined();
    expect(wing).toBeDefined();
    if (!grounded || !wing) return;
    const action: PlannedAction = {
      teamId: "player",
      actorId: grounded.member.id,
      type: "strike",
      targetId: wing.member.id,
    };
    expect(isActionLegal(state, action)).toBe(false);
    const next = resolveRound(state, [action], []);
    const wingAfter = next.opponent.members.find((member) => member.member.id === wing.member.id);
    expect(wingAfter?.currentHP).toBe(wing.maxHP);
  });
});

describe("actions", () => {
  it("substitution costs 1 Clay and swaps the slots", () => {
    const state = createBattle(HERD_A, HERD_B, 11);
    const vanguard = activeMembers(state.player).find((member) => member.slot === "vanguard");
    const reserve = reserveMembers(state.player)[0];
    if (!vanguard || !reserve) throw new Error("missing fixture members");
    const next = resolveRound(
      state,
      [{ teamId: "player", actorId: vanguard.member.id, type: "substitute", reserveId: reserve.member.id }],
      allGuard(state, "opponent")
    );
    const movedOut = next.player.members.find((member) => member.member.id === vanguard.member.id);
    const movedIn = next.player.members.find((member) => member.member.id === reserve.member.id);
    expect(movedOut?.slot).toBe("reserve");
    expect(movedIn?.slot).toBe("vanguard");
  });

  it("refills Clay to a growing cap each round", () => {
    const state = createBattle(HERD_A, HERD_B, 11);
    const next = resolveRound(state, allGuard(state, "player"), allGuard(state, "opponent"));
    expect(next.player.maxClay).toBe(4);
    expect(next.player.clay).toBe(4);
  });
});

describe("determinism", () => {
  it("replays identically for the same seed and choices", () => {
    const first = playOut(1234, defaultStrikes);
    const second = playOut(1234, defaultStrikes);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("termination", () => {
  it("a guard-only stalemate ends at the round cap", () => {
    const state = playOut(99, allGuard);
    expect(state.phase).toBe("complete");
    expect(state.winner).not.toBeNull();
    expect(state.round).toBeLessThanOrEqual(FORMAT_ROUND_CAP[state.player.herd.format]);
  });

  it("an all-out strike battle produces a winner within the cap", () => {
    const state = playOut(555, defaultStrikes);
    expect(state.phase).toBe("complete");
    expect(["player", "opponent", "draw"]).toContain(state.winner);
  });

  it("resolveRound is a no-op after completion", () => {
    const finished = playOut(555, defaultStrikes);
    const after = resolveRound(finished, defaultStrikes(finished, "player"), []);
    expect(after).toBe(finished);
  });
});

describe("AI opponent", () => {
  const difficulties: AIDifficulty[] = ["easy", "medium", "hard"];

  it.each(difficulties)("emits only legal actions across a full %s battle", (difficulty) => {
    let state = createBattle(HERD_A, HERD_B, 2026);
    const cap = FORMAT_ROUND_CAP[state.player.herd.format];
    for (let safety = 0; safety < cap + 5 && !state.winner; safety += 1) {
      const playerActions = planAIActions(state, "player", difficulty);
      const opponentActions = planAIActions(state, "opponent", difficulty);
      for (const action of [...playerActions, ...opponentActions]) {
        expect(isActionLegal(state, action), JSON.stringify(action)).toBe(true);
      }
      state = resolveRound(state, playerActions, opponentActions);
    }
    expect(state.phase).toBe("complete");
  });

  it("plans exactly one member action per active member plus at most one card play", () => {
    const state = createBattle(HERD_A, HERD_B, 5);
    const actions = planAIActions(state, "opponent", "medium");
    const memberActions = actions.filter((action) => action.type !== "play-card");
    expect(memberActions).toHaveLength(activeMembers(state.opponent).length);
    const actors = new Set(memberActions.map((action) => action.actorId));
    expect(actors.size).toBe(memberActions.length);
    expect(actions.filter((action) => action.type === "play-card").length).toBeLessThanOrEqual(1);
  });
});
