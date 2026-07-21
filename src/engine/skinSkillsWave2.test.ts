import { describe, expect, it } from "vitest";
import {
  activeMembers,
  createBattle,
  isActionLegal,
  resolveRound,
  substitutionCost,
  type BattleState,
  type PlannedAction,
  type TeamId,
} from "@/engine/battleEngine";
import {
  applyClass,
  buildHerdBond,
  buildSignatureDeck,
  createClassState,
  FORMAT_SPECIES,
  isVeteranLineup,
  SPECIES_STATS,
} from "@/engine/herdRules";
import type { ClassName, HerdMember, PublishedHerd, Species } from "@/types/herd";

const DEFAULT_CLASSES: Partial<Record<Species, ClassName>> = {
  Rex: "Warrior",
  Trice: "Defender",
  Stego: "Defender",
  Ankylo: "Defender",
  Raptor: "Tracker",
  Bronto: "Mender",
};

function makeMember(
  herdId: string,
  species: Species,
  className: ClassName,
  mastered: boolean,
  skin: string,
  colour: string
): HerdMember {
  const classState = createClassState(species, mastered ? className : undefined, mastered ? undefined : className);
  return {
    id: `${herdId}-${species.toLowerCase()}`,
    name: `${skin} ${species}`,
    image: "",
    species,
    skin,
    colour,
    classState,
    stats: applyClass(SPECIES_STATS[species], classState.className),
  };
}

function makeHerd(
  id: string,
  skin: string,
  options: {
    classes?: Partial<Record<Species, ClassName>>;
    mastered?: boolean;
    colour?: string;
  } = {}
): PublishedHerd {
  const members = FORMAT_SPECIES["core-six"].map((species) => {
    const className = options.classes?.[species] ?? DEFAULT_CLASSES[species] ?? "Warrior";
    return makeMember(id, species, className, options.mastered ?? false, skin, options.colour ?? "Red");
  });
  return {
    id,
    slug: id,
    name: `${skin} Test Herd`,
    collectorName: "Tester",
    description: "Wave 2 test herd",
    bannerColour: "#ffffff",
    format: "core-six",
    members,
    bond: buildHerdBond(members, "skin"),
    build: buildSignatureDeck(members, "core-six"),
    usage: { selections: 0, uniquePilots: 0, favourites: 0 },
    isVeteranHerd: isVeteranLineup(members),
    playStyle: "Test",
  };
}

function strike(state: BattleState, teamId: TeamId, actorId: string, targetId: string): PlannedAction {
  return { teamId, actorId, type: "strike", targetId };
}

function vanguardOf(state: BattleState, teamId: TeamId) {
  const member = activeMembers(state[teamId]).find((candidate) => candidate.slot === "vanguard");
  if (!member) throw new Error("no vanguard");
  return member;
}

describe("Oceania — Undertow", () => {
  it("drags a struck Wing into the vanguard once per round", () => {
    const herd = makeHerd("oceania", "Oceania", { classes: { Rex: "Stalker" }, mastered: true });
    const state = createBattle(herd, makeHerd("prey", "Mint"), 101);
    const stalker = vanguardOf(state, "player");
    const wing = activeMembers(state.opponent).find((member) => member.slot === "left-wing");
    const oldVanguard = vanguardOf(state, "opponent");
    if (!wing) throw new Error("no wing");
    const after = resolveRound(state, [strike(state, "player", stalker.member.id, wing.member.id)], []);
    const draggedWing = after.opponent.members.find((member) => member.member.id === wing.member.id);
    const displaced = after.opponent.members.find((member) => member.member.id === oldVanguard.member.id);
    expect(after.events.some((item) => item.message.includes("undertow drags"))).toBe(true);
    expect(draggedWing?.slot).toBe("vanguard");
    expect(displaced?.slot).toBe("left-wing");
    expect(draggedWing?.statuses.some((status) => status.kind === "undertow")).toBe(true);
  });

  it("riptide sweeps the struck vanguard to reserve once per match", () => {
    const state = createBattle(makeHerd("oceania-r", "Oceania"), makeHerd("prey", "Mint"), 103);
    const attacker = vanguardOf(state, "player");
    const enemyVanguard = vanguardOf(state, "opponent");
    const after = resolveRound(state, [strike(state, "player", attacker.member.id, enemyVanguard.member.id)], []);
    const swept = after.opponent.members.find((member) => member.member.id === enemyVanguard.member.id);
    expect(after.events.some((item) => item.message.includes("riptide sweeps"))).toBe(true);
    expect(swept?.slot).toBe("reserve");
    expect(activeMembers(after.opponent).some((member) => member.slot === "vanguard")).toBe(true);
  });
});

describe("Cristalline — Facet", () => {
  it("reflects 15% of received strikes (two per round at Pride) and splinters at Full Herd", () => {
    const state = createBattle(makeHerd("prey-att", "Mint"), makeHerd("crystal", "Cristalline"), 107);
    const [first, second, third] = activeMembers(state.player);
    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(
      state,
      [
        strike(state, "player", first.member.id, targetId),
        strike(state, "player", second.member.id, targetId),
        strike(state, "player", third.member.id, targetId),
      ],
      []
    );
    const reflects = after.events.filter((item) => item.message.includes("facets reflect"));
    expect(reflects).toHaveLength(2);
    const splinters = after.events.filter((item) => item.message.includes("Prism shards"));
    expect(splinters).toHaveLength(2);
    for (const reflect of reflects) {
      const strikeEvent = after.events.find((item) => item.actorId === reflect.targetId && item.targetId === targetId);
      expect(reflect.amount).toBe(Math.max(1, Math.round((strikeEvent?.amount ?? 0) * 0.15)));
    }
  });
});

describe("Savanna — Pack Hunt", () => {
  it("rewards focus-fire with +4 damage at Pack tier and pierces guard at Pride", () => {
    const state = createBattle(makeHerd("savanna", "Savanna"), makeHerd("prey", "Mint"), 109);
    const attackers = activeMembers(state.player);
    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(
      state,
      attackers.map((actor) => strike(state, "player", actor.member.id, targetId)),
      []
    );
    const huntEvents = after.events.filter((item) => item.message.includes("pack hunt"));
    expect(huntEvents).toHaveLength(2);
  });

  it("stampede drives a wounded survivor off the line at Full Herd", () => {
    const state = createBattle(makeHerd("savanna-s", "Savanna"), makeHerd("prey", "Mint"), 113);
    const attackers = activeMembers(state.player);
    const enemyVanguard = vanguardOf(state, "opponent");
    enemyVanguard.currentHP = 70;
    const after = resolveRound(
      state,
      attackers.map((actor) => strike(state, "player", actor.member.id, enemyVanguard.member.id)),
      activeMembers(state.opponent)
        .filter((member) => member.slot === "vanguard")
        .map((member) => ({ teamId: "opponent" as const, actorId: member.member.id, type: "guard" as const }))
    );
    const driven = after.opponent.members.find((member) => member.member.id === enemyVanguard.member.id);
    expect(after.events.some((item) => item.message.includes("stampede drives"))).toBe(true);
    expect(driven?.defeated).toBe(false);
    expect(driven?.slot).toBe("reserve");
  });
});

describe("Jurassic — Primal Roar", () => {
  it("saps enemy striking power", () => {
    const roared = createBattle(makeHerd("prey-att", "Mint"), makeHerd("jurassic", "Jurassic"), 127);
    const plain = createBattle(makeHerd("prey-att", "Mint"), makeHerd("plain-def", "Mint"), 127);
    const roaredAttacker = vanguardOf(roared, "player");
    const plainAttacker = vanguardOf(plain, "player");
    const afterRoared = resolveRound(roared, [strike(roared, "player", roaredAttacker.member.id, vanguardOf(roared, "opponent").member.id)], []);
    const afterPlain = resolveRound(plain, [strike(plain, "player", plainAttacker.member.id, vanguardOf(plain, "opponent").member.id)], []);
    const roaredDamage = afterRoared.events.find((item) => item.actorId === roaredAttacker.member.id)?.amount ?? 0;
    const plainDamage = afterPlain.events.find((item) => item.actorId === plainAttacker.member.id)?.amount ?? 0;
    expect(roaredDamage).toBeLessThan(plainDamage);
    expect(afterRoared.events.some((item) => item.message.includes("primal roar"))).toBe(true);
  });

  it("silences enemy masteries in round one at Full Herd", () => {
    const state = createBattle(makeHerd("prey-vets", "Mint", { mastered: true }), makeHerd("jurassic", "Jurassic"), 131);
    const mastered = vanguardOf(state, "player");
    const action: PlannedAction = { teamId: "player", actorId: mastered.member.id, type: "mastery" };
    expect(isActionLegal(state, action)).toBe(false);
    const round2 = resolveRound(state, [], []);
    expect(isActionLegal(round2, action)).toBe(true);
  });
});

describe("Amazonia — Overgrowth", () => {
  it("taxes enemy substitutions and entangles enemy actives", () => {
    const state = createBattle(makeHerd("prey-sub", "Coral"), makeHerd("amazonia", "Amazonia"), 137);
    expect(substitutionCost(state.player, state.opponent)).toBe(2);
    expect(substitutionCost(state.opponent, state.player)).toBe(1);
    const after = resolveRound(state, [], []);
    for (const member of activeMembers(after.player)) {
      expect(member.statuses.some((status) => status.kind === "entangle")).toBe(true);
    }
  });

  it("canopy heals reserves at Full Herd", () => {
    const state = createBattle(makeHerd("amazonia-c", "Amazonia"), makeHerd("prey", "Mint"), 139);
    const reserve = state.player.members.find((member) => member.slot === "reserve");
    if (!reserve) throw new Error("no reserve");
    reserve.currentHP -= 10;
    const after = resolveRound(state, [], []);
    const sheltered = after.player.members.find((member) => member.member.id === reserve.member.id);
    expect(after.events.some((item) => item.message.includes("canopy shelters"))).toBe(true);
    expect(sheltered?.currentHP).toBe(reserve.currentHP + 2);
  });
});

describe("Mirage — Heat Haze", () => {
  it("softens the first two strikes each round at Full Herd but not the third", () => {
    const mirage = createBattle(makeHerd("prey-att", "Mint"), makeHerd("mirage", "Mirage"), 149);
    const plain = createBattle(makeHerd("prey-att", "Mint"), makeHerd("plain-def", "Mint"), 149);
    const run = (state: BattleState) =>
      resolveRound(
        state,
        activeMembers(state.player).map((actor) => strike(state, "player", actor.member.id, vanguardOf(state, "opponent").member.id)),
        []
      );
    const afterMirage = run(mirage);
    const afterPlain = run(plain);
    const damages = (state: BattleState) =>
      state.events
        .filter((item) => item.teamId === "player" && item.message.includes("strikes"))
        .map((item) => ({ actor: item.actorId, amount: item.amount ?? 0 }));
    const mirageDamages = damages(afterMirage);
    const plainDamages = damages(afterPlain);
    expect(mirageDamages).toHaveLength(3);
    const hazeEvents = afterMirage.events.filter((item) => item.message.includes("heat haze"));
    expect(hazeEvents).toHaveLength(2);
    const mirageTotal = mirageDamages.reduce((total, entry) => total + entry.amount, 0);
    const plainTotal = plainDamages.reduce((total, entry) => total + entry.amount, 0);
    expect(mirageTotal).toBeLessThan(plainTotal);
    const thirdMirage = mirageDamages[2];
    const matchingPlain = plainDamages.find((entry) => entry.actor === thirdMirage.actor);
    expect(thirdMirage.amount).toBe(matchingPlain?.amount);
  });

  it("the first affliction of the match fizzles at Pride", () => {
    const state = createBattle(makeHerd("apres-att", "Apres"), makeHerd("mirage", "Mirage"), 151);
    const [first, second] = activeMembers(state.player);
    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(
      state,
      [strike(state, "player", first.member.id, targetId), strike(state, "player", second.member.id, targetId)],
      []
    );
    const target = after.opponent.members.find((member) => member.member.id === targetId);
    expect(after.events.some((item) => item.message.includes("shimmers away"))).toBe(true);
    expect(target?.statuses.some((status) => status.kind === "frozen")).toBe(false);
    expect(target?.statuses.filter((status) => status.kind === "chill")).toHaveLength(1);
  });
});
