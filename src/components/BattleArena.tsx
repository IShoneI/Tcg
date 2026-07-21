"use client";

import { useState } from "react";
import {
  activeMembers,
  legalStrikeTargets,
  masteryCost,
  reserveMembers,
  resolveRound,
  teamCompositionOf,
  type BattleMemberState,
  type BattleState,
  type PlannedAction,
} from "@/engine/battleEngine";
import { activeGroups } from "@/engine/herdComposition";
import type { PublishedHerd } from "@/types/herd";

interface BattleArenaProps {
  battle: BattleState;
  onChange: (next: BattleState) => void;
  planOpponent: (state: BattleState) => PlannedAction[];
  onExit: () => void;
  exitLabel?: string;
  eyebrowExtra?: string;
}

export default function BattleArena({ battle, onChange, planOpponent, onExit, exitLabel = "Change herds", eyebrowExtra }: BattleArenaProps) {
  const [plans, setPlans] = useState<Record<string, PlannedAction>>({});

  const resolve = () => {
    const completedPlans = activeMembers(battle.player).map((member) =>
      plans[member.member.id] ?? defaultStrike(battle, member)
    );
    onChange(resolveRound(battle, completedPlans, planOpponent(battle)));
    setPlans({});
  };

  return (
    <main className="min-h-screen bg-[#080b10] px-3 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">Round {battle.round} · {battle.player.clay}/{battle.player.maxClay} Clay{eyebrowExtra ? ` · ${eyebrowExtra}` : ""}</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{battle.player.herd.name} <span className="text-slate-600">vs</span> {battle.opponent.herd.name}</h1>
          </div>
          <button onClick={() => { onExit(); setPlans({}); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">{exitLabel}</button>
        </div>

        {battle.winner && (
          <div className="mb-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-300">Battle complete</p>
            <p className="mt-2 text-2xl font-black">{battle.winner === "draw" ? "The herds draw" : `${battle[battle.winner].herd.name} wins`}</p>
          </div>
        )}

        <TeamBoard team={battle.opponent} enemy />

        <div className="my-5 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Plan your round</h2>
              <span className="text-xs text-slate-500">Unplanned dinos Strike automatically</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {activeMembers(battle.player).map((member) => (
                <ActionPanel key={member.member.id} state={battle} member={member} plan={plans[member.member.id]} onPlan={(plan) => setPlans((current) => ({ ...current, [member.member.id]: plan }))} />
              ))}
            </div>
            <button disabled={!!battle.winner} onClick={resolve} className="mt-4 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 hover:bg-amber-200 disabled:opacity-40">Reveal plans</button>
          </div>
          <BattleLog state={battle} />
        </div>

        <TeamBoard team={battle.player} />
      </div>
    </main>
  );
}

function TeamBoard({ team, enemy = false }: { team: BattleState["player"]; enemy?: boolean }) {
  const groups = activeGroups(teamCompositionOf(team));
  const ancient = team.members.find((member) => member.member.ancient);
  return (
    <section className={`rounded-2xl border p-4 ${enemy ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-sky-400/20 bg-sky-400/[0.04]"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-black">{team.herd.name}</h2>
          <p className="text-xs text-slate-500">{team.clay}/{team.maxClay} Clay</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {ancient ? (
              <span className="rounded-full bg-orange-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-300">Ancient · {ancient.member.ancient?.title}</span>
            ) : groups.length === 0 ? (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">Unbonded herd</span>
            ) : (
              groups.map((group) => (
                <span key={`${group.kind}-${group.value}`} className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${group.tier === "full" ? "bg-amber-300/20 text-amber-300" : group.tier === "pride" ? "bg-violet-400/15 text-violet-300" : "bg-white/5 text-slate-300"}`}>
                  {group.value} ×{group.count} · {group.tier === "full" ? "Full Herd" : group.tier}
                </span>
              ))
            )}
          </div>
        </div>
        <div className="text-xs text-slate-400">{team.members.filter((member) => !member.defeated).length}/{team.members.length} standing</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {["left-wing", "vanguard", "right-wing"].map((slot) => {
          const member = team.members.find((candidate) => candidate.slot === slot && !candidate.defeated);
          return member ? <FighterCard key={member.member.id} state={member} /> : <div key={slot} className="min-h-36 rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-slate-600">Empty {slot.replace("-", " ")}</div>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {team.members.filter((member) => member.slot === "reserve").map((member) => (
          <span key={member.member.id} className={`rounded-lg border px-2 py-1 text-xs ${member.defeated ? "border-rose-500/20 text-rose-400 line-through" : "border-white/10 text-slate-400"}`}>{member.member.species} · {member.member.classState.className}</span>
        ))}
      </div>
    </section>
  );
}

function FighterCard({ state }: { state: BattleMemberState }) {
  const percentage = Math.max(0, Math.round((state.currentHP / state.maxHP) * 100));
  return (
    <article className="rounded-xl border border-white/10 bg-slate-950/80 p-3">
      <div className="flex items-center gap-3"><SpeciesToken member={state.member} large /><div><h3 className="font-bold">{state.member.ancient ? state.member.name : state.member.species}</h3><p className="text-xs text-slate-500">{state.member.classState.className} · {state.member.ancient ? "Ancient" : state.member.classState.source === "on-chain" ? "Mastered" : "Provisional"}</p></div></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${percentage}%` }} /></div>
      <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{state.currentHP}/{state.maxHP} HP</span><span>P{state.member.stats.power} G{state.member.stats.guard} S{state.member.stats.speed}</span></div>
      {state.statuses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {state.statuses.map((status) => (
            <span key={status.kind} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusStyle(status.kind)}`}>{statusLabel(status)}</span>
          ))}
        </div>
      )}
    </article>
  );
}

function statusLabel(status: BattleMemberState["statuses"][number]): string {
  if (status.kind === "chill") return `❄ Chill ×${status.stacks ?? 1}`;
  if (status.kind === "frozen") return "🧊 Frozen";
  if (status.kind === "venom") return `☠ Venom ${status.magnitude ?? 4}/round`;
  if (status.kind === "undertow") return "🌊 Undertow";
  if (status.kind === "roar") return `🦖 Roared −${status.magnitude ?? 1} Power`;
  return "🌿 Entangled";
}

function statusStyle(kind: BattleMemberState["statuses"][number]["kind"]): string {
  if (kind === "chill") return "bg-sky-400/15 text-sky-300";
  if (kind === "frozen") return "bg-sky-200/20 text-sky-100";
  if (kind === "venom") return "bg-lime-400/15 text-lime-300";
  if (kind === "undertow") return "bg-cyan-400/15 text-cyan-300";
  if (kind === "roar") return "bg-orange-400/15 text-orange-300";
  return "bg-emerald-400/15 text-emerald-300";
}

function ActionPanel({ state, member, plan, onPlan }: { state: BattleState; member: BattleMemberState; plan?: PlannedAction; onPlan: (plan: PlannedAction) => void }) {
  const targets = legalStrikeTargets(state, { teamId: "player", actorId: member.member.id });
  const reserves = reserveMembers(state.player);
  const cost = masteryCost(state.player);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-bold">{member.member.species}</p>
      <p className="mb-3 truncate text-xs text-amber-300">{plan ? labelPlan(plan, state) : "Strike (automatic)"}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {targets.map((target) => <button key={target.member.id} onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "strike", targetId: target.member.id })} className="rounded-lg border border-white/10 px-2 py-2 hover:bg-white/5">Strike {target.member.ancient ? target.member.name : target.member.species}</button>)}
        <button onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "guard" })} className="rounded-lg border border-white/10 px-2 py-2 hover:bg-white/5">Guard</button>
        {member.member.classState.source === "on-chain" && !member.masteryUsed && state.player.clay >= cost && (
          <button onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "mastery", targetId: masteryTarget(state, member) })} className="rounded-lg border border-amber-300/30 px-2 py-2 text-amber-300 hover:bg-amber-300/10">Mastery · {cost}</button>
        )}
        {reserves.slice(0, 2).map((reserve) => <button key={reserve.member.id} onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "substitute", reserveId: reserve.member.id })} className="rounded-lg border border-white/10 px-2 py-2 hover:bg-white/5">Swap: {reserve.member.species}</button>)}
        {state.player.herd.isVeteranHerd && !state.player.teamMasteryUsed && state.player.clay >= 4 && (
          <button onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "team-mastery" })} className="col-span-2 rounded-lg bg-amber-300 px-2 py-2 font-bold text-slate-950">Call Veterans · 4</button>
        )}
      </div>
    </div>
  );
}

function BattleLog({ state }: { state: BattleState }) {
  return <aside className="max-h-[370px] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/70 p-4"><h2 className="mb-3 font-bold">Battle log</h2><ol className="space-y-2 text-xs text-slate-400">{state.events.slice(-12).reverse().map((item) => <li key={item.id} className="border-l border-white/10 pl-3"><span className="text-slate-600">R{item.round}</span> {item.message}</li>)}</ol></aside>;
}

export function SpeciesToken({ member, large = false }: { member: PublishedHerd["members"][number]; large?: boolean }) {
  return <span title={`${member.name} · ${member.classState.className}`} style={{ background: `linear-gradient(145deg, ${colourFor(member.skin)}, #111827)` }} className={`grid shrink-0 place-items-center rounded-full border-2 border-slate-950 font-black text-white shadow ${large ? "h-11 w-11 text-sm" : "h-8 w-8 text-[10px]"}`}>{member.species.slice(0, 2).toUpperCase()}</span>;
}

export function defaultStrike(state: BattleState, member: BattleMemberState): PlannedAction {
  const target = legalStrikeTargets(state, { teamId: "player", actorId: member.member.id })[0];
  return target ? { teamId: "player", actorId: member.member.id, type: "strike", targetId: target.member.id } : { teamId: "player", actorId: member.member.id, type: "guard" };
}

function masteryTarget(state: BattleState, member: BattleMemberState): string | undefined {
  if (member.member.classState.className === "Mender") return [...activeMembers(state.player)].sort((a, b) => a.currentHP / a.maxHP - b.currentHP / b.maxHP)[0]?.member.id;
  return [...activeMembers(state.opponent)].sort((a, b) => a.currentHP - b.currentHP)[0]?.member.id;
}

function labelPlan(plan: PlannedAction, state: BattleState): string {
  if (plan.type === "strike" || plan.type === "mastery") return `${plan.type === "strike" ? "Strike" : "Mastery"}: ${state.opponent.members.find((item) => item.member.id === plan.targetId)?.member.species ?? "ally"}`;
  if (plan.type === "substitute") return `Swap for ${state.player.members.find((item) => item.member.id === plan.reserveId)?.member.species}`;
  if (plan.type === "team-mastery") return "Call of the Veterans";
  return "Guard";
}

function colourFor(value: string): string {
  const colours: Record<string, string> = { coral: "#fb7185", toxic: "#84cc16", aqua: "#38bdf8", volcanic: "#f97316", crystalline: "#a78bfa", apres: "#bfdbfe", elektra: "#818cf8", cristalline: "#a78bfa", oceania: "#22d3ee", savanna: "#fbbf24", jurassic: "#4ade80", amazonia: "#34d399", mirage: "#fcd34d" };
  return colours[value.toLowerCase()] ?? "#64748b";
}
