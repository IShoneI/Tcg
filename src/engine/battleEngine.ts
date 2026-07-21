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

export interface BattleMemberState {
  member: HerdMember;
  currentHP: number;
  maxHP: number;
  slot: FormationSlot;
  guarding: boolean;
  roundDamageReduction: number;
  masteryUsed: boolean;
  defeated: boolean;
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
  };
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

  if (action.type === "guard") {
    actor.guarding = true;
    state.events.push(event(state, `${actor.member.name} braces behind its Guard.`, action.teamId, actor.member.id));
    return;
  }

  if (action.type === "substitute") {
    const reserve = team.members.find((member) => member.member.id === action.reserveId && member.slot === "reserve" && !member.defeated);
    if (!reserve || team.clay < 1) return;
    team.clay -= 1;
    const slot = actor.slot;
    actor.slot = "reserve";
    reserve.slot = slot;
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
    const bonus = team.herd.bond.value.toLowerCase() === "coral" ? 6 : 0;
    const amount = Math.min(24 + bonus, target.maxHP - target.currentHP);
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
  const multiplier = className === "Warrior" ? 1.35 : className === "Soarer" ? 1.2 : 1.15;
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
  let raw = strikeDamage(actor.member) * multiplier;
  if (actor.currentHP < actor.maxHP / 2 && state[teamId].herd.bond.value.toLowerCase() === "volcanic") raw *= 1.1;
  const passive = Math.min(target.member.stats.guard * 0.03, 0.3);
  const guarded = target.guarding ? 0.25 : 0;
  const damage = Math.max(1, Math.round(raw * (1 - Math.min(0.75, passive + guarded + target.roundDamageReduction))));
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
}

export function isActionLegal(state: BattleState, action: PlannedAction): boolean {
  const team = state[action.teamId];
  const actor = team.members.find((member) => member.member.id === action.actorId);
  if (!actor || actor.defeated || actor.slot === "reserve") return false;
  if (action.type === "strike") {
    return legalStrikeTargets(state, action).some((target) => target.member.id === action.targetId);
  }
  if (action.type === "substitute") {
    return team.clay >= 1 && reserveMembers(team).some((member) => member.member.id === action.reserveId);
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
  for (const member of team.members) {
    member.guarding = false;
    member.roundDamageReduction = 0;
  }
}

function actionPriority(state: BattleState, action: PlannedAction): number {
  if (action.type === "team-mastery") return 100;
  const member = state[action.teamId].members.find((candidate) => candidate.member.id === action.actorId);
  const speed = member?.member.stats.speed ?? 0;
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
