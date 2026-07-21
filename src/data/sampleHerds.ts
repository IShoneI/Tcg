import { applyClass, buildHerdBond, buildSignatureDeck, createClassState, isVeteranLineup, SPECIES_STATS } from "@/engine/herdRules";
import type { ClassName, HerdMember, PublishedHerd, Species } from "@/types/herd";

const CORE_SPECIES: Species[] = ["Rex", "Trice", "Stego", "Ankylo", "Raptor", "Bronto"];

function member(
  herd: string,
  species: Species,
  index: number,
  skin: string,
  colour: string,
  className: ClassName,
  mastered: boolean
): HerdMember {
  const classState = createClassState(species, mastered ? className : undefined, className);
  return {
    id: `${herd}-${species.toLowerCase()}`,
    name: `${skin} ${species} #${110 + index * 731}`,
    image: "",
    species,
    skin,
    colour,
    mood: index % 2 ? "Confident" : "Happy",
    motion: species === "Raptor" ? "Run" : "Trot",
    background: index % 2 ? "Dune" : "Mint",
    layerCount: 2 + (index % 3),
    classState,
    stats: applyClass(SPECIES_STATS[species], classState.className),
  };
}

function createSample(
  id: string,
  name: string,
  collectorName: string,
  skin: string,
  colour: string,
  classes: ClassName[],
  masteredCount: number,
  accent: string,
  playStyle: string
): PublishedHerd {
  const members = CORE_SPECIES.map((species, index) =>
    member(id, species, index, skin, colour, classes[index], index < masteredCount)
  );
  const veteran = isVeteranLineup(members);
  return {
    id,
    slug: id,
    name,
    collectorName,
    description: `${skin}-matched Core Six herd, published for community battles.`,
    bannerColour: accent,
    format: "core-six",
    members,
    bond: buildHerdBond(members, "skin"),
    build: buildSignatureDeck(members, "core-six"),
    usage: {
      selections: id === "coral-keepers" ? 184 : 127,
      uniquePilots: id === "coral-keepers" ? 93 : 68,
      favourites: id === "coral-keepers" ? 46 : 35,
    },
    isVeteranHerd: veteran,
    playStyle,
  };
}

export const SAMPLE_HERDS: PublishedHerd[] = [
  createSample(
    "coral-keepers",
    "The Coral Keepers",
    "Neil",
    "Coral",
    "Aqua",
    ["Defender", "Tracker", "Mender", "Warrior", "Stalker", "Mystic"],
    6,
    "#e8796f",
    "Recovery, protection and patient substitutions"
  ),
  createSample(
    "toxic-charge",
    "Toxic Charge",
    "Claynotopia Guest",
    "Toxic",
    "Volcanic",
    ["Warrior", "Mystic", "Defender", "Stalker", "Tracker", "Mender"],
    4,
    "#a3e635",
    "Fast pressure and damage over time"
  ),
  createSample(
    "aqua-wayfinders",
    "Aqua Wayfinders",
    "Community Showcase",
    "Coral",
    "Aqua",
    ["Stalker", "Defender", "Mystic", "Warrior", "Mender", "Tracker"],
    3,
    "#38bdf8",
    "Formation control and opportunistic counters"
  ),
];
