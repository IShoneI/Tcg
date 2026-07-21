export type Species =
  | "Rex"
  | "Trice"
  | "Stego"
  | "Ankylo"
  | "Raptor"
  | "Bronto"
  | "Dactyl"
  | "Para"
  | "Spino";

export type ClassName =
  | "Defender"
  | "Warrior"
  | "Mender"
  | "Tracker"
  | "Stalker"
  | "Mystic"
  | "Soarer";

export type HerdFormat = "core-six" | "genesis-seven" | "complete-nine";
export type FormationSlot = "vanguard" | "left-wing" | "right-wing" | "reserve";
export type ClassSource = "on-chain" | "provisional";
export type TraitTier = "common" | "uncommon" | "rare" | "epic" | "mythic";

export interface CoreStats {
  health: number;
  power: number;
  guard: number;
  speed: number;
}

export interface ClassState {
  source: ClassSource;
  className: ClassName;
  metadataSnapshotVersion: string;
  masteryCardId?: string;
}

export interface HerdMember {
  id: string;
  name: string;
  image: string;
  species: Species;
  skin: string;
  colour: string;
  mood?: string;
  motion?: string;
  background?: string;
  layerCount?: number;
  classState: ClassState;
  stats: CoreStats;
}

export type HerdBondKind = "skin" | "colour";

export interface HerdBond {
  kind: HerdBondKind;
  value: string;
  name: string;
  benefit: string;
  limitation: string;
}

export type TacticKind = "signature" | "mastery" | "team-mastery" | "tactic" | "gear";

export interface TacticCard {
  id: string;
  name: string;
  description: string;
  kind: TacticKind;
  clayCost: number;
  ownerMemberId?: string;
  className?: ClassName;
  copies?: number;
}

export interface SignatureBuild {
  id: string;
  version: number;
  format: HerdFormat;
  startingFormation: Record<Exclude<FormationSlot, "reserve">, string>;
  deck: TacticCard[];
  publishedAt: string;
}

export interface HerdUsageStats {
  selections: number;
  uniquePilots: number;
  favourites: number;
}

export interface PublishedHerd {
  id: string;
  slug: string;
  name: string;
  collectorName: string;
  description: string;
  bannerColour: string;
  format: HerdFormat;
  members: HerdMember[];
  bond: HerdBond;
  build: SignatureBuild;
  usage: HerdUsageStats;
  isVeteranHerd: boolean;
  playStyle: string;
}

export interface CollectorProfile {
  id: string;
  displayName: string;
  walletAddress?: string;
  publishedHerdIds: string[];
}
