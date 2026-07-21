import type { Ability, AbilityEffect } from "@/types/card";

interface AbilityTemplate {
  baseEffect: AbilityEffect;
  baseDamage: number;
  cooldown: number;
}

const ABILITY_TEMPLATES: Record<string, AbilityTemplate> = {
  // Warrior
  "Tail Smash": {
    baseEffect: { type: "damage", multiplier: 1.8 },
    baseDamage: 10,
    cooldown: 3,
  },
  Roar: {
    baseEffect: { type: "debuff", stat: "defense", amount: 8, turns: 2 },
    baseDamage: 0,
    cooldown: 3,
  },
  Bite: {
    baseEffect: { type: "damage", multiplier: 1.5 },
    baseDamage: 5,
    cooldown: 2,
  },

  // Tracker
  "Swift Strike": {
    baseEffect: { type: "damage", multiplier: 2.0 },
    baseDamage: 8,
    cooldown: 3,
  },
  Ambush: {
    baseEffect: { type: "damage", multiplier: 1.6 },
    baseDamage: 12,
    cooldown: 3,
  },
  Dodge: {
    baseEffect: { type: "buff", stat: "defense", amount: 15, turns: 2 },
    baseDamage: 0,
    cooldown: 2,
  },

  // Tank
  Stomp: {
    baseEffect: { type: "damage", multiplier: 1.4 },
    baseDamage: 8,
    cooldown: 2,
  },
  "Shield Wall": {
    baseEffect: { type: "buff", stat: "defense", amount: 20, turns: 3 },
    baseDamage: 0,
    cooldown: 4,
  },
  Earthquake: {
    baseEffect: { type: "damage", multiplier: 1.6 },
    baseDamage: 6,
    cooldown: 4,
  },

  // Defender
  "Horn Charge": {
    baseEffect: { type: "damage", multiplier: 1.7 },
    baseDamage: 8,
    cooldown: 3,
  },
  Fortify: {
    baseEffect: { type: "buff", stat: "defense", amount: 12, turns: 3 },
    baseDamage: 0,
    cooldown: 3,
  },
  Counter: {
    baseEffect: { type: "damage", multiplier: 2.2 },
    baseDamage: 0,
    cooldown: 4,
  },

  // Mystic
  "Plate Beam": {
    baseEffect: { type: "damage", multiplier: 1.9 },
    baseDamage: 10,
    cooldown: 3,
  },
  Heal: {
    baseEffect: { type: "heal", amount: 30 },
    baseDamage: 0,
    cooldown: 4,
  },
  Curse: {
    baseEffect: { type: "debuff", stat: "attack", amount: 10, turns: 3 },
    baseDamage: 0,
    cooldown: 3,
  },

  // Support
  "War Cry": {
    baseEffect: { type: "buff", stat: "attack", amount: 12, turns: 2 },
    baseDamage: 0,
    cooldown: 3,
  },
  Rally: {
    baseEffect: { type: "heal", amount: 20 },
    baseDamage: 0,
    cooldown: 3,
  },
  "Sonic Blast": {
    baseEffect: { type: "damage", multiplier: 1.5 },
    baseDamage: 8,
    cooldown: 2,
  },

  // Fortress
  "Club Tail": {
    baseEffect: { type: "damage", multiplier: 1.5 },
    baseDamage: 6,
    cooldown: 2,
  },
  "Iron Shell": {
    baseEffect: { type: "buff", stat: "defense", amount: 25, turns: 2 },
    baseDamage: 0,
    cooldown: 4,
  },
  Tremor: {
    baseEffect: { type: "debuff", stat: "defense", amount: 10, turns: 2 },
    baseDamage: 4,
    cooldown: 3,
  },

  // Wildcard
  Tackle: {
    baseEffect: { type: "damage", multiplier: 1.3 },
    baseDamage: 5,
    cooldown: 1,
  },
  Guard: {
    baseEffect: { type: "buff", stat: "defense", amount: 10, turns: 2 },
    baseDamage: 0,
    cooldown: 2,
  },
  Adapt: {
    baseEffect: { type: "buff", stat: "attack", amount: 8, turns: 2 },
    baseDamage: 0,
    cooldown: 2,
  },
};

/**
 * Resolve an ability name + card level into a full Ability object.
 * Level scales damage and effect amounts slightly.
 */
export function resolveAbility(name: string, level: number): Ability {
  const template = ABILITY_TEMPLATES[name];

  if (!template) {
    return {
      name: "Tackle",
      damage: 5,
      effect: { type: "damage", multiplier: 1.3 },
      cooldown: 1,
    };
  }

  // Level scaling: +1% per level
  const levelScale = 1 + level * 0.01;

  const scaledEffect = scaleEffect(template.baseEffect, levelScale);

  return {
    name,
    damage: Math.round(template.baseDamage * levelScale),
    effect: scaledEffect,
    cooldown: template.cooldown,
  };
}

function scaleEffect(effect: AbilityEffect, scale: number): AbilityEffect {
  switch (effect.type) {
    case "damage":
      return { ...effect, multiplier: +(effect.multiplier * scale).toFixed(2) };
    case "heal":
      return { ...effect, amount: Math.round(effect.amount * scale) };
    case "buff":
      return { ...effect, amount: Math.round(effect.amount * scale) };
    case "debuff":
      return { ...effect, amount: Math.round(effect.amount * scale) };
  }
}
