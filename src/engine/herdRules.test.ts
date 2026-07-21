import { describe, expect, it } from "vitest";
import {
  applyClass,
  buildHerdBond,
  buildSignatureDeck,
  createClassState,
  createMasteryCard,
  FORMAT_SPECIES,
  isVeteranLineup,
  PROVISIONAL_CLASSES,
  SPECIES_STATS,
  STAT_BUDGET,
  statTotal,
  TEAM_MASTERY_CARD,
  traitSurprise,
  traitTier,
  validateHerd,
} from "@/engine/herdRules";
import { SAMPLE_HERDS } from "@/data/sampleHerds";
import type { ClassName, HerdMember, PublishedHerd, Species } from "@/types/herd";

const ALL_SPECIES = FORMAT_SPECIES["complete-nine"];
const ALL_CLASSES: ClassName[] = [
  "Defender",
  "Warrior",
  "Mender",
  "Tracker",
  "Stalker",
  "Mystic",
  "Soarer",
];

function makeMember(species: Species, className: ClassName, mastered: boolean): HerdMember {
  const classState = createClassState(species, mastered ? className : undefined, className);
  return {
    id: `test-${species.toLowerCase()}`,
    name: `Test ${species}`,
    image: "",
    species,
    skin: "Coral",
    colour: "Red",
    classState,
    stats: applyClass(SPECIES_STATS[species], classState.className),
  };
}

function makeCoreSix(masteredCount: number): HerdMember[] {
  return FORMAT_SPECIES["core-six"].map((species, index) =>
    makeMember(species, PROVISIONAL_CLASSES[species][0], index < masteredCount)
  );
}

function makeHerd(masteredCount: number): PublishedHerd {
  const members = makeCoreSix(masteredCount);
  return {
    id: "test-herd",
    slug: "test-herd",
    name: "Test Herd",
    collectorName: "Tester",
    description: "Test herd",
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

describe("stat budget invariant", () => {
  it("gives every base species exactly the shared budget", () => {
    for (const species of ALL_SPECIES) {
      expect(statTotal(SPECIES_STATS[species]), species).toBe(STAT_BUDGET);
    }
  });

  it("preserves the budget and stat bounds for every species/class pair", () => {
    for (const species of ALL_SPECIES) {
      for (const className of ALL_CLASSES) {
        const stats = applyClass(SPECIES_STATS[species], className);
        expect(statTotal(stats), `${species}/${className}`).toBe(STAT_BUDGET);
        for (const value of Object.values(stats)) {
          expect(value).toBeGreaterThanOrEqual(2);
          expect(value).toBeLessThanOrEqual(10);
        }
      }
    }
  });
});

describe("createClassState", () => {
  it("recognises an on-chain class regardless of case and spacing", () => {
    const state = createClassState("Rex", "  wArRiOr ");
    expect(state.source).toBe("on-chain");
    expect(state.className).toBe("Warrior");
    expect(state.masteryCardId).toBe("mastery-warrior");
  });

  it("falls back to the first provisional class without an on-chain class", () => {
    const state = createClassState("Raptor");
    expect(state.source).toBe("provisional");
    expect(state.className).toBe(PROVISIONAL_CLASSES.Raptor[0]);
    expect(state.masteryCardId).toBeUndefined();
  });

  it("honours an explicit provisional choice and rejects illegal ones", () => {
    expect(createClassState("Trice", undefined, "Mystic").className).toBe("Mystic");
    expect(() => createClassState("Trice", undefined, "Soarer")).toThrow();
  });
});

describe("mastery cards", () => {
  it("issues a Mastery card only to on-chain classed members", () => {
    const mastered = makeMember("Rex", "Warrior", true);
    const provisional = makeMember("Rex", "Warrior", false);
    expect(createMasteryCard(mastered)?.kind).toBe("mastery");
    expect(createMasteryCard(mastered)?.ownerMemberId).toBe(mastered.id);
    expect(createMasteryCard(provisional)).toBeNull();
  });
});

describe("buildSignatureDeck", () => {
  it("builds a legal deck for a fully provisional lineup", () => {
    const members = makeCoreSix(0);
    const build = buildSignatureDeck(members, "core-six");
    const size = build.deck.reduce((total, card) => total + (card.copies ?? 1), 0);
    expect(size).toBe(members.length * 3);
    expect(build.deck.some((card) => card.kind === "mastery")).toBe(false);
    expect(build.deck.some((card) => card.id === TEAM_MASTERY_CARD.id)).toBe(false);
  });

  it("adds member masteries and Call of the Veterans for a veteran lineup", () => {
    const members = makeCoreSix(6);
    const build = buildSignatureDeck(members, "core-six");
    const size = build.deck.reduce((total, card) => total + (card.copies ?? 1), 0);
    expect(size).toBe(members.length * 3);
    expect(build.deck.filter((card) => card.kind === "mastery")).toHaveLength(6);
    expect(build.deck.some((card) => card.id === TEAM_MASTERY_CARD.id)).toBe(true);
  });
});

describe("validateHerd", () => {
  it("accepts every sample herd", () => {
    for (const herd of SAMPLE_HERDS) {
      expect(validateHerd(herd), herd.id).toEqual([]);
    }
  });

  it("accepts generated veteran and provisional herds", () => {
    expect(validateHerd(makeHerd(0))).toEqual([]);
    expect(validateHerd(makeHerd(6))).toEqual([]);
  });

  it("rejects a duplicate species lineup", () => {
    const herd = makeHerd(0);
    herd.members[1] = { ...herd.members[0], id: "duplicate-rex" };
    expect(validateHerd(herd).length).toBeGreaterThan(0);
  });

  it("rejects a wrong deck size", () => {
    const herd = makeHerd(0);
    herd.build = { ...herd.build, deck: herd.build.deck.slice(1) };
    expect(validateHerd(herd).some((error) => error.includes("signature deck"))).toBe(true);
  });

  it("rejects a veteran flag that contradicts the lineup", () => {
    const herd = makeHerd(0);
    herd.isVeteranHerd = true;
    expect(validateHerd(herd).some((error) => error.includes("Veteran"))).toBe(true);
  });
});

describe("herd bonds", () => {
  it("requires every member to share the bonded trait", () => {
    const members = makeCoreSix(0);
    expect(buildHerdBond(members, "skin").value).toBe("Coral");
    members[2] = { ...members[2], skin: "Toxic" };
    expect(() => buildHerdBond(members, "skin")).toThrow();
  });
});

describe("trait rarity", () => {
  it("maps frequency to tiers at the documented boundaries", () => {
    expect(traitTier(0.005)).toBe("mythic");
    expect(traitTier(0.02)).toBe("epic");
    expect(traitTier(0.05)).toBe("rare");
    expect(traitTier(0.1)).toBe("uncommon");
    expect(traitTier(0.2)).toBe("common");
  });

  it("bounds surprise and rejects impossible frequencies", () => {
    expect(traitSurprise(0.5)).toBeCloseTo(1);
    expect(traitSurprise(0.000001)).toBeCloseTo(6.64);
    expect(() => traitSurprise(0)).toThrow();
    expect(() => traitSurprise(1.5)).toThrow();
    expect(() => traitSurprise(Number.NaN)).toThrow();
  });
});
