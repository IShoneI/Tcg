import { describe, expect, it } from "vitest";
import {
  activeMembers,
  createBattle,
  resolveRound,
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
import type { ClassName, HerdMember, PublishedHerd, Species, TacticCard } from "@/types/herd";

const DEFAULT_CLASSES: Partial<Record<Species, ClassName>> = {
  Rex: "Warrior",
  Trice: "Defender",
  Stego: "Defender",
  Ankylo: "Defender",
  Raptor: "Tracker",
  Bronto: "Mender",
};

function makeHerd(id: string, options: { mastered?: boolean } = {}): PublishedHerd {
  const members: HerdMember[] = FORMAT_SPECIES["core-six"].map((species) => {
    const className = DEFAULT_CLASSES[species] ?? "Warrior";
    const classState = createClassState(species, options.mastered ? className : undefined, options.mastered ? undefined : className);
    return {
      id: `${id}-${species.toLowerCase()}`,
      name: `${species} of ${id}`,
      image: "",
      species,
      skin: "Mint",
      colour: "Red",
      classState,
      stats: applyClass(SPECIES_STATS[species], classState.className),
    };
  });
  return {
    id,
    slug: id,
    name: `${id} herd`,
    collectorName: "Tester",
    description: "Card play test herd",
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

function card(overrides: Partial<TacticCard> & Pick<TacticCard, "id" | "name" | "kind">): TacticCard {
  return { description: "", clayCost: 1, ...overrides };
}

function strike(teamId: TeamId, actorId: string, targetId: string): PlannedAction {
  return { teamId, actorId, type: "strike", targetId };
}

function play(teamId: TeamId, actorId: string, cardId: string): PlannedAction {
  return { teamId, actorId, type: "play-card", cardId };
}

function vanguardOf(state: BattleState, teamId: TeamId) {
  const member = activeMembers(state[teamId]).find((candidate) => candidate.slot === "vanguard");
  if (!member) throw new Error("no vanguard");
  return member;
}

describe("playing tactic cards", () => {
  it("Warrior Instinct adds +4 to the owner's strike and costs its Clay", () => {
    const seed = 201;
    const plain = createBattle(makeHerd("attacker"), makeHerd("defender"), seed);
    const carded = createBattle(makeHerd("attacker"), makeHerd("defender"), seed);
    const rex = vanguardOf(carded, "player");
    carded.player.hand = [card({ id: "test-warrior", name: "Rex Instinct", kind: "signature", ownerMemberId: rex.member.id, className: "Warrior" })];

    const targetId = vanguardOf(plain, "opponent").member.id;
    const afterPlain = resolveRound(plain, [strike("player", rex.member.id, targetId)], []);
    const afterCarded = resolveRound(
      carded,
      [play("player", rex.member.id, "test-warrior"), strike("player", rex.member.id, targetId)],
      []
    );
    const plainDamage = afterPlain.events.find((item) => item.actorId === rex.member.id)?.amount ?? 0;
    const cardedDamage = afterCarded.events.find((item) => item.actorId === rex.member.id && item.amount)?.amount ?? 0;
    expect(cardedDamage).toBe(plainDamage + 4);
    expect(afterCarded.player.discard.some((item) => item.id === "test-warrior")).toBe(true);
    expect(afterCarded.events.some((item) => item.message.includes("plays Rex Instinct"))).toBe(true);
  });

  it("only one card resolves per team per round", () => {
    const state = createBattle(makeHerd("attacker"), makeHerd("defender"), 203);
    const rex = vanguardOf(state, "player");
    state.player.hand = [
      card({ id: "first", name: "First", kind: "signature", ownerMemberId: rex.member.id, className: "Warrior" }),
      card({ id: "second", name: "Second", kind: "signature", ownerMemberId: rex.member.id, className: "Warrior" }),
    ];
    const after = resolveRound(
      state,
      [play("player", rex.member.id, "first"), play("player", rex.member.id, "second")],
      []
    );
    expect(after.player.discard.map((item) => item.id)).toEqual(["first"]);
    expect(after.player.hand.map((item) => item.id)).toContain("second");
  });

  it("a mastery card channels the mastery without spending the member's action", () => {
    const state = createBattle(makeHerd("vets", { mastered: true }), makeHerd("defender"), 207);
    const trice = activeMembers(state.player).find((member) => member.member.classState.className === "Defender" && member.slot !== "vanguard");
    const anchor = vanguardOf(state, "player");
    if (!trice) throw new Error("no defender");
    state.player.hand = [card({ id: "trice-mastery", name: "Hold the Line", kind: "mastery", clayCost: 2, ownerMemberId: trice.member.id, className: "Defender" })];

    const targetId = vanguardOf(state, "opponent").member.id;
    const after = resolveRound(
      state,
      [play("player", anchor.member.id, "trice-mastery"), strike("player", anchor.member.id, targetId)],
      []
    );
    const triceAfter = after.player.members.find((member) => member.member.id === trice.member.id);
    expect(triceAfter?.masteryUsed).toBe(true);
    expect(after.events.some((item) => item.message.includes("holds the line"))).toBe(true);
    expect(after.events.some((item) => item.actorId === anchor.member.id && item.amount)).toBe(true);
  });

  it("Tracker Instinct draws a card", () => {
    const state = createBattle(makeHerd("attacker"), makeHerd("defender"), 211);
    const anchor = vanguardOf(state, "player");
    const raptor = state.player.members.find((member) => member.member.classState.className === "Tracker");
    if (!raptor) throw new Error("no tracker");
    state.player.hand = [card({ id: "scout", name: "Raptor Instinct", kind: "signature", ownerMemberId: raptor.member.id, className: "Tracker" })];
    const deckBefore = state.player.deck.length;
    const after = resolveRound(state, [play("player", anchor.member.id, "scout")], []);
    expect(after.events.some((item) => item.message.includes("scouts ahead"))).toBe(true);
    expect(after.player.deck.length).toBe(deckBefore - 2);
  });

  it("Mystic Instinct exposes the weakest enemy to extra damage", () => {
    const seed = 213;
    const plain = createBattle(makeHerd("attacker"), makeHerd("defender"), seed);
    const carded = createBattle(makeHerd("attacker"), makeHerd("defender"), seed);
    const rex = vanguardOf(carded, "player");
    const stego = carded.player.members.find((member) => member.member.species === "Stego");
    if (!stego) throw new Error("no stego");
    carded.player.hand = [card({ id: "expose", name: "Mystic Instinct", kind: "signature", ownerMemberId: stego.member.id, className: "Mystic" })];

    const targetId = vanguardOf(plain, "opponent").member.id;
    const afterPlain = resolveRound(plain, [strike("player", rex.member.id, targetId)], []);
    const afterCarded = resolveRound(
      carded,
      [{ ...play("player", rex.member.id, "expose"), targetId }, strike("player", rex.member.id, targetId)],
      []
    );
    const plainDamage = afterPlain.events.find((item) => item.actorId === rex.member.id)?.amount ?? 0;
    const cardedDamage = afterCarded.events.find((item) => item.actorId === rex.member.id && item.amount)?.amount ?? 0;
    expect(cardedDamage).toBeGreaterThan(plainDamage);
  });
});
