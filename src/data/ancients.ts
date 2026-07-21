import type { PublishedHerd } from "@/types/herd";

// Ancients are PvE raid bosses: one boosted solo fighter against a full herd.
// The boosted statline is the single sanctioned budget exception, PvE-only.

export interface AncientDefinition {
  id: string;
  name: string;
  title: string;
  unlockLevel: number;
  lore: string;
  herd: PublishedHerd;
}

function ancientHerd(): PublishedHerd {
  const member = {
    id: "ancient-rex-prime",
    name: "The Primal Rex",
    image: "",
    species: "Rex" as const,
    skin: "Jurassic",
    colour: "Volcanic",
    classState: {
      source: "on-chain" as const,
      className: "Stalker" as const,
      metadataSnapshotVersion: "herd-alpha-1" as const,
      masteryCardId: "mastery-stalker",
    },
    stats: { health: 10, power: 10, guard: 7, speed: 8 },
    ancient: {
      title: "First of the Old Clay",
      maxHP: 450,
      strikeDamage: 26,
    },
  };
  return {
    id: "ancient-encounter-primal-rex",
    slug: "ancient-primal-rex",
    name: "The Primal Rex",
    collectorName: "The Old Clay",
    description: "An Ancient that fights alone, and has never needed help.",
    bannerColour: "#f97316",
    format: "core-six",
    members: [member],
    bond: {
      kind: "skin",
      value: "Jurassic",
      name: "Ancient Presence",
      benefit: "Grows more ferocious as it is wounded: one strike above two-thirds health, two below, three in its final third.",
      limitation: "It is still one body: statuses, freezes and venom all bite.",
    },
    build: {
      id: "ancient-primal-rex-build",
      version: 1,
      format: "core-six",
      startingFormation: { vanguard: "ancient-rex-prime", "left-wing": "", "right-wing": "" },
      deck: [
        {
          id: "ancient-fury",
          name: "Ancient Fury",
          description: "The Old Clay does not tire.",
          kind: "signature",
          clayCost: 0,
          ownerMemberId: "ancient-rex-prime",
          copies: 40,
        },
      ],
      publishedAt: new Date(0).toISOString(),
    },
    usage: { selections: 0, uniquePilots: 0, favourites: 0 },
    isVeteranHerd: false,
    playStyle: "Multi-phase raid boss",
  };
}

export const ANCIENTS: AncientDefinition[] = [
  {
    id: "primal-rex",
    name: "The Primal Rex",
    title: "First of the Old Clay",
    unlockLevel: 3,
    lore: "Before the herds, before the classes, there was one Rex shaped from the first clay. It remembers when the whole valley ran from a single roar — and it would like to remind everyone.",
    herd: ancientHerd(),
  },
];
