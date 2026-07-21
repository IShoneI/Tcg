import { normaliseColor, normaliseSkin, type ColorName, type SkinName } from "@/data/traitCatalog";
import {
  colorTier,
  composeHerd,
  skinTier,
  tierAtLeast,
  tierForCount,
  type CompanionTier,
  type HerdComposition,
} from "@/engine/herdComposition";
import { FORMAT_ROUND_CAP } from "@/engine/herdRules";
import type { FormationSlot, HerdMember, PublishedHerd, TacticCard } from "@/types/herd";

export type TeamId = "player" | "opponent";
export type BattlePhase = "planning" | "complete";
export type BattleActionType = "strike" | "guard" | "substitute" | "mastery" | "team-mastery" | "play-card";

export interface PlannedAction {
  teamId: TeamId;
  actorId: string;
  type: BattleActionType;
  targetId?: string;
  reserveId?: string;
  cardId?: string;
}

export type StatusKind = "chill" | "frozen" | "venom" | "undertow" | "roar" | "entangle";

export interface StatusEffect {
  kind: StatusKind;
  rounds: number;
  stacks?: number;
  magnitude?: number;
}

export interface BattleMemberState {
  member: HerdMember;
  currentHP: number;
  maxHP: number;
  slot: FormationSlot;
  guarding: boolean;
  roundDamageReduction: number;
  roundStrikeBonus: number;
  roundSpeedBonus: number;
  roundExposure: number;
  roundGuardPierce: number;
  masteryUsed: boolean;
  defeated: boolean;
  statuses: StatusEffect[];
}

export interface BattleTeamState {
  herd: PublishedHerd;
  members: BattleMemberState[];
  clay: number;
  maxClay: number;
  deck: TacticCard[];
  hand: TacticCard[];
  discard: TacticCard[];
  teamMasteryUsed: boolean;
  cardPlayedThisRound: boolean;
  arcUsed: boolean;
  chillUsed: boolean;
  freeSubstitutionUsed: boolean;
  avalancheUsed: boolean;
  springTideUsed: boolean;
  fatigueShieldUsed: boolean;
  lethalGuardUsed: boolean;
  struckThisRound: Record<string, number>;
  reflectsUsed: number;
  undertowUsed: boolean;
  riptideUsed: boolean;
  stampedeUsed: boolean;
  hazeRoundUsed: number;
  hazeMatchUsed: boolean;
  statusFizzleUsed: boolean;
}

export interface BattleEvent {
  id: string;
  round: number;
  message: string;
  teamId?: TeamId;
  actorId?: string;
  targetId?: string;
  amount?: number;
}

export interface BattleState {
  rulesVersion: "herd-alpha-1";
  round: number;
  phase: BattlePhase;
  seed: number;
  player: BattleTeamState;
  opponent: BattleTeamState;
  events: BattleEvent[];
  winner: TeamId | "draw" | null;
}

const ACTIVE_SLOTS: Exclude<FormationSlot, "reserve">[] = ["vanguard", "left-wing", "right-wing"];

export function maxHP(member: HerdMember): number {
  return member.ancient?.maxHP ?? 40 + member.stats.health * 10;
}

export function strikeDamage(member: HerdMember): number {
  return member.ancient?.strikeDamage ?? 6 + member.stats.power * 2;
}

export function createBattle(playerHerd: PublishedHerd, opponentHerd: PublishedHerd, seed = 1): BattleState {
  const state: BattleState = {
    rulesVersion: "herd-alpha-1",
    round: 1,
    phase: "planning",
    seed,
    player: createTeam(playerHerd, seed),
    opponent: createTeam(opponentHerd, seed + 17),
    events: [],
    winner: null,
  };
  state.events.push(event(state, `Battle begins: ${playerHerd.name} vs ${opponentHerd.name}.`));
  return state;
}

function createTeam(herd: PublishedHerd, seed: number): BattleTeamState {
  const formation = herd.build.startingFormation;
  const slotById = new Map<string, FormationSlot>([
    [formation.vanguard, "vanguard"],
    [formation["left-wing"], "left-wing"],
    [formation["right-wing"], "right-wing"],
  ]);
  const members = herd.members.map((member) => ({
    member,
    currentHP: maxHP(member),
    maxHP: maxHP(member),
    slot: slotById.get(member.id) ?? "reserve",
    guarding: false,
    roundDamageReduction: 0,
    roundStrikeBonus: 0,
    roundSpeedBonus: 0,
    roundExposure: 0,
    roundGuardPierce: 0,
    masteryUsed: false,
    defeated: false,
    statuses: [] as StatusEffect[],
  }));
  const deck = deterministicShuffle(expandDeck(herd.build.deck), seed);
  const composition = composeHerd(herd.members, herd.members.length);
  const tropic = colorTier(composition, "Tropic");
  const handSize = tierAtLeast(tropic, "full") ? 6 : 5;
  const openingClay = 3 + (tierAtLeast(tropic, "pack") ? 1 : 0);
  return {
    herd,
    members,
    clay: openingClay,
    maxClay: 3,
    deck: deck.slice(handSize),
    hand: deck.slice(0, handSize),
    discard: [],
    teamMasteryUsed: false,
    cardPlayedThisRound: false,
    arcUsed: false,
    chillUsed: false,
    freeSubstitutionUsed: false,
    avalancheUsed: false,
    springTideUsed: false,
    fatigueShieldUsed: false,
    lethalGuardUsed: false,
    struckThisRound: {},
    reflectsUsed: 0,
    undertowUsed: false,
    riptideUsed: false,
    stampedeUsed: false,
    hazeRoundUsed: 0,
    hazeMatchUsed: false,
    statusFizzleUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Skin Skills & Color Boosts — per-member effects that scale with how many
// STANDING companions share the trait (dynamic companion tiers).
// ---------------------------------------------------------------------------

const CHILL_STACKS_TO_FREEZE = 2;

export function teamCompositionOf(team: BattleTeamState): HerdComposition {
  return composeHerd(
    team.members.filter((member) => !member.defeated).map((member) => member.member),
    team.herd.members.length
  );
}

function memberSkin(member: BattleMemberState): SkinName | null {
  return normaliseSkin(member.member.skin);
}

function memberColor(member: BattleMemberState): ColorName | null {
  return normaliseColor(member.member.colour);
}

function memberSkinTier(team: BattleTeamState, member: BattleMemberState): CompanionTier {
  return skinTier(teamCompositionOf(team), memberSkin(member));
}

function memberColorTier(team: BattleTeamState, member: BattleMemberState): CompanionTier {
  return colorTier(teamCompositionOf(team), memberColor(member));
}

function teamSkinTier(team: BattleTeamState, skin: SkinName): CompanionTier {
  return skinTier(teamCompositionOf(team), skin);
}

function teamColorTier(team: BattleTeamState, color: ColorName): CompanionTier {
  return colorTier(teamCompositionOf(team), color);
}

/** A herd with no skin group at Pack tier runs the default bond instead. */
function hasDefaultBond(team: BattleTeamState): boolean {
  const composition = teamCompositionOf(team);
  return !Object.values(composition.skinCounts).some(
    (count) => tierAtLeast(tierForCount(count, composition.formatSize), "pack")
  );
}

export function substitutionCost(team: BattleTeamState, enemy?: BattleTeamState): number {
  const base = hasDefaultBond(team) && !team.freeSubstitutionUsed ? 0 : 1;
  const overgrowthTax = enemy && tierAtLeast(teamSkinTier(enemy, "Amazonia"), "solo") ? 1 : 0;
  return base + overgrowthTax;
}

export function masteryCost(team: BattleTeamState): number {
  return tierAtLeast(teamColorTier(team, "Amethyst"), "pride") ? 1 : 2;
}

function findStatus(member: BattleMemberState, kind: StatusKind): StatusEffect | undefined {
  return member.statuses.find((status) => status.kind === kind);
}

function removeStatus(member: BattleMemberState, kind: StatusKind): void {
  member.statuses = member.statuses.filter((status) => status.kind !== kind);
}

export function activeMembers(team: BattleTeamState): BattleMemberState[] {
  return team.members.filter((member) => member.slot !== "reserve" && !member.defeated);
}

export function reserveMembers(team: BattleTeamState): BattleMemberState[] {
  return team.members.filter((member) => member.slot === "reserve" && !member.defeated);
}

export function legalStrikeTargets(state: BattleState, action: Pick<PlannedAction, "teamId" | "actorId">): BattleMemberState[] {
  const own = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];
  const actor = own.members.find((member) => member.member.id === action.actorId);
  if (!actor || actor.defeated || actor.slot === "reserve") return [];
  const vanguard = activeMembers(enemy).find((member) => member.slot === "vanguard");
  if (actor.member.classState.className === "Soarer" || actor.member.classState.className === "Stalker") {
    return activeMembers(enemy);
  }
  return vanguard ? [vanguard] : activeMembers(enemy);
}

export function resolveRound(
  previous: BattleState,
  playerActions: PlannedAction[],
  opponentActions: PlannedAction[]
): BattleState {
  if (previous.phase === "complete") return previous;
  const state = cloneState(previous);
  resetRound(state.player);
  resetRound(state.opponent);
  applyAuras(state, "player");
  applyAuras(state, "opponent");

  // Legality is checked at execution time, not plan time: an early card play
  // (e.g. an Instinct) may enable or disable actions that resolve after it.
  const actions = [...playerActions, ...opponentActions]
    .sort((a, b) => actionPriority(state, b) - actionPriority(state, a) || tieBreak(state, a, b));
  const opensRound = (action: PlannedAction) => action.type === "team-mastery" || action.type === "play-card";

  for (const action of actions.filter(opensRound)) {
    if (!isActionLegal(state, action)) continue;
    resolveAction(state, action);
  }
  for (const action of actions.filter((item) => !opensRound(item))) {
    if (state.winner) break;
    if (!isActionLegal(state, action)) continue;
    resolveAction(state, action);
    replaceDefeated(state, "player");
    replaceDefeated(state, "opponent");
    updateWinner(state);
  }

  if (!state.winner) {
    tickStatuses(state, "player");
    tickStatuses(state, "opponent");
    replaceDefeated(state, "player");
    replaceDefeated(state, "opponent");
    updateWinner(state);
  }

  if (!state.winner) {
    finishRound(state, "player");
    finishRound(state, "opponent");
    replaceDefeated(state, "player");
    replaceDefeated(state, "opponent");
    updateWinner(state);

    if (!state.winner && state.round >= FORMAT_ROUND_CAP[state.player.herd.format]) {
      state.winner = timeoutWinner(state);
      state.phase = "complete";
      state.events.push(event(state, state.winner === "draw" ? "The round limit ends in a draw." : `${state[state.winner].herd.name} wins on the round limit.`));
    } else if (!state.winner) {
      state.round += 1;
      state.events.push(event(state, `Round ${state.round} begins.`));
    }
  }
  return state;
}

/** Round-start auras: Jurassic intimidation and Amazonia entanglement. */
function applyAuras(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  const enemy = state[otherTeam(teamId)];

  const jurassic = teamSkinTier(team, "Jurassic");
  if (tierAtLeast(jurassic, "solo")) {
    const magnitude = tierAtLeast(jurassic, "pack") ? 2 : 1;
    const targets = tierAtLeast(jurassic, "pride")
      ? activeMembers(enemy)
      : activeMembers(enemy).filter((member) => member.slot === "vanguard");
    for (const target of targets) {
      const roar = findStatus(target, "roar");
      if (roar) {
        roar.rounds = 2;
        roar.magnitude = Math.max(roar.magnitude ?? 0, magnitude);
      } else {
        target.statuses.push({ kind: "roar", rounds: 2, magnitude });
      }
    }
    if (state.round === 1 && targets.length > 0) {
      state.events.push(event(state, `${team.herd.name}'s primal roar shakes the enemy line!`, teamId));
    }
  }

  const amazonia = teamSkinTier(team, "Amazonia");
  if (tierAtLeast(amazonia, "pride")) {
    for (const target of activeMembers(enemy)) {
      if (!findStatus(target, "entangle")) {
        target.statuses.push({ kind: "entangle", rounds: 2, magnitude: 1 });
      }
    }
    if (state.round === 1) {
      state.events.push(event(state, `Creeping overgrowth entangles ${enemy.herd.name}.`, teamId));
    }
  }
}

function resolveAction(state: BattleState, action: PlannedAction): void {
  const team = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];

  if (action.type === "play-card") {
    resolveCardPlay(state, action);
    return;
  }

  const actor = team.members.find((member) => member.member.id === action.actorId);
  if (!actor || actor.defeated || actor.slot === "reserve") return;

  if (findStatus(actor, "frozen")) {
    removeStatus(actor, "frozen");
    state.events.push(event(state, `${actor.member.name} is frozen solid and cannot act!`, action.teamId, actor.member.id));
    return;
  }

  if (action.type === "guard") {
    actor.guarding = true;
    state.events.push(event(state, `${actor.member.name} braces behind its Guard.`, action.teamId, actor.member.id));
    return;
  }

  if (action.type === "substitute") {
    const reserve = team.members.find((member) => member.member.id === action.reserveId && member.slot === "reserve" && !member.defeated);
    const cost = substitutionCost(team, enemy);
    if (!reserve || team.clay < cost) return;
    team.clay -= cost;
    if (cost === 0) team.freeSubstitutionUsed = true;
    const slot = actor.slot;
    actor.slot = "reserve";
    reserve.slot = slot;
    if (memberColor(reserve) === "Aqua" && tierAtLeast(memberColorTier(team, reserve), "full")) {
      reserve.roundDamageReduction += 0.1;
    }
    if (tierAtLeast(teamSkinTier(enemy, "Amazonia"), "pack") && !findStatus(reserve, "entangle")) {
      reserve.statuses.push({ kind: "entangle", rounds: 2, magnitude: 2 });
      state.events.push(event(state, `Vines snare ${reserve.member.name} as it enters the fray.`, action.teamId, undefined, reserve.member.id));
    }
    state.events.push(event(state, `${reserve.member.name} substitutes for ${actor.member.name}.`, action.teamId, actor.member.id, reserve.member.id));
    return;
  }

  if (action.type === "team-mastery") {
    if (!team.herd.isVeteranHerd || team.teamMasteryUsed || team.clay < 4) return;
    team.clay -= 4;
    teamMasteryEffect(state, action.teamId);
    return;
  }

  if (action.type === "mastery") {
    resolveMastery(state, action, actor);
    return;
  }

  const target = enemy.members.find((member) => member.member.id === action.targetId);
  if (!target || target.defeated || target.slot === "reserve") return;
  dealStrike(state, action.teamId, actor, target, 1);
}

function teamMasteryEffect(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  team.teamMasteryUsed = true;
  for (const member of activeMembers(team)) member.roundDamageReduction += 0.15;
  state.events.push(event(state, `${team.herd.name} answers the Call of the Veterans.`, teamId));
}

function resolveMastery(state: BattleState, action: PlannedAction, actor: BattleMemberState): void {
  const team = state[action.teamId];
  const cost = masteryCost(team);
  if (actor.masteryUsed || actor.member.classState.source !== "on-chain" || team.clay < cost) return;
  team.clay -= cost;
  actor.masteryUsed = true;
  masteryEffect(state, action.teamId, actor, action.targetId);
}

function masteryEffect(state: BattleState, teamId: TeamId, actor: BattleMemberState, targetId?: string): void {
  const team = state[teamId];
  const enemy = state[otherTeam(teamId)];
  const action = { teamId, actorId: actor.member.id, targetId };
  const className = actor.member.classState.className;

  if (className === "Mender") {
    const target = team.members.find((member) => member.member.id === action.targetId && !member.defeated) ?? actor;
    const bonus = tierAtLeast(teamSkinTier(team, "Coral"), "pack") ? 6 : 0;
    let healPenalty = 1;
    if (memberSkin(target) === "Toxic" && tierAtLeast(memberSkinTier(team, target), "pack")) healPenalty *= 0.8;
    if (findStatus(target, "venom") && tierAtLeast(teamSkinTier(enemy, "Toxic"), "pride")) healPenalty *= 0.8;
    const amount = Math.min(Math.floor((24 + bonus) * healPenalty), target.maxHP - target.currentHP);
    target.currentHP += amount;
    state.events.push(event(state, `${actor.member.name} uses Second Wind on ${target.member.name} for ${amount} health.`, action.teamId, actor.member.id, target.member.id, amount));
    return;
  }

  if (className === "Defender") {
    actor.guarding = true;
    actor.roundDamageReduction += 0.15;
    state.events.push(event(state, `${actor.member.name} holds the line.`, action.teamId, actor.member.id));
    return;
  }

  if (className === "Tracker") {
    actor.roundDamageReduction += 0.1;
    state.events.push(event(state, `${actor.member.name} reveals the trail and moves safely.`, action.teamId, actor.member.id));
    return;
  }

  if (className === "Mystic") {
    for (const ally of activeMembers(team)) ally.roundDamageReduction += 0.08;
    state.events.push(event(state, `${actor.member.name} reshapes the battlefield.`, action.teamId, actor.member.id));
    return;
  }

  const target = enemy.members.find((member) => member.member.id === action.targetId && !member.defeated && member.slot !== "reserve")
    ?? activeMembers(enemy)[0];
  if (!target) return;
  const base = className === "Warrior" ? 1.35 : className === "Soarer" ? 1.2 : 1.15;
  const coralCarrier = memberSkin(actor) === "Coral" && tierAtLeast(memberSkinTier(team, actor), "pack");
  const multiplier = coralCarrier ? base * 0.9 : base;
  dealStrike(state, action.teamId, actor, target, multiplier, true);
}

/**
 * Play one tactic card from hand per team per round. Mastery and team-mastery
 * cards channel the existing effects (respecting their once-per flags);
 * signature cards fire the owner class's Instinct for the round.
 */
function resolveCardPlay(state: BattleState, action: PlannedAction): void {
  const team = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];
  const index = team.hand.findIndex((candidate) => candidate.id === action.cardId);
  if (index < 0) return;
  const card = team.hand[index];
  if (team.cardPlayedThisRound || team.clay < card.clayCost) return;
  team.clay -= card.clayCost;
  team.hand.splice(index, 1);
  team.discard.push(card);
  team.cardPlayedThisRound = true;
  state.events.push(event(state, `${team.herd.name} plays ${card.name}.`, action.teamId));

  if (card.kind === "team-mastery") {
    if (!team.herd.isVeteranHerd || team.teamMasteryUsed) return;
    teamMasteryEffect(state, action.teamId);
    return;
  }

  if (card.kind === "mastery") {
    const owner = team.members.find((member) => member.member.id === card.ownerMemberId);
    if (!owner || owner.defeated || owner.slot === "reserve" || owner.masteryUsed) return;
    owner.masteryUsed = true;
    masteryEffect(state, action.teamId, owner, action.targetId);
    return;
  }

  const ally = pickInstinctAlly(team, card.ownerMemberId);
  const className = card.className;
  if (!ally || !className) return;

  if (className === "Defender") {
    ally.roundDamageReduction += 0.1;
    state.events.push(event(state, `${ally.member.name} braces low and takes 10% less damage this round.`, action.teamId, undefined, ally.member.id));
  } else if (className === "Warrior") {
    ally.roundStrikeBonus += 4;
    state.events.push(event(state, `${ally.member.name} strikes 4 harder this round.`, action.teamId, undefined, ally.member.id));
  } else if (className === "Mender") {
    const penalty = memberSkin(ally) === "Toxic" && tierAtLeast(memberSkinTier(team, ally), "pack") ? 0.8 : 1;
    const amount = Math.min(Math.floor(10 * penalty), ally.maxHP - ally.currentHP);
    ally.currentHP += amount;
    state.events.push(event(state, `${ally.member.name} is patched up for ${amount}.`, action.teamId, undefined, ally.member.id, amount));
  } else if (className === "Tracker") {
    ally.roundSpeedBonus += 2;
    const drawn = team.deck.shift();
    if (drawn) {
      if (team.hand.length < 8) team.hand.push(drawn);
      else team.discard.push(drawn);
    }
    state.events.push(event(state, `${ally.member.name} scouts ahead: +2 Speed and a fresh card.`, action.teamId, undefined, ally.member.id));
  } else if (className === "Stalker") {
    ally.roundGuardPierce = Math.max(ally.roundGuardPierce, 0.2);
    state.events.push(event(state, `${ally.member.name} circles for an opening: strikes ignore 20% of guard this round.`, action.teamId, undefined, ally.member.id));
  } else if (className === "Mystic") {
    const exposed = team.members.length > 0
      ? activeMembers(enemy).find((member) => member.member.id === action.targetId) ?? [...activeMembers(enemy)].sort((a, b) => a.currentHP - b.currentHP)[0]
      : undefined;
    if (exposed) {
      exposed.roundExposure += 0.1;
      state.events.push(event(state, `${exposed.member.name} is exposed: it takes 10% more damage this round.`, action.teamId, undefined, exposed.member.id));
    }
  } else {
    ally.roundSpeedBonus += 2;
    ally.roundDamageReduction += 0.05;
    state.events.push(event(state, `${ally.member.name} rides the updraft: +2 Speed and 5% damage reduction.`, action.teamId, undefined, ally.member.id));
  }
}

function pickInstinctAlly(team: BattleTeamState, ownerId?: string): BattleMemberState | undefined {
  const owner = team.members.find((member) => member.member.id === ownerId);
  if (owner && !owner.defeated && owner.slot !== "reserve") return owner;
  return [...activeMembers(team)].sort((a, b) => a.currentHP - b.currentHP)[0];
}

function dealStrike(
  state: BattleState,
  teamId: TeamId,
  actor: BattleMemberState,
  target: BattleMemberState,
  multiplier: number,
  mastery = false
): void {
  const attackers = state[teamId];
  const defenders = state[otherTeam(teamId)];
  const attackerComp = teamCompositionOf(attackers);
  const defenderComp = teamCompositionOf(defenders);
  const aSkin = memberSkin(actor);
  const aSkinTier = skinTier(attackerComp, aSkin);
  const aColor = memberColor(actor);
  const aColorTier = colorTier(attackerComp, aColor);
  const tSkinTier = skinTier(defenderComp, memberSkin(target));
  const tColorTier = colorTier(defenderComp, memberColor(target));
  const tColor = memberColor(target);

  let raw = strikeDamage(actor.member) * multiplier;
  if (actor.currentHP < actor.maxHP / 2 && aColor === "Volcanic" && tierAtLeast(aColorTier, "pack")) {
    raw *= tierAtLeast(aColorTier, "pride") ? 1.1 : 1.05;
  }
  if (aSkin === "Apres" && tierAtLeast(aSkinTier, "pack")) raw *= 0.95;
  if (aColor === "Aqua" && tierAtLeast(aColorTier, "pack") && state.round === 1) raw *= 0.9;
  const roar = findStatus(actor, "roar");
  if (roar) raw = Math.max(1, raw - 2 * (roar.magnitude ?? 1));

  const mirageTier = teamSkinTier(defenders, "Mirage");
  let hazed = false;
  if (tierAtLeast(mirageTier, "pack")) {
    const charges = tierAtLeast(mirageTier, "full") ? 2 : 1;
    if (defenders.hazeRoundUsed < charges) {
      defenders.hazeRoundUsed += 1;
      hazed = true;
    }
  } else if (tierAtLeast(mirageTier, "solo") && !defenders.hazeMatchUsed) {
    defenders.hazeMatchUsed = true;
    hazed = true;
  }
  if (hazed) {
    raw *= 0.75;
    state.events.push(event(state, `${target.member.name} shimmers in the heat haze.`, otherTeam(teamId), undefined, target.member.id));
  }

  const priorStrikes = attackers.struckThisRound[target.member.id] ?? 0;
  const packHunting = aSkin === "Savanna" && priorStrikes >= 1;
  let passive = Math.min(target.member.stats.guard * 0.03, 0.3);
  if (packHunting && tierAtLeast(aSkinTier, "pride")) passive *= 0.9;
  passive *= 1 - actor.roundGuardPierce;
  let guardRate = 0.25;
  if (tColor === "Aqua" && tierAtLeast(tColorTier, "pack")) guardRate = tierAtLeast(tColorTier, "pride") ? 0.3 : 0.27;
  if (memberSkin(target) === "Elektra" && tierAtLeast(tSkinTier, "pack")) guardRate -= 0.05;
  const guarded = target.guarding ? guardRate * (1 - actor.roundGuardPierce) : 0;
  const exposedVanguard =
    tColor === "Volcanic" && tierAtLeast(tColorTier, "pack") && state.round === 1 && target.slot === "vanguard" ? 0.05 : 0;
  const reduction = Math.max(0, Math.min(0.75, passive + guarded + target.roundDamageReduction - exposedVanguard - target.roundExposure));
  let damage = Math.max(1, Math.round(raw * (1 - reduction)));
  damage += actor.roundStrikeBonus;
  if (packHunting) {
    damage += tierAtLeast(aSkinTier, "pack") ? 4 : 2;
    state.events.push(event(state, `${actor.member.name} joins the pack hunt on ${target.member.name}.`, teamId, actor.member.id, target.member.id));
  }
  if (tColor === "Charcoal" && tierAtLeast(tColorTier, "pack")) {
    const hide = tierAtLeast(tColorTier, "full") ? 4 : tierAtLeast(tColorTier, "pride") ? 3 : 2;
    damage = Math.max(1, damage - hide);
  }

  if (damage >= target.currentHP && tColor === "Volcanic" && tierAtLeast(tColorTier, "full") && !defenders.lethalGuardUsed) {
    defenders.lethalGuardUsed = true;
    target.currentHP = 1;
    state.events.push(event(state, `${target.member.name} burns with fury and refuses to fall!`, otherTeam(teamId), undefined, target.member.id));
  } else {
    target.currentHP = Math.max(0, target.currentHP - damage);
  }
  if (target.currentHP === 0) target.defeated = true;
  state.events.push(event(
    state,
    `${actor.member.name}${mastery ? " uses Mastery and" : ""} strikes ${target.member.name} for ${damage}${target.defeated ? " — knocked out!" : "."}`,
    teamId,
    actor.member.id,
    target.member.id,
    damage
  ));

  attackers.struckThisRound[target.member.id] = priorStrikes + 1;

  const cristallineTier = skinTier(defenderComp, memberSkin(target));
  if (memberSkin(target) === "Cristalline" && tierAtLeast(cristallineTier, "solo")) {
    const reflectLimit = tierAtLeast(cristallineTier, "pride") ? 2 : 1;
    if (defenders.reflectsUsed < reflectLimit) {
      defenders.reflectsUsed += 1;
      const rate = tierAtLeast(cristallineTier, "pack") ? 0.15 : 0.1;
      const reflected = Math.max(1, Math.round(damage * rate));
      actor.currentHP = Math.max(0, actor.currentHP - reflected);
      if (actor.currentHP === 0) actor.defeated = true;
      state.events.push(event(state, `${target.member.name}'s facets reflect ${reflected} back at ${actor.member.name}${actor.defeated ? " — knocked out!" : "."}`, otherTeam(teamId), target.member.id, actor.member.id, reflected));
      if (tierAtLeast(cristallineTier, "full")) {
        const neighbour = activeMembers(attackers)
          .filter((member) => member.member.id !== actor.member.id)
          .sort((a, b) => a.currentHP - b.currentHP)[0];
        if (neighbour) {
          neighbour.currentHP = Math.max(0, neighbour.currentHP - 3);
          if (neighbour.currentHP === 0) neighbour.defeated = true;
          state.events.push(event(state, `Prism shards splinter into ${neighbour.member.name} for 3.`, otherTeam(teamId), target.member.id, neighbour.member.id, 3));
        }
      }
    }
  }

  if (
    aSkin === "Savanna" &&
    tierAtLeast(aSkinTier, "full") &&
    !attackers.stampedeUsed &&
    priorStrikes >= 2 &&
    !target.defeated &&
    target.currentHP < target.maxHP * 0.25 &&
    target.slot !== "reserve"
  ) {
    const slot = target.slot;
    const replacement = reserveMembers(defenders)[0];
    if (replacement) {
      attackers.stampedeUsed = true;
      target.slot = "reserve";
      replacement.slot = slot;
      state.events.push(event(state, `The stampede drives ${target.member.name} out of the battle line!`, teamId, actor.member.id, target.member.id));
    }
  }

  if (aSkin === "Oceania" && tierAtLeast(aSkinTier, "pack") && !attackers.undertowUsed && !target.defeated) {
    if (target.slot === "left-wing" || target.slot === "right-wing") {
      const enemyVanguard = activeMembers(defenders).find((member) => member.slot === "vanguard");
      if (enemyVanguard) {
        attackers.undertowUsed = true;
        const wingSlot = target.slot;
        target.slot = "vanguard";
        enemyVanguard.slot = wingSlot;
        if (tierAtLeast(aSkinTier, "pride") && !findStatus(target, "undertow")) {
          target.statuses.push({ kind: "undertow", rounds: 2, magnitude: 2 });
        }
        state.events.push(event(state, `The undertow drags ${target.member.name} into the vanguard!`, teamId, actor.member.id, target.member.id));
      }
    } else if (target.slot === "vanguard" && tierAtLeast(aSkinTier, "full") && !attackers.riptideUsed) {
      const replacement = reserveMembers(defenders)[0];
      if (replacement) {
        attackers.undertowUsed = true;
        attackers.riptideUsed = true;
        target.slot = "reserve";
        replacement.slot = "vanguard";
        state.events.push(event(state, `A riptide sweeps ${target.member.name} out of the fight — ${replacement.member.name} is pulled in!`, teamId, actor.member.id, target.member.id));
      }
    }
  }

  if (!target.defeated) {
    if (aSkin === "Apres" && (tierAtLeast(aSkinTier, "pack") || !attackers.chillUsed)) {
      attackers.chillUsed = true;
      applyChill(state, teamId, target, aSkinTier);
    }
    if (aSkin === "Toxic") applyVenom(state, teamId, target, aSkinTier);
  }
  if (aSkin === "Elektra" && !attackers.arcUsed) {
    const arcDamage = tierAtLeast(aSkinTier, "pack") ? 5 : 3;
    const extraTargets = tierAtLeast(aSkinTier, "pride") ? 2 : 1;
    const arcTargets = activeMembers(defenders)
      .filter((member) => member.member.id !== target.member.id)
      .sort((a, b) => a.currentHP - b.currentHP)
      .slice(0, extraTargets);
    if (arcTargets.length > 0) {
      attackers.arcUsed = true;
      for (const arcTarget of arcTargets) {
        arcTarget.currentHP = Math.max(0, arcTarget.currentHP - arcDamage);
        if (arcTarget.currentHP === 0) arcTarget.defeated = true;
        state.events.push(event(
          state,
          `Lightning arcs from ${actor.member.name}'s strike into ${arcTarget.member.name} for ${arcDamage}${arcTarget.defeated ? " — knocked out!" : "."}`,
          teamId,
          actor.member.id,
          arcTarget.member.id,
          arcDamage
        ));
      }
      if (tierAtLeast(aSkinTier, "full") && defenders.clay > 0) {
        defenders.clay -= 1;
        state.events.push(event(state, `The overload drains 1 Clay from ${defenders.herd.name}.`, teamId, actor.member.id));
      }
    }
  }
}

function applyChill(state: BattleState, teamId: TeamId, target: BattleMemberState, tier: CompanionTier): void {
  if (findStatus(target, "frozen")) return;
  const attackers = state[teamId];
  const defenders = state[otherTeam(teamId)];
  if (fizzleStatus(state, teamId, target)) return;
  const chill = findStatus(target, "chill");
  if (chill && (chill.stacks ?? 1) + 1 >= CHILL_STACKS_TO_FREEZE) {
    removeStatus(target, "chill");
    target.statuses.push({ kind: "frozen", rounds: 2 });
    state.events.push(event(state, `${target.member.name} is frozen solid!`, teamId, undefined, target.member.id));
    if (tierAtLeast(tier, "pride") && defenders.clay > 0) {
      defenders.clay -= 1;
      state.events.push(event(state, `The deep freeze drains 1 Clay from ${defenders.herd.name}.`, teamId));
    }
    if (tierAtLeast(tier, "full") && !attackers.avalancheUsed) {
      attackers.avalancheUsed = true;
      for (const bystander of activeMembers(defenders)) {
        if (bystander.member.id === target.member.id || findStatus(bystander, "frozen")) continue;
        const existing = findStatus(bystander, "chill");
        if (existing) {
          existing.rounds = 2;
        } else {
          bystander.statuses.push({ kind: "chill", rounds: 2, stacks: 1 });
        }
      }
      state.events.push(event(state, `An avalanche rolls over ${defenders.herd.name} — the whole line is chilled!`, teamId));
    }
    return;
  }
  if (chill) {
    chill.stacks = (chill.stacks ?? 1) + 1;
    chill.rounds = 2;
  } else {
    target.statuses.push({ kind: "chill", rounds: 2, stacks: 1 });
  }
  state.events.push(event(state, `${target.member.name} is chilled to the bone.`, teamId, undefined, target.member.id));
}

/** Mirage Pride rider: the first status against the herd each match fizzles. */
function fizzleStatus(state: BattleState, attackerId: TeamId, target: BattleMemberState): boolean {
  const defenders = state[otherTeam(attackerId)];
  if (defenders.statusFizzleUsed) return false;
  if (!tierAtLeast(teamSkinTier(defenders, "Mirage"), "pride")) return false;
  defenders.statusFizzleUsed = true;
  state.events.push(event(state, `The affliction shimmers away from ${target.member.name}.`, otherTeam(attackerId), undefined, target.member.id));
  return true;
}

function applyVenom(state: BattleState, teamId: TeamId, target: BattleMemberState, tier: CompanionTier): void {
  if (fizzleStatus(state, teamId, target)) return;
  const magnitude = tierAtLeast(tier, "pack") ? 4 : 2;
  const rounds = tierAtLeast(tier, "pack") ? 2 : 1;
  const venom = findStatus(target, "venom");
  if (venom) {
    venom.rounds = Math.max(venom.rounds, rounds);
    venom.magnitude = Math.max(venom.magnitude ?? 0, magnitude);
    return;
  }
  target.statuses.push({ kind: "venom", rounds, magnitude });
  state.events.push(event(state, `${target.member.name} is envenomed.`, teamId, undefined, target.member.id));
}

function tickStatuses(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  for (const member of team.members) {
    if (member.defeated) continue;
    const venom = findStatus(member, "venom");
    if (venom) {
      const damage = venom.magnitude ?? 4;
      member.currentHP = Math.max(0, member.currentHP - damage);
      state.events.push(event(state, `Venom sears ${member.member.name} for ${damage}${member.currentHP === 0 ? " — knocked out!" : "."}`, teamId, undefined, member.member.id, damage));
      if (member.currentHP === 0) member.defeated = true;
    }
    for (const status of member.statuses) status.rounds -= 1;
    member.statuses = member.statuses.filter((status) => status.rounds > 0);
  }
}

export function isActionLegal(state: BattleState, action: PlannedAction): boolean {
  const team = state[action.teamId];
  if (action.type === "play-card") {
    if (team.cardPlayedThisRound) return false;
    const card = team.hand.find((candidate) => candidate.id === action.cardId);
    if (!card || team.clay < card.clayCost) return false;
    if (card.kind === "mastery") {
      const owner = team.members.find((member) => member.member.id === card.ownerMemberId);
      return !!owner && !owner.defeated && owner.slot !== "reserve" && !owner.masteryUsed && owner.member.classState.source === "on-chain";
    }
    if (card.kind === "team-mastery") {
      return team.herd.isVeteranHerd && !team.teamMasteryUsed;
    }
    return true;
  }
  const actor = team.members.find((member) => member.member.id === action.actorId);
  if (!actor || actor.defeated || actor.slot === "reserve") return false;
  if (action.type === "strike") {
    return legalStrikeTargets(state, action).some((target) => target.member.id === action.targetId);
  }
  if (action.type === "substitute") {
    return team.clay >= substitutionCost(team, state[otherTeam(action.teamId)]) && reserveMembers(team).some((member) => member.member.id === action.reserveId);
  }
  if (action.type === "mastery") {
    if (state.round === 1 && tierAtLeast(teamSkinTier(state[otherTeam(action.teamId)], "Jurassic"), "full")) return false;
    return actor.member.classState.source === "on-chain" && !actor.masteryUsed && team.clay >= masteryCost(team);
  }
  if (action.type === "team-mastery") {
    return team.herd.isVeteranHerd && !team.teamMasteryUsed && team.clay >= 4;
  }
  return true;
}

function replaceDefeated(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  for (const slot of ACTIVE_SLOTS) {
    const defeated = team.members.find((member) => member.slot === slot && member.defeated);
    if (!defeated) continue;
    defeated.slot = "reserve";
    const replacement = reserveMembers(team)[0];
    if (replacement) {
      replacement.slot = slot;
      state.events.push(event(state, `${replacement.member.name} enters as ${slot.replace("-", " ")}.`, teamId, replacement.member.id));
    }
  }
}

function updateWinner(state: BattleState): void {
  const playerAlive = state.player.members.some((member) => !member.defeated);
  const opponentAlive = state.opponent.members.some((member) => !member.defeated);
  if (playerAlive && opponentAlive) return;
  state.winner = playerAlive === opponentAlive ? "draw" : playerAlive ? "player" : "opponent";
  state.phase = "complete";
  state.events.push(event(state, state.winner === "draw" ? "Both herds are defeated." : `${state[state.winner].herd.name} wins the battle!`));
}

function finishRound(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  const clayCap = tierAtLeast(teamColorTier(team, "Amethyst"), "full") ? 9 : 8;
  team.maxClay = Math.min(clayCap, team.maxClay + 1);
  team.clay = team.maxClay;
  if (tierAtLeast(teamColorTier(team, "Tropic"), "pride") && state.round === 1) {
    team.clay += 1;
    state.events.push(event(state, `The sunburst grants ${team.herd.name} 1 extra Clay.`, teamId, undefined, undefined, 1));
  }

  const coral = teamSkinTier(team, "Coral");
  if (tierAtLeast(coral, "solo")) {
    const tide = tierAtLeast(coral, "pride") ? 4 : tierAtLeast(coral, "pack") ? 3 : 2;
    let restored = 0;
    for (const member of activeMembers(team)) {
      const healed = Math.min(tide, member.maxHP - member.currentHP);
      member.currentHP += healed;
      restored += healed;
    }
    if (restored > 0) {
      state.events.push(event(state, `The tide restores ${team.herd.name} for ${restored}.`, teamId, undefined, undefined, restored));
    }
    if (tierAtLeast(coral, "pride")) {
      const afflicted = activeMembers(team).find(
        (member) => findStatus(member, "venom") || findStatus(member, "chill")
      );
      if (afflicted) {
        const venom = findStatus(afflicted, "venom");
        const chill = findStatus(afflicted, "chill");
        if (venom) removeStatus(afflicted, "venom");
        else if (chill && (chill.stacks ?? 1) > 1) chill.stacks = (chill.stacks ?? 1) - 1;
        else removeStatus(afflicted, "chill");
        state.events.push(event(state, `The tide washes an affliction from ${afflicted.member.name}.`, teamId, undefined, afflicted.member.id));
      }
    }
    if (tierAtLeast(coral, "full") && !team.springTideUsed && team.members.some((member) => !member.defeated && findStatus(member, "frozen"))) {
      team.springTideUsed = true;
      for (const member of team.members) {
        if (!member.defeated) member.statuses = [];
      }
      state.events.push(event(state, `A spring tide surges through ${team.herd.name}, cleansing every affliction!`, teamId));
    }
  }

  if (tierAtLeast(teamSkinTier(team, "Amazonia"), "full")) {
    let restored = 0;
    for (const member of reserveMembers(team)) {
      const healed = Math.min(2, member.maxHP - member.currentHP);
      member.currentHP += healed;
      restored += healed;
    }
    if (restored > 0) {
      state.events.push(event(state, `The canopy shelters ${team.herd.name}'s reserves for ${restored}.`, teamId, undefined, undefined, restored));
    }
  }

  const spring = teamColorTier(team, "Spring");
  if (tierAtLeast(spring, "pack")) {
    const renewal = tierAtLeast(spring, "full") ? 3 : tierAtLeast(spring, "pride") ? 2 : 1;
    let restored = 0;
    for (const member of activeMembers(team)) {
      const healed = Math.min(renewal, member.maxHP - member.currentHP);
      member.currentHP += healed;
      restored += healed;
    }
    if (restored > 0) {
      state.events.push(event(state, `Spring renewal restores ${team.herd.name} for ${restored}.`, teamId, undefined, undefined, restored));
    }
  }

  const drawn = team.deck.shift();
  if (drawn) {
    if (team.hand.length < 8) team.hand.push(drawn);
    else team.discard.push(drawn);
  } else {
    const target = activeMembers(team).sort((a, b) => a.currentHP - b.currentHP)[0];
    if (target) {
      const desert = teamColorTier(team, "Desert");
      if (tierAtLeast(desert, "pack") && !team.fatigueShieldUsed) {
        team.fatigueShieldUsed = true;
        state.events.push(event(state, `${team.herd.name}'s desert endurance shrugs off the fatigue.`, teamId));
        return;
      }
      const fatigue = tierAtLeast(desert, "pride") ? 3 : 5;
      target.currentHP = Math.max(0, target.currentHP - fatigue);
      if (target.currentHP === 0) target.defeated = true;
      state.events.push(event(state, `${target.member.name} suffers ${fatigue} fatigue damage.`, teamId, target.member.id, undefined, fatigue));
    }
  }
}

function resetRound(team: BattleTeamState): void {
  team.arcUsed = false;
  team.chillUsed = false;
  team.undertowUsed = false;
  team.cardPlayedThisRound = false;
  team.reflectsUsed = 0;
  team.hazeRoundUsed = 0;
  team.struckThisRound = {};
  for (const member of team.members) {
    member.guarding = false;
    member.roundDamageReduction = 0;
    member.roundStrikeBonus = 0;
    member.roundSpeedBonus = 0;
    member.roundExposure = 0;
    member.roundGuardPierce = 0;
  }
}

function actionPriority(state: BattleState, action: PlannedAction): number {
  if (action.type === "team-mastery") return 100;
  if (action.type === "play-card") return 90;
  const team = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];
  const member = team.members.find((candidate) => candidate.member.id === action.actorId);
  let speed = member?.member.stats.speed ?? 0;
  if (member) {
    speed += member.roundSpeedBonus;
    const chill = findStatus(member, "chill");
    if (chill) speed -= 2 * (chill.stacks ?? 1);
    const undertow = findStatus(member, "undertow");
    if (undertow) speed -= undertow.magnitude ?? 2;
    const entangle = findStatus(member, "entangle");
    if (entangle) speed -= entangle.magnitude ?? 1;
    if (findStatus(member, "venom") && tierAtLeast(teamSkinTier(enemy, "Toxic"), "full")) speed -= 1;
    if (memberColor(member) === "Mist" && tierAtLeast(memberColorTier(team, member), "pack")) speed += 1;
    if (tierAtLeast(teamColorTier(team, "Desert"), "full") && state.round > 8) speed += 2;
    if (hasDefaultBond(team) && state.round === 1 && member.slot === "vanguard") speed -= 1;
  }
  return speed + (action.type === "guard" ? 20 : 0);
}

function tieBreak(state: BattleState, a: PlannedAction, b: PlannedAction): number {
  const aValue = hash(`${state.seed}:${state.round}:${a.teamId}:${a.actorId}`);
  const bValue = hash(`${state.seed}:${state.round}:${b.teamId}:${b.actorId}`);
  return aValue - bValue;
}

function timeoutWinner(state: BattleState): TeamId | "draw" {
  // An Ancient cannot be out-waited: stalling to the round cap loses.
  const playerAncient = state.player.members.some((member) => member.member.ancient);
  const opponentAncient = state.opponent.members.some((member) => member.member.ancient);
  if (playerAncient !== opponentAncient) return playerAncient ? "player" : "opponent";

  const score = (team: BattleTeamState) => {
    const living = team.members.filter((member) => !member.defeated).length;
    const health = team.members.reduce((total, member) => total + member.currentHP / member.maxHP, 0);
    return living * 100 + health;
  };
  const player = score(state.player);
  const opponent = score(state.opponent);
  if (Math.abs(player - opponent) < 0.001) return "draw";
  return player > opponent ? "player" : "opponent";
}

function expandDeck(cards: TacticCard[]): TacticCard[] {
  return cards.flatMap((card) => Array.from({ length: card.copies ?? 1 }, (_, index) => ({ ...card, id: `${card.id}::${index}` })));
}

function deterministicShuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let value = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    value = (value * 48271) % 2147483647;
    const target = value % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function cloneState(state: BattleState): BattleState {
  return structuredClone(state);
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === "player" ? "opponent" : "player";
}

function event(
  state: BattleState,
  message: string,
  teamId?: TeamId,
  actorId?: string,
  targetId?: string,
  amount?: number
): BattleEvent {
  return { id: `${state.round}-${state.events.length}-${hash(message)}`, round: state.round, message, teamId, actorId, targetId, amount };
}

function hash(value: string): number {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
}
