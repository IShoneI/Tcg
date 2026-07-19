// === Helius DAS API Response Types ===

export interface DASAsset {
  id: string; // mint address
  content: {
    json_uri: string;
    metadata: {
      name: string;
      symbol: string;
      description?: string;
      attributes?: Array<{
        trait_type: string;
        value: string | number;
      }>;
    };
    links?: {
      image?: string;
      external_url?: string;
    };
  };
  grouping: Array<{
    group_key: string;
    group_value: string;
  }>;
  ownership: {
    owner: string;
    delegated: boolean;
  };
  royalty?: {
    percent: number;
  };
  compression?: {
    compressed: boolean;
  };
}

export interface DASResponse {
  total: number;
  limit: number;
  page: number;
  items: DASAsset[];
}

// === Game Types ===

export type AbilityEffect =
  | { type: "damage"; multiplier: number }
  | { type: "heal"; amount: number }
  | { type: "buff"; stat: "attack" | "defense"; amount: number; turns: number }
  | { type: "debuff"; stat: "attack" | "defense"; amount: number; turns: number };

export interface Ability {
  name: string;
  damage: number;
  effect: AbilityEffect;
  cooldown: number;
}

export interface CardStats {
  hp: number;
  attack: number;
  defense: number;
  ability: Ability;
  rarityScore: number;
  className: string;
  level: number;
}

export interface ActiveBuff {
  stat: "attack" | "defense";
  amount: number;
  turnsRemaining: number;
}

export interface BattleState {
  currentHP: number;
  buffs: ActiveBuff[];
  debuffs: ActiveBuff[];
  abilityCooldown: number;
  isDefeated: boolean;
}

export interface NFTCard {
  // Identity
  id: string; // mint address
  name: string;
  image: string;
  collection: string;

  // Raw metadata
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  metadataUri: string;

  // Derived game data
  stats: CardStats;
  holdDays: number;

  // Player input (persisted locally)
  isPFP: boolean;
  costBasisSOL?: number;
  nickname?: string;

  // Battle state (ephemeral)
  battleState?: BattleState;
}

export interface Deck {
  id: string;
  name: string;
  cards: string[]; // mint addresses
  createdAt: number;
  updatedAt: number;
}

export interface PlayerProfile {
  walletAddress: string;
  decks: Deck[];
  matchHistory: MatchRecord[];
  cardOverrides: Record<
    string,
    {
      isPFP: boolean;
      costBasisSOL?: number;
      nickname?: string;
    }
  >;
  stats: {
    wins: number;
    losses: number;
    winStreak: number;
    bestWinStreak: number;
    totalBattles: number;
  };
  lastUpdated: number;
}

export interface MatchRecord {
  id: string;
  timestamp: number;
  opponentType: "ai" | "pvp";
  opponentName: string;
  result: "win" | "loss";
  playerDeck: string[];
  turnsPlayed: number;
  cardsLost: number;
}

// === Collection Config ===

export interface CollectionConfig {
  name: string;
  slug: string;
  collectionAddress: string;
  description: string;
}
