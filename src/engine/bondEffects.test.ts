import { describe, expect, it } from "vitest";
import {
  activeMembers,
  createBattle,
  masteryCost,
  resolveRound,
  substitutionCost,
  teamCompositionOf,
  type BattleState,
  type PlannedAction,
  type TeamId,
} from "@/engine/battleEngine";
import { skinTier } from "@/engine/herdComposition";
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

function makeMember(
  herdId: string,
  species: Species,
  className: ClassName,
  mastered: boolean,
  skin: string,
  colour = "Red"
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

const DEFAULT_CLASSES: Partial<Record<Species, ClassName>> = {
  Rex: "Warrior",
  Trice: "Defender",
  Stego: "Defender",
  Ankylo: "Defender",
  Raptor: "Tracker",
  Bronto: "Mender",
};

function makeHerd(
  id: string,
  skin: string,
  options: {
    classes?: Partial<Record<Species, ClassName>>;
    mastered?: boolean;
    skins?: string[];
    colour?: string;
  } = {}
): PublishedHerd {
  const members = FORMAT_SPECIES["core-six"].map((species, index) => {
    const className = options.classes?.[species] ?? DEFAULT_CLASSES[species] ?? "Warrior";
    return makeMember(id, species, className, options.mastered ?? false, options.skins?.[index] ?? skin, options.colour ?? "Red");
  });
  return {
    id,
    slug: id,
    name: `${skin} Test Herd`,
    collectorName: "Tester",
    description: "Bond test herd",
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

describe("Apres bond (freeze)", () => {
  it("chills on strike and freezes on the second chill, cancelling the next action", () => {
    const state = createBattle(makeHerd("apres", "Apres"), makeHerd("prey", "Mint"), 3);
    const [first, second] = activeMembers(state.player);
    const targetId = vanguardOf(state, "opponent").member.id;

    const afterRound1 = resolveRound(
      state,
      [strike(state, "player", first.member.id, targetId), strike(state, "player", second.member.id, targetId)],
      []
    );
    const target = afterRound1.opponent.members.find((member) => member.member.id === targetId);
    expect(target?.statuses.some((status) => status.kind === "frozen")).toBe(true);

    const hpBefore = vanguardOf(afterRound1, "player").currentHP;
    const afterRound2 = resolveRound(
      afterRound1,
      [],
      [strike(afterRound1, "opponent", targetId, vanguardOf(afterRound1, "player").member.id)]
    );
    expect(vanguardOf(afterRound2, "player").currentHP).toBe(hpBefore);
    expect(afterRound2.events.some((item) => item.message.includes("frozen solid and cannot act"))).toBe(true);
    const thawed = afterRound2.opponent.members.find((member) => member.member.id === targetId);
    expect(thawed?.statuses.some((status) => status.kind === "frozen")).toBe(false);
  });
});

describe("Toxic bond (venom)", () => {
  it("envenoms on strike and burns 4 guard-ignoring damage at end of round for 2 rounds", () => {
    const state = createBattle(makeHerd("toxic", "Toxic"), makeHerd("prey", "Mint"), 5);
    const attacker = vanguardOf(state, "player");
    const targetId = vanguardOf(state, "opponent").member.id;

    const afterRound1 = resolveRound(state, [strike(state, "player", attacker.member.id, targetId)], []);
    const strikeEvent = afterRound1.events.find((item) => item.actorId === attacker.member.id && item.targetId === targetId);
    const target1 = afterRound1.opponent.members.find((member) => member.member.id === targetId);
    expect(target1?.statuses.some((status) => status.kind === "venom")).toBe(true);
    expect(target1?.currentHP).toBe((target1?.maxHP ?? 0) - (strikeEvent?.amount ?? 0) - 4);

    const afterRound2 = resolveRound(afterRound1, [], []);
    const target2 = afterRound2.opponent.members.find((member) => member.member.id === targetId);
    expect(target2?.currentHP).toBe((target1?.currentHP ?? 0) - 4);
    expect(target2?.statuses.some((status) => status.kind === "venom")).toBe(false);
  });

  it("reduces Mender mastery healing by 20%", () => {
    const herd = makeHerd("toxic-vet", "Toxic", { classes: { Trice: "Mender" }, mastered: true });
    const state = createBattle(herd, makeHerd("prey", "Mint"), 5);
    const mender = activeMembers(state.player).find((member) => member.member.classState.className === "Mender");
    if (!mender) throw new Error("no active mender");
    mender.currentHP -= 30;
    const after = resolveRound(
      state,
      [{ teamId: "player", actorId: mender.member.id, type: "mastery", targetId: mender.member.id }],
      []
    );
    const healEvent = after.events.find((item) => item.message.includes("Second Wind"));
    expect(healEvent?.amount).toBe(Math.floor(24 * 0.8));
  });
});

describe("Elektra bond (chain lightning)", () => {
  it("at Full Herd arcs 5 into two extra enemies once per round and drains enemy Clay", () => {
    const state = createBattle(makeHerd("elektra", "Elektra"), makeHerd("prey", "Mint"), 9);
    const [first, second] = activeMembers(state.player);
    const targetId = vanguardOf(state, "opponent").member.id;

    const after = resolveRound(
      state,
      [strike(state, "player", first.member.id, targetId), strike(state, "player", second.member.id, targetId)],
      []
    );
    const arcEvents = after.events.filter((item) => item.message.includes("Lightning arcs"));
    expect(arcEvents).toHaveLength(2);
    for (const arc of arcEvents) {
      expect(arc.amount).toBe(5);
      expect(arc.targetId).not.toBe(targetId);
    }
    expect(new Set(arcEvents.map((item) => item.targetId)).size).toBe(2);
    expect(after.events.some((item) => item.message.includes("overload drains"))).toBe(true);
  });

  it("at Solo arcs only 3", () => {
    const state = createBattle(
      makeHerd("solo-elektra", "Elektra", { skins: ["Elektra", "Mirage", "Jurassic", "Savanna", "Oceania", "Amazonia"] }),
      makeHerd("prey", "Mint"),
      9
    );
    const elektra = vanguardOf(state, "player");
    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(state, [strike(state, "player", elektra.member.id, targetId)], []);
    const arcEvents = after.events.filter((item) => item.message.includes("Lightning arcs"));
    expect(arcEvents).toHaveLength(1);
    expect(arcEvents[0].amount).toBe(3);
  });
});

describe("Coral bond (tides)", () => {
  it("at Full Herd restores 4 health to damaged active dinos at the end of the round", () => {
    const state = createBattle(makeHerd("coral", "Coral"), makeHerd("prey", "Mint"), 13);
    const enemyVanguard = vanguardOf(state, "opponent");
    const coralVanguard = vanguardOf(state, "player");

    const after = resolveRound(state, [], [strike(state, "opponent", enemyVanguard.member.id, coralVanguard.member.id)]);
    const strikeEvent = after.events.find((item) => item.actorId === enemyVanguard.member.id);
    const healed = after.player.members.find((member) => member.member.id === coralVanguard.member.id);
    expect(after.events.some((item) => item.message.includes("tide restores"))).toBe(true);
    expect(healed?.currentHP).toBe((healed?.maxHP ?? 0) - (strikeEvent?.amount ?? 0) + 4);
  });
});

describe("default bond", () => {
  it("grants one free substitution per match", () => {
    const state = createBattle(makeHerd("plain", "Mint"), makeHerd("prey", "Sands"), 17);
    expect(substitutionCost(state.player)).toBe(0);
    const vanguard = vanguardOf(state, "player");
    const reserve = state.player.members.find((member) => member.slot === "reserve");
    if (!reserve) throw new Error("no reserve");
    const after = resolveRound(
      state,
      [{ teamId: "player", actorId: vanguard.member.id, type: "substitute", reserveId: reserve.member.id }],
      []
    );
    expect(after.player.clay).toBe(4);
    expect(after.player.freeSubstitutionUsed).toBe(true);
    expect(substitutionCost(after.player)).toBe(1);
  });

  it("solo Toxic venom is weaker: 2 damage for 1 round", () => {
    const state = createBattle(
      makeHerd("solo-toxic", "Toxic", { skins: ["Toxic", "Mirage", "Jurassic", "Savanna", "Oceania", "Amazonia"] }),
      makeHerd("prey", "Mint"),
      41
    );
    const attacker = vanguardOf(state, "player");
    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(state, [strike(state, "player", attacker.member.id, targetId)], []);
    const strikeEvent = after.events.find((item) => item.actorId === attacker.member.id && item.targetId === targetId);
    const target = after.opponent.members.find((member) => member.member.id === targetId);
    expect(target?.currentHP).toBe((target?.maxHP ?? 0) - (strikeEvent?.amount ?? 0) - 2);
    expect(target?.statuses.some((status) => status.kind === "venom")).toBe(false);
  });

  it("skin-specific effects do not apply to colour bonds", () => {
    const members = FORMAT_SPECIES["core-six"].map((species) =>
      makeMember("colour-herd", species, createClassState(species).className, false, `Skin${species}`)
    );
    const herd: PublishedHerd = {
      ...makeHerd("colour-herd-base", "Mint"),
      id: "colour-herd",
      members,
      bond: buildHerdBond(members, "colour"),
      build: buildSignatureDeck(members, "core-six"),
    };
    const state = createBattle(herd, makeHerd("prey", "Sands"), 21);
    expect(substitutionCost(state.player)).toBe(0);
  });
});

describe("dynamic companion tiers", () => {
  it("drop as dinos fall", () => {
    const state = createBattle(makeHerd("apres", "Apres"), makeHerd("prey", "Mint"), 3);
    expect(skinTier(teamCompositionOf(state.player), "Apres")).toBe("full");
    state.player.members[4].defeated = true;
    state.player.members[5].defeated = true;
    expect(skinTier(teamCompositionOf(state.player), "Apres")).toBe("pride");
    state.player.members[3].defeated = true;
    expect(skinTier(teamCompositionOf(state.player), "Apres")).toBe("pack");
    state.player.members[2].defeated = true;
    state.player.members[1].defeated = true;
    expect(skinTier(teamCompositionOf(state.player), "Apres")).toBe("solo");
  });
});

describe("Color Boosts", () => {
  it("Charcoal cinder hide takes a flat 4 off strikes at Full Herd", () => {
    const plain = createBattle(makeHerd("prey", "Mint"), makeHerd("plain-def", "Mint"), 55);
    const charcoal = createBattle(makeHerd("prey", "Mint"), makeHerd("char-def", "Mint", { colour: "Charcoal" }), 55);
    const plainAttacker = vanguardOf(plain, "player");
    const plainTarget = vanguardOf(plain, "opponent").member.id;
    const afterPlain = resolveRound(plain, [strike(plain, "player", plainAttacker.member.id, plainTarget)], []);
    const charAttacker = vanguardOf(charcoal, "player");
    const charTarget = vanguardOf(charcoal, "opponent").member.id;
    const afterChar = resolveRound(charcoal, [strike(charcoal, "player", charAttacker.member.id, charTarget)], []);
    const plainDamage = afterPlain.events.find((item) => item.actorId === plainAttacker.member.id)?.amount ?? 0;
    const charDamage = afterChar.events.find((item) => item.actorId === charAttacker.member.id)?.amount ?? 0;
    expect(charDamage).toBe(plainDamage - 4);
  });

  it("Spring renewal restores 3 to damaged actives at Full Herd", () => {
    const state = createBattle(makeHerd("spring-def", "Mint", { colour: "Spring" }), makeHerd("prey", "Mint"), 61);
    const enemyVanguard = vanguardOf(state, "opponent");
    const target = vanguardOf(state, "player");
    const after = resolveRound(state, [], [strike(state, "opponent", enemyVanguard.member.id, target.member.id)]);
    const strikeEvent = after.events.find((item) => item.actorId === enemyVanguard.member.id);
    const healed = after.player.members.find((member) => member.member.id === target.member.id);
    expect(after.events.some((item) => item.message.includes("Spring renewal"))).toBe(true);
    expect(healed?.currentHP).toBe((healed?.maxHP ?? 0) - (strikeEvent?.amount ?? 0) + 3);
  });

  it("Amethyst focus reduces the mastery cost to 1", () => {
    const state = createBattle(
      makeHerd("amethyst-vets", "Mint", { colour: "Amethyst", mastered: true }),
      makeHerd("prey", "Mint"),
      67
    );
    expect(masteryCost(state.player)).toBe(1);
    expect(masteryCost(state.opponent)).toBe(2);
  });

  it("Tropic sunburst grants an opening Clay and an extra starting card", () => {
    const state = createBattle(makeHerd("tropic", "Mint", { colour: "Tropic" }), makeHerd("prey", "Mint"), 71);
    expect(state.player.clay).toBe(4);
    expect(state.player.hand).toHaveLength(6);
    expect(state.opponent.clay).toBe(3);
    expect(state.opponent.hand).toHaveLength(5);
  });

  it("Volcanic fury survives one lethal blow at Full Herd", () => {
    const state = createBattle(makeHerd("volcanic-def", "Mint", { colour: "Volcanic" }), makeHerd("prey", "Mint"), 77);
    const enemyVanguard = vanguardOf(state, "opponent");
    const target = vanguardOf(state, "player");
    target.currentHP = 3;
    const after = resolveRound(state, [], [strike(state, "opponent", enemyVanguard.member.id, target.member.id)]);
    const survivor = after.player.members.find((member) => member.member.id === target.member.id);
    expect(after.events.some((item) => item.message.includes("refuses to fall"))).toBe(true);
    expect(survivor?.defeated).toBe(false);
    expect(survivor?.currentHP).toBeGreaterThanOrEqual(1);
  });
});
