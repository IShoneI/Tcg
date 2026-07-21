import { FORMAT_ROUND_CAP } from "@/engine/herdRules";
import type { FormationSlot, HerdMember, PublishedHerd, TacticCard } from "@/types/herd";

export type TeamId = "player" | "opponent";
export type BattlePhase = "planning" | "complete";
export type BattleActionType = "strike" | "guard" | "substitute" | "mastery" | "team-mastery";

export interface PlannedAction {
  teamId: TeamId;
  actorId: string;
  type: BattleActionType;
  targetId?: string;
  reserveId?: string;
}

export type StatusKind = "chill" | "frozen" | "venom";

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
  arcUsed: boolean;
  freeSubstitutionUsed: boolean;
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
  return 40 + member.stats.health * 10;
}

export function strikeDamage(member: HerdMember): number {
  return 6 + member.stats.power * 2;
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
    masteryUsed: false,
    defeated: false,
    statuses: [] as StatusEffect[],
  }));
  const deck = deterministicShuffle(expandDeck(herd.build.deck), seed);
  return {
    herd,
    members,
    clay: 3,
    maxClay: 3,
    deck: deck.slice(5),
    hand: deck.slice(0, 5),
    discard: [],
    teamMasteryUsed: false,
    arcUsed: false,
    freeSubstitutionUsed: false,
  };
}

// ---------------------------------------------------------------------------
// Skin bonds — the herd's shared skin decides its battlefield twist
// ---------------------------------------------------------------------------

const CHILL_STACKS_TO_FREEZE = 2;
const VENOM_DAMAGE = 4;
const VENOM_ROUNDS = 2;
const ARC_DAMAGE = 5;
const TIDE_HEAL = 3;

const SKIN_EFFECTS = new Set(["apres", "toxic", "elektra", "coral", "aqua", "volcanic"]);

export function teamSkin(team: BattleTeamState): string {
  const bond = team.herd.bond;
  return bond.kind === "skin" ? bond.value.trim().toLowerCase() : "";
}

function hasDefaultBond(team: BattleTeamState): boolean {
  return !SKIN_EFFECTS.has(teamSkin(team));
}

export function substitutionCost(team: BattleTeamState): number {
  return hasDefaultBond(team) && !team.freeSubstitutionUsed ? 0 : 1;
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

  const actions = [...playerActions, ...opponentActions]
    .filter((action) => isActionLegal(state, action))
    .sort((a, b) => actionPriority(state, b) - actionPriority(state, a) || tieBreak(state, a, b));

  for (const action of actions.filter((item) => item.type === "team-mastery")) {
    resolveAction(state, action);
  }
  for (const action of actions.filter((item) => item.type !== "team-mastery")) {
    if (state.winner) break;
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

function resolveAction(state: BattleState, action: PlannedAction): void {
  const team = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];
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
    const cost = substitutionCost(team);
    if (!reserve || team.clay < cost) return;
    team.clay -= cost;
    if (cost === 0) team.freeSubstitutionUsed = true;
    const slot = actor.slot;
    actor.slot = "reserve";
    reserve.slot = slot;
    if (teamSkin(team) === "aqua") reserve.roundDamageReduction += 0.1;
    state.events.push(event(state, `${reserve.member.name} substitutes for ${actor.member.name}.`, action.teamId, actor.member.id, reserve.member.id));
    return;
  }

  if (action.type === "team-mastery") {
    if (!team.herd.isVeteranHerd || team.teamMasteryUsed || team.clay < 4) return;
    team.clay -= 4;
    team.teamMasteryUsed = true;
    for (const member of activeMembers(team)) member.roundDamageReduction += 0.15;
    state.events.push(event(state, `${team.herd.name} answers the Call of the Veterans.`, action.teamId));
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

function resolveMastery(state: BattleState, action: PlannedAction, actor: BattleMemberState): void {
  const team = state[action.teamId];
  const enemy = state[otherTeam(action.teamId)];
  if (actor.masteryUsed || actor.member.classState.source !== "on-chain" || team.clay < 2) return;
  team.clay -= 2;
  actor.masteryUsed = true;
  const className = actor.member.classState.className;

  if (className === "Mender") {
    const target = team.members.find((member) => member.member.id === action.targetId && !member.defeated) ?? actor;
    const bonus = teamSkin(team) === "coral" ? 6 : 0;
    const healPenalty = teamSkin(team) === "toxic" ? 0.8 : 1;
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
  const multiplier = teamSkin(team) === "coral" ? base * 0.9 : base;
  dealStrike(state, action.teamId, actor, target, multiplier, true);
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
  const attackerSkin = teamSkin(attackers);
  const defenderSkin = teamSkin(defenders);

  let raw = strikeDamage(actor.member) * multiplier;
  if (actor.currentHP < actor.maxHP / 2 && attackerSkin === "volcanic") raw *= 1.1;
  if (attackerSkin === "apres") raw *= 0.95;
  if (attackerSkin === "aqua" && state.round === 1) raw *= 0.9;

  const passive = Math.min(target.member.stats.guard * 0.03, 0.3);
  const guarded = target.guarding ? (defenderSkin === "elektra" ? 0.2 : 0.25) : 0;
  const exposedVanguard = defenderSkin === "volcanic" && state.round === 1 && target.slot === "vanguard" ? 0.05 : 0;
  const reduction = Math.max(0, Math.min(0.75, passive + guarded + target.roundDamageReduction - exposedVanguard));
  const damage = Math.max(1, Math.round(raw * (1 - reduction)));
  target.currentHP = Math.max(0, target.currentHP - damage);
  if (target.currentHP === 0) target.defeated = true;
  state.events.push(event(
    state,
    `${actor.member.name}${mastery ? " uses Mastery and" : ""} strikes ${target.member.name} for ${damage}${target.defeated ? " — knocked out!" : "."}`,
    teamId,
    actor.member.id,
    target.member.id,
    damage
  ));

  if (!target.defeated) {
    if (attackerSkin === "apres") applyChill(state, teamId, target);
    if (attackerSkin === "toxic") applyVenom(state, teamId, target);
  }
  if (attackerSkin === "elektra" && !attackers.arcUsed) {
    const arcTarget = activeMembers(defenders)
      .filter((member) => member.member.id !== target.member.id)
      .sort((a, b) => a.currentHP - b.currentHP)[0];
    if (arcTarget) {
      attackers.arcUsed = true;
      arcTarget.currentHP = Math.max(0, arcTarget.currentHP - ARC_DAMAGE);
      if (arcTarget.currentHP === 0) arcTarget.defeated = true;
      state.events.push(event(
        state,
        `Lightning arcs from ${actor.member.name}'s strike into ${arcTarget.member.name} for ${ARC_DAMAGE}${arcTarget.defeated ? " — knocked out!" : "."}`,
        teamId,
        actor.member.id,
        arcTarget.member.id,
        ARC_DAMAGE
      ));
    }
  }
}

function applyChill(state: BattleState, teamId: TeamId, target: BattleMemberState): void {
  if (findStatus(target, "frozen")) return;
  const chill = findStatus(target, "chill");
  if (chill && (chill.stacks ?? 1) + 1 >= CHILL_STACKS_TO_FREEZE) {
    removeStatus(target, "chill");
    target.statuses.push({ kind: "frozen", rounds: 2 });
    state.events.push(event(state, `${target.member.name} is frozen solid!`, teamId, undefined, target.member.id));
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

function applyVenom(state: BattleState, teamId: TeamId, target: BattleMemberState): void {
  const venom = findStatus(target, "venom");
  if (venom) {
    venom.rounds = VENOM_ROUNDS;
    return;
  }
  target.statuses.push({ kind: "venom", rounds: VENOM_ROUNDS, magnitude: VENOM_DAMAGE });
  state.events.push(event(state, `${target.member.name} is envenomed.`, teamId, undefined, target.member.id));
}

function tickStatuses(state: BattleState, teamId: TeamId): void {
  const team = state[teamId];
  for (const member of team.members) {
    if (member.defeated) continue;
    const venom = findStatus(member, "venom");
    if (venom) {
      const damage = venom.magnitude ?? VENOM_DAMAGE;
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
  const actor = team.members.find((member) => member.member.id === action.actorId);
  if (!actor || actor.defeated || actor.slot === "reserve") return false;
  if (action.type === "strike") {
    return legalStrikeTargets(state, action).some((target) => target.member.id === action.targetId);
  }
  if (action.type === "substitute") {
    return team.clay >= substitutionCost(team) && reserveMembers(team).some((member) => member.member.id === action.reserveId);
  }
  if (action.type === "mastery") {
    return actor.member.classState.source === "on-chain" && !actor.masteryUsed && team.clay >= 2;
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
  team.maxClay = Math.min(8, team.maxClay + 1);
  team.clay = team.maxClay;
  if (teamSkin(team) === "coral") {
    let restored = 0;
    for (const member of activeMembers(team)) {
      const healed = Math.min(TIDE_HEAL, member.maxHP - member.currentHP);
      member.currentHP += healed;
      restored += healed;
    }
    if (restored > 0) {
      state.events.push(event(state, `The tide restores ${team.herd.name} for ${restored}.`, teamId, undefined, undefined, restored));
    }
  }
  const drawn = team.deck.shift();
  if (drawn) {
    if (team.hand.length < 8) team.hand.push(drawn);
    else team.discard.push(drawn);
  } else {
    const target = activeMembers(team).sort((a, b) => a.currentHP - b.currentHP)[0];
    if (target) {
      target.currentHP = Math.max(0, target.currentHP - 5);
      if (target.currentHP === 0) target.defeated = true;
      state.events.push(event(state, `${target.member.name} suffers 5 fatigue damage.`, teamId, target.member.id, undefined, 5));
    }
  }
}

function resetRound(team: BattleTeamState): void {
  team.arcUsed = false;
  for (const member of team.members) {
    member.guarding = false;
    member.roundDamageReduction = 0;
  }
}

function actionPriority(state: BattleState, action: PlannedAction): number {
  if (action.type === "team-mastery") return 100;
  const team = state[action.teamId];
  const member = team.members.find((candidate) => candidate.member.id === action.actorId);
  let speed = member?.member.stats.speed ?? 0;
  if (member) {
    const chill = findStatus(member, "chill");
    if (chill) speed -= 2 * (chill.stacks ?? 1);
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
