"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  activeMembers,
  createBattle,
  legalStrikeTargets,
  reserveMembers,
  resolveRound,
  type BattleMemberState,
  type BattleState,
  type PlannedAction,
} from "@/engine/battleEngine";
import { planAIActions, type AIDifficulty } from "@/engine/aiOpponent";
import { FORMAT_LABELS } from "@/engine/herdRules";
import { SAMPLE_HERDS } from "@/data/sampleHerds";
import { loadPublishedHerds } from "@/services/herdStorage";
import type { PublishedHerd } from "@/types/herd";

export default function BattlePage() {
  const [localHerds] = useState<PublishedHerd[]>(() => loadPublishedHerds());
  const herds = useMemo(() => [...localHerds, ...SAMPLE_HERDS], [localHerds]);
  const [playerHerd, setPlayerHerd] = useState<PublishedHerd | null>(herds[0] ?? null);
  const [opponentHerd, setOpponentHerd] = useState<PublishedHerd | null>(herds[1] ?? herds[0] ?? null);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [plans, setPlans] = useState<Record<string, PlannedAction>>({});

  if (!battle) {
    return (
      <main className="min-h-screen bg-[#080b10] px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-7xl">
          <Header eyebrow="Community herds" title="Choose your fighters" description="Pilot a collector's published herd, then choose the rival herd the AI will control." />

          <Selector title="Your herd" herds={herds} selected={playerHerd?.id} onSelect={setPlayerHerd} />
          <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-[0.35em] text-amber-300">
            <span className="h-px flex-1 bg-amber-300/20" /> versus <span className="h-px flex-1 bg-amber-300/20" />
          </div>
          <Selector title="Opponent herd" herds={herds} selected={opponentHerd?.id} onSelect={setOpponentHerd} />

          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row">
            <div>
              <label htmlFor="difficulty" className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">AI difficulty</label>
              <select id="difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as AIDifficulty)} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <button
              disabled={!playerHerd || !opponentHerd}
              onClick={() => playerHerd && opponentHerd && setBattle(createBattle(playerHerd, opponentHerd, Date.now() % 100000))}
              className="rounded-xl bg-amber-300 px-7 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:opacity-40"
            >
              Enter the arena
            </button>
          </div>
          <div className="mt-5 text-center text-sm text-slate-500">
            Want to publish your own lineup? <Link href="/deck" className="text-amber-300 hover:text-amber-200">Open the Herd Workshop</Link>.
          </div>
        </div>
      </main>
    );
  }

  const resolve = () => {
    const completedPlans = activeMembers(battle.player).map((member) =>
      plans[member.member.id] ?? defaultStrike(battle, member)
    );
    const aiPlans = planAIActions(battle, "opponent", difficulty);
    setBattle(resolveRound(battle, completedPlans, aiPlans));
    setPlans({});
  };

  return (
    <main className="min-h-screen bg-[#080b10] px-3 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-300">Round {battle.round} · {battle.player.clay}/{battle.player.maxClay} Clay</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">{battle.player.herd.name} <span className="text-slate-600">vs</span> {battle.opponent.herd.name}</h1>
          </div>
          <button onClick={() => { setBattle(null); setPlans({}); }} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Change herds</button>
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

function Header({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-8 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
      <p className="mx-auto mt-3 max-w-2xl text-slate-400">{description}</p>
    </header>
  );
}

function Selector({ title, herds, selected, onSelect }: { title: string; herds: PublishedHerd[]; selected?: string; onSelect: (herd: PublishedHerd) => void }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {herds.map((herd) => {
          const active = herd.id === selected;
          const mastered = herd.members.filter((member) => member.classState.source === "on-chain").length;
          return (
            <button key={herd.id} onClick={() => onSelect(herd)} className={`group overflow-hidden rounded-2xl border p-4 text-left transition ${active ? "border-amber-300 bg-amber-300/10 shadow-[0_0_30px_rgba(252,211,77,0.08)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex -space-x-2">
                  {herd.members.slice(0, 6).map((member) => <SpeciesToken key={member.id} member={member} />)}
                </div>
                {herd.isVeteranHerd && <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black uppercase text-slate-950">Veteran</span>}
              </div>
              <h3 className="text-lg font-black">{herd.name}</h3>
              <p className="text-xs text-slate-500">by {herd.collectorName} · {FORMAT_LABELS[herd.format]}</p>
              <p className="mt-3 text-sm text-slate-300">{herd.playStyle}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-white/5 px-2 py-1 text-slate-300">{herd.bond.name}</span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-slate-300">{mastered}/{herd.members.length} Mastered</span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-slate-300">♥ {herd.usage.favourites}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TeamBoard({ team, enemy = false }: { team: BattleState["player"]; enemy?: boolean }) {
  return (
    <section className={`rounded-2xl border p-4 ${enemy ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-sky-400/20 bg-sky-400/[0.04]"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-black">{team.herd.name}</h2><p className="text-xs text-slate-500">{team.herd.bond.name} · {team.clay}/{team.maxClay} Clay</p></div>
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
      <div className="flex items-center gap-3"><SpeciesToken member={state.member} large /><div><h3 className="font-bold">{state.member.species}</h3><p className="text-xs text-slate-500">{state.member.classState.className} · {state.member.classState.source === "on-chain" ? "Mastered" : "Provisional"}</p></div></div>
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
  return `☠ Venom ${status.magnitude ?? 4}/round`;
}

function statusStyle(kind: BattleMemberState["statuses"][number]["kind"]): string {
  if (kind === "chill") return "bg-sky-400/15 text-sky-300";
  if (kind === "frozen") return "bg-sky-200/20 text-sky-100";
  return "bg-lime-400/15 text-lime-300";
}

function ActionPanel({ state, member, plan, onPlan }: { state: BattleState; member: BattleMemberState; plan?: PlannedAction; onPlan: (plan: PlannedAction) => void }) {
  const targets = legalStrikeTargets(state, { teamId: "player", actorId: member.member.id });
  const reserves = reserveMembers(state.player);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-bold">{member.member.species}</p>
      <p className="mb-3 truncate text-xs text-amber-300">{plan ? labelPlan(plan, state) : "Strike (automatic)"}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {targets.map((target) => <button key={target.member.id} onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "strike", targetId: target.member.id })} className="rounded-lg border border-white/10 px-2 py-2 hover:bg-white/5">Strike {target.member.species}</button>)}
        <button onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "guard" })} className="rounded-lg border border-white/10 px-2 py-2 hover:bg-white/5">Guard</button>
        {member.member.classState.source === "on-chain" && !member.masteryUsed && state.player.clay >= 2 && (
          <button onClick={() => onPlan({ teamId: "player", actorId: member.member.id, type: "mastery", targetId: masteryTarget(state, member) })} className="rounded-lg border border-amber-300/30 px-2 py-2 text-amber-300 hover:bg-amber-300/10">Mastery · 2</button>
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

function SpeciesToken({ member, large = false }: { member: PublishedHerd["members"][number]; large?: boolean }) {
  return <span title={`${member.name} · ${member.classState.className}`} style={{ background: `linear-gradient(145deg, ${colourFor(member.skin)}, #111827)` }} className={`grid shrink-0 place-items-center rounded-full border-2 border-slate-950 font-black text-white shadow ${large ? "h-11 w-11 text-sm" : "h-8 w-8 text-[10px]"}`}>{member.species.slice(0, 2).toUpperCase()}</span>;
}

function defaultStrike(state: BattleState, member: BattleMemberState): PlannedAction {
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
  const colours: Record<string, string> = { coral: "#fb7185", toxic: "#84cc16", aqua: "#38bdf8", volcanic: "#f97316", crystalline: "#a78bfa", apres: "#bfdbfe", elektra: "#818cf8" };
  return colours[value.toLowerCase()] ?? "#64748b";
}
