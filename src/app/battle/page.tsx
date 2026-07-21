"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBattle, type BattleState } from "@/engine/battleEngine";
import { planAIActions, type AIDifficulty } from "@/engine/aiOpponent";
import { FORMAT_LABELS } from "@/engine/herdRules";
import { progressWithinLevel, recordBattle } from "@/engine/progression";
import { loadProgress, updateProgress } from "@/services/progressionStorage";
import { SAMPLE_HERDS } from "@/data/sampleHerds";
import { loadPublishedHerds } from "@/services/herdStorage";
import BattleArena, { SpeciesToken } from "@/components/BattleArena";
import type { PublishedHerd } from "@/types/herd";

export default function BattlePage() {
  const [localHerds] = useState<PublishedHerd[]>(() => loadPublishedHerds());
  const herds = useMemo(() => [...localHerds, ...SAMPLE_HERDS], [localHerds]);
  const [playerHerd, setPlayerHerd] = useState<PublishedHerd | null>(herds[0] ?? null);
  const [opponentHerd, setOpponentHerd] = useState<PublishedHerd | null>(herds[1] ?? herds[0] ?? null);
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [collector, setCollector] = useState<{ level: number; current: number; needed: number } | null>(null);

  useEffect(() => {
    setCollector(progressWithinLevel(loadProgress().xp));
  }, []);

  const handleBattleChange = (next: BattleState) => {
    if (battle && !battle.winner && next.winner) {
      const progress = updateProgress((current) => recordBattle(current, next.winner === "player"));
      setCollector(progressWithinLevel(progress.xp));
    }
    setBattle(next);
  };

  if (!battle) {
    return (
      <main className="min-h-screen bg-[#080b10] px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300">Community herds</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Choose your fighters</h1>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">Pilot a collector&apos;s published herd, then choose the rival herd the AI will control.</p>
            {collector && (
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Collector Level {collector.level} · {collector.current}/{collector.needed} XP · <Link href="/boss" className="text-orange-300 hover:text-orange-200">Ancient encounters</Link>
              </p>
            )}
          </header>

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

  return (
    <BattleArena
      battle={battle}
      onChange={handleBattleChange}
      planOpponent={(state) => planAIActions(state, "opponent", difficulty)}
      onExit={() => setBattle(null)}
      eyebrowExtra={collector ? `Level ${collector.level}` : undefined}
    />
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
