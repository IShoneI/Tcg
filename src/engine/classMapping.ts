export interface ClassProfile {
  name: string;
  baseHP: number;
  baseAttack: number;
  baseDefense: number;
  abilityPool: string[];
}

const CLASS_MAP: Record<string, ClassProfile> = {
  rex: {
    name: "Warrior",
    baseHP: 120,
    baseAttack: 35,
    baseDefense: 20,
    abilityPool: ["Tail Smash", "Roar", "Bite"],
  },
  raptor: {
    name: "Tracker",
    baseHP: 90,
    baseAttack: 30,
    baseDefense: 15,
    abilityPool: ["Swift Strike", "Ambush", "Dodge"],
  },
  bronto: {
    name: "Tank",
    baseHP: 160,
    baseAttack: 15,
    baseDefense: 40,
    abilityPool: ["Stomp", "Shield Wall", "Earthquake"],
  },
  trice: {
    name: "Defender",
    baseHP: 130,
    baseAttack: 20,
    baseDefense: 35,
    abilityPool: ["Horn Charge", "Fortify", "Counter"],
  },
  stego: {
    name: "Mystic",
    baseHP: 100,
    baseAttack: 25,
    baseDefense: 25,
    abilityPool: ["Plate Beam", "Heal", "Curse"],
  },
  para: {
    name: "Support",
    baseHP: 110,
    baseAttack: 20,
    baseDefense: 30,
    abilityPool: ["War Cry", "Rally", "Sonic Blast"],
  },
  ankylo: {
    name: "Fortress",
    baseHP: 140,
    baseAttack: 18,
    baseDefense: 38,
    abilityPool: ["Club Tail", "Iron Shell", "Tremor"],
  },
  default: {
    name: "Wildcard",
    baseHP: 100,
    baseAttack: 25,
    baseDefense: 25,
    abilityPool: ["Tackle", "Guard", "Adapt"],
  },
};

/**
 * Resolve a game class from NFT attributes.
 * Looks for "Species" trait first, falls back to "Class" or "Type".
 */
export function resolveClass(
  attributes: Array<{ trait_type: string; value: string | number }>
): ClassProfile {
  const speciesAttr = attributes.find(
    (a) =>
      a.trait_type.toLowerCase() === "species" ||
      a.trait_type.toLowerCase() === "class" ||
      a.trait_type.toLowerCase() === "type"
  );

  const species = String(speciesAttr?.value ?? "default").toLowerCase();
  return CLASS_MAP[species] ?? CLASS_MAP["default"];
}

export { CLASS_MAP };
