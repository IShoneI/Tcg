import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  levelForXP,
  progressWithinLevel,
  recordAncientDefeat,
  recordBattle,
  recordPublish,
  XP_RULES,
  xpForLevel,
} from "@/engine/progression";
import {
  activeMembers,
  createBattle,
  maxHP,
  resolveRound,
  strikeDamage,
  type BattleState,
} from "@/engine/battleEngine";
import { planAIActions, planAncientActions } from "@/engine/aiOpponent";
import { FORMAT_ROUND_CAP } from "@/engine/herdRules";
import { ANCIENTS } from "@/data/ancients";
import { SAMPLE_HERDS } from "@/data/sampleHerds";

describe("collector level curve", () => {
  it("levels are monotonic and start at 1", () => {
    expect(levelForXP(0)).toBe(1);
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXP(xpForLevel(3))).toBe(3);
    expect(levelForXP(xpForLevel(3) - 1)).toBe(2);
    for (let level = 1; level < 10; level += 1) {
      expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
    }
  });

  it("reports progress within the current level", () => {
    const { level, current, needed } = progressWithinLevel(xpForLevel(2) + 10);
    expect(level).toBe(2);
    expect(current).toBe(10);
    expect(needed).toBe(xpForLevel(3) - xpForLevel(2));
  });
});

describe("XP awards", () => {
  it("pays battles, wins, publishes and ancient defeats", () => {
    let progress = recordBattle(EMPTY_PROGRESS, true);
    expect(progress.xp).toBe(XP_RULES.battlePlayed + XP_RULES.battleWon);
    progress = recordBattle(progress, false);
    expect(progress.battles).toBe(2);
    expect(progress.wins).toBe(1);
    progress = recordPublish(progress, "herd-1");
    progress = recordPublish(progress, "herd-1");
    expect(progress.xp).toBe(2 * XP_RULES.battlePlayed + XP_RULES.battleWon + XP_RULES.herdPublished);
    progress = recordAncientDefeat(progress, "primal-rex");
    progress = recordAncientDefeat(progress, "primal-rex");
    expect(progress.defeatedAncientIds).toEqual(["primal-rex"]);
    expect(progress.xp).toBe(2 * XP_RULES.battlePlayed + XP_RULES.battleWon + XP_RULES.herdPublished + XP_RULES.ancientDefeated);
  });
});

describe("the Primal Rex encounter", () => {
  const ancient = ANCIENTS[0];

  it("fields a solo boss with the boosted PvE statline", () => {
    const boss = ancient.herd.members[0];
    expect(ancient.herd.members).toHaveLength(1);
    expect(maxHP(boss)).toBe(450);
    expect(strikeDamage(boss)).toBe(26);
    const state = createBattle(SAMPLE_HERDS[0], ancient.herd, 7);
    expect(activeMembers(state.opponent)).toHaveLength(1);
    expect(activeMembers(state.opponent)[0].currentHP).toBe(450);
  });

  it("escalates from one strike to three as it is wounded", () => {
    const state = createBattle(SAMPLE_HERDS[0], ancient.herd, 7);
    expect(planAncientActions(state)).toHaveLength(1);
    const boss = activeMembers(state.opponent)[0];
    boss.currentHP = Math.floor(boss.maxHP * 0.5);
    expect(planAncientActions(state)).toHaveLength(2);
    boss.currentHP = Math.floor(boss.maxHP * 0.2);
    expect(planAncientActions(state)).toHaveLength(3);
  });

  it("cannot be out-waited: the Ancient wins the round cap", () => {
    let state: BattleState = createBattle(SAMPLE_HERDS[0], ancient.herd, 11);
    const cap = FORMAT_ROUND_CAP[state.player.herd.format];
    for (let safety = 0; safety < cap + 5 && !state.winner; safety += 1) {
      const guards = activeMembers(state.player).map((member) => ({
        teamId: "player" as const,
        actorId: member.member.id,
        type: "guard" as const,
      }));
      state = resolveRound(state, guards, planAncientActions(state));
    }
    expect(state.phase).toBe("complete");
    expect(state.winner).toBe("opponent");
  });

  it("a full herd fighting back completes the encounter within the cap", () => {
    let state: BattleState = createBattle(SAMPLE_HERDS[0], ancient.herd, 13);
    const cap = FORMAT_ROUND_CAP[state.player.herd.format];
    for (let safety = 0; safety < cap + 5 && !state.winner; safety += 1) {
      state = resolveRound(state, planAIActions(state, "player", "hard"), planAncientActions(state));
    }
    expect(state.phase).toBe("complete");
    expect(["player", "opponent"]).toContain(state.winner);
  });
});
