import type {
  ClassName,
  ClassState,
  CoreStats,
  HerdBond,
  HerdFormat,
  HerdMember,
  PublishedHerd,
  SignatureBuild,
  Species,
  TacticCard,
  TraitTier,
} from "@/types/herd";

export const RULES_VERSION = "herd-alpha-1";
export const STAT_BUDGET = 24;

export const FORMAT_SPECIES: Record<HerdFormat, Species[]> = {
  "core-six": ["Rex", "Trice", "Stego", "Ankylo", "Raptor", "Bronto"],
  "genesis-seven": ["Rex", "Trice", "Stego", "Ankylo", "Raptor", "Bronto", "Dactyl"],
  "complete-nine": [
    "Rex",
    "Trice",
    "Stego",
    "Ankylo",
    "Raptor",
    "Bronto",
    "Dactyl",
    "Para",
    "Spino",
  ],
};

export const FORMAT_LABELS: Record<HerdFormat, string> = {
  "core-six": "Core Six",
  "genesis-seven": "Genesis Seven",
  "complete-nine": "Complete Nine",
};

export const FORMAT_ROUND_CAP: Record<HerdFormat, number> = {
  "core-six": 12,
  "genesis-seven": 14,
  "complete-nine": 18,
};

export const SPECIES_STATS: Record<Species, CoreStats> = {
  Rex: { health: 6, power: 9, guard: 4, speed: 5 },
  Trice: { health: 7, power: 6, guard: 8, speed: 3 },
  Stego: { health: 7, power: 5, guard: 7, speed: 5 },
  Ankylo: { health: 7, power: 5, guard: 9, speed: 3 },
  Raptor: { health: 5, power: 7, guard: 3, speed: 9 },
  Bronto: { health: 9, power: 4, guard: 7, speed: 4 },
  Dactyl: { health: 4, power: 6, guard: 4, speed: 10 },
  Para: { health: 6, power: 5, guard: 5, speed: 8 },
  Spino: { health: 7, power: 8, guard: 5, speed: 4 },
};

const CLASS_ADJUSTMENTS: Record<ClassName, CoreStats> = {
  Defender: { health: 1, power: -1, guard: 2, speed: -2 },
  Warrior: { health: 1, power: 2, guard: -1, speed: -2 },
  Mender: { health: 2, power: -2, guard: -1, speed: 1 },
  Tracker: { health: -1, power: -2, guard: 1, speed: 2 },
  Stalker: { health: -2, power: 1, guard: -1, speed: 2 },
  Mystic: { health: -3, power: 1, guard: 1, speed: 1 },
  Soarer: { health: -2, power: 1, guard: -2, speed: 3 },
};

export const PROVISIONAL_CLASSES: Record<Species, ClassName[]> = {
  Rex: ["Warrior", "Defender", "Stalker"],
  Trice: ["Defender", "Mystic", "Tracker"],
  Stego: ["Defender", "Mystic", "Mender"],
  Ankylo: ["Defender", "Warrior", "Stalker"],
  Raptor: ["Tracker", "Stalker", "Mender"],
  Bronto: ["Mender", "Tracker", "Mystic"],
  Dactyl: ["Soarer", "Tracker", "Stalker"],
  Para: ["Tracker", "Mender", "Mystic"],
  Spino: ["Warrior", "Defender", "Stalker"],
};

const MASTERY_COPY: Record<ClassName, Pick<TacticCard, "name" | "description" | "clayCost">> = {
  Defender: {
    name: "Hold the Line",
    description: "Redirect a Wing attack to this dino and Guard for the round.",
    clayCost: 2,
  },
  Warrior: {
    name: "Overrun",
    description: "Strike. If the target falls, recover 1 Clay next round.",
    clayCost: 2,
  },
  Mender: {
    name: "Second Wind",
    description: "Restore 24 health to an ally and clear one negative effect.",
    clayCost: 2,
  },
  Tracker: {
    name: "Trailblazer",
    description: "Reposition an ally and reveal the fastest enemy action.",
    clayCost: 1,
  },
  Stalker: {
    name: "Ambush",
    description: "Strike a Wing while ignoring the opposing Vanguard.",
    clayCost: 2,
  },
  Mystic: {
    name: "Reshape",
    description: "Copy one temporary positive effect from an active dino.",
    clayCost: 2,
  },
  Soarer: {
    name: "Skybreak",
    description: "Evade the next grounded strike, reposition and threaten a Wing.",
    clayCost: 2,
  },
};

export function statTotal(stats: CoreStats): number {
  return stats.health + stats.power + stats.guard + stats.speed;
}

export function applyClass(base: CoreStats, className: ClassName): CoreStats {
  const delta = CLASS_ADJUSTMENTS[className];
  const raw = {
    health: base.health + delta.health,
    power: base.power + delta.power,
    guard: base.guard + delta.guard,
    speed: base.speed + delta.speed,
  };
  const stats = normaliseStats(raw);
  if (statTotal(stats) !== STAT_BUDGET) {
    throw new Error(`${className} breaks the ${STAT_BUDGET}-point stat budget`);
  }
  return stats;
}

function normaliseStats(raw: CoreStats): CoreStats {
  const stats: CoreStats = {
    health: Math.min(10, Math.max(2, raw.health)),
    power: Math.min(10, Math.max(2, raw.power)),
    guard: Math.min(10, Math.max(2, raw.guard)),
    speed: Math.min(10, Math.max(2, raw.speed)),
  };
  const keys: Array<keyof CoreStats> = ["health", "power", "guard", "speed"];
  let difference = STAT_BUDGET - statTotal(stats);
  while (difference !== 0) {
    const direction = difference > 0 ? 1 : -1;
    const key = keys.find((candidate) => direction > 0 ? stats[candidate] < 10 : stats[candidate] > 2);
    if (!key) throw new Error("Unable to normalise the stat budget");
    stats[key] += direction;
    difference -= direction;
  }
  return stats;
}

export function createClassState(
  species: Species,
  onChainClass?: string,
  provisionalClass?: ClassName
): ClassState {
  const recognised = Object.keys(CLASS_ADJUSTMENTS).find(
    (name) => name.toLowerCase() === onChainClass?.trim().toLowerCase()
  ) as ClassName | undefined;

  if (recognised) {
    return {
      source: "on-chain",
      className: recognised,
      metadataSnapshotVersion: RULES_VERSION,
      masteryCardId: `mastery-${recognised.toLowerCase()}`,
    };
  }

  const chosen = provisionalClass ?? PROVISIONAL_CLASSES[species][0];
  if (!PROVISIONAL_CLASSES[species].includes(chosen)) {
    throw new Error(`${chosen} is not a provisional class for ${species}`);
  }
  return {
    source: "provisional",
    className: chosen,
    metadataSnapshotVersion: RULES_VERSION,
  };
}

export function createMasteryCard(member: HerdMember): TacticCard | null {
  if (member.classState.source !== "on-chain") return null;
  const copy = MASTERY_COPY[member.classState.className];
  return {
    id: `mastery-${member.id}`,
    name: copy.name,
    description: copy.description,
    clayCost: copy.clayCost,
    kind: "mastery",
    ownerMemberId: member.id,
    className: member.classState.className,
    copies: 1,
  };
}

export const TEAM_MASTERY_CARD: TacticCard = {
  id: "team-mastery-call-of-the-veterans",
  name: "Call of the Veterans",
  description: "Once per match: active allies gain +1 Speed and 15% damage reduction this round.",
  clayCost: 4,
  kind: "team-mastery",
  copies: 1,
};

export function isVeteranLineup(members: HerdMember[]): boolean {
  return members.length > 0 && members.every((member) => member.classState.source === "on-chain");
}

export function buildHerdBond(members: HerdMember[], preferred: "skin" | "colour" = "skin"): HerdBond {
  const values = preferred === "skin" ? members.map((member) => member.skin) : members.map((member) => member.colour);
  const first = values[0]?.trim();
  if (!first || values.some((value) => value.trim().toLowerCase() !== first.toLowerCase())) {
    throw new Error(`Every herd member must share the same ${preferred}`);
  }
  return bondFor(preferred, first);
}

function bondFor(kind: "skin" | "colour", value: string): HerdBond {
  const normalised = value.toLowerCase();
  const examples: Record<string, Pick<HerdBond, "benefit" | "limitation">> = {
    toxic: {
      benefit: "Damage-over-time effects last one additional round.",
      limitation: "Direct healing received is reduced by 20%.",
    },
    coral: {
      benefit: "The first heal each round restores 6 additional health.",
      limitation: "Critical and mastery damage is reduced by 10%.",
    },
    aqua: {
      benefit: "Repositioning grants 10% damage reduction for the round.",
      limitation: "Opening-round strikes deal 10% less damage.",
    },
    volcanic: {
      benefit: "Dinos below half health deal 10% more strike damage.",
      limitation: "The Vanguard begins with 5% less mitigation.",
    },
  };
  const rule = examples[normalised] ?? {
    benefit: "The first substitution each match costs 0 Clay.",
    limitation: "The starting Vanguard has -1 Speed in round one.",
  };
  return {
    kind,
    value,
    name: `${value} ${kind === "skin" ? "Skin" : "Colour"} Bond`,
    ...rule,
  };
}

export function traitTier(frequency: number): TraitTier {
  if (frequency < 0.01) return "mythic";
  if (frequency < 0.03) return "epic";
  if (frequency < 0.08) return "rare";
  if (frequency < 0.15) return "uncommon";
  return "common";
}

export function traitSurprise(frequency: number): number {
  if (!Number.isFinite(frequency) || frequency <= 0 || frequency > 1) {
    throw new Error("Trait frequency must be greater than 0 and no more than 1");
  }
  return Math.min(-Math.log2(frequency), 6.64);
}

export function validateHerd(herd: PublishedHerd): string[] {
  const errors: string[] = [];
  const required = FORMAT_SPECIES[herd.format];
  const species = herd.members.map((member) => member.species);
  if (herd.members.length !== required.length) {
    errors.push(`${FORMAT_LABELS[herd.format]} requires ${required.length} members.`);
  }
  for (const requiredSpecies of required) {
    if (species.filter((value) => value === requiredSpecies).length !== 1) {
      errors.push(`Exactly one ${requiredSpecies} is required.`);
    }
  }

  const expectedDeckSize = required.length * 3;
  const actualDeckSize = herd.build.deck.reduce((total, card) => total + (card.copies ?? 1), 0);
  if (actualDeckSize !== expectedDeckSize) {
    errors.push(`The signature deck requires ${expectedDeckSize} cards; found ${actualDeckSize}.`);
  }
  for (const member of herd.members) {
    const contributions = herd.build.deck.filter((card) => card.ownerMemberId === member.id);
    if (contributions.length === 0) errors.push(`${member.name} needs at least one signature card.`);
    if (statTotal(member.stats) !== STAT_BUDGET) errors.push(`${member.name} does not use ${STAT_BUDGET} stat points.`);
    if (member.classState.source === "on-chain" && !contributions.some((card) => card.kind === "mastery")) {
      errors.push(`${member.name} is Mastered and needs its Mastery card.`);
    }
  }
  if (herd.isVeteranHerd !== isVeteranLineup(herd.members)) {
    errors.push("Veteran Herd status does not match the members' on-chain classes.");
  }
  if (herd.isVeteranHerd && !herd.build.deck.some((card) => card.id === TEAM_MASTERY_CARD.id)) {
    errors.push("A Veteran Herd requires Call of the Veterans.");
  }
  try {
    buildHerdBond(herd.members, herd.bond.kind);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Invalid Herd Bond.");
  }
  return errors;
}

export function buildSignatureDeck(members: HerdMember[], format: HerdFormat): SignatureBuild {
  const veteran = isVeteranLineup(members);
  const deck: TacticCard[] = [];
  for (const member of members) {
    const mastery = createMasteryCard(member);
    if (mastery) deck.push(mastery);
    deck.push({
      id: `signature-${member.id}`,
      name: `${member.species} Instinct`,
      description: `A reliable ${member.classState.className.toLowerCase()} technique from ${member.name}.`,
      clayCost: 1,
      kind: "signature",
      ownerMemberId: member.id,
      className: member.classState.className,
      copies: mastery ? 2 : 3,
    });
  }

  if (veteran) {
    const replacement = deck.find((card) => card.kind === "signature" && (card.copies ?? 1) > 1);
    if (replacement) replacement.copies = (replacement.copies ?? 1) - 1;
    deck.push({ ...TEAM_MASTERY_CARD });
  }

  return {
    id: `build-${format}-${members.map((member) => member.id).join("-")}`,
    version: 1,
    format,
    startingFormation: {
      vanguard: members[0]?.id ?? "",
      "left-wing": members[1]?.id ?? "",
      "right-wing": members[2]?.id ?? "",
    },
    deck,
    publishedAt: new Date(0).toISOString(),
  };
}


