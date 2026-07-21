"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBattle, type BattleState } from "@/engine/battleEngine";
import { planAncientActions } from "@/engine/aiOpponent";
import { progressWithinLevel, recordAncientDefeat, recordBattle } from "@/engine/progression";
import { loadProgress, updateProgress } from "@/services/progressionStorage";
import { ANCIENTS, type AncientDefinition } from "@/data/ancients";
import { SAMPLE_HERDS } from "@/data/sampleHerds";
import { loadPublishedHerds } from "@/services/herdStorage";
import BattleArena, { SpeciesToken } from "@/components/BattleArena";
import type { PublishedHerd } from "@/types/herd";

export default function BossPage() {
  const [localHerds] = useState<PublishedHerd[]>(() => loadPublishedHerds());
  const herds = useMemo(() => [...localHerds, ...SAMPLE_HERDS], [localHerds]);
  const [playerHerd, setPlayerHerd] = useState<PublishedHerd | null>(herds[0] ?? null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [activeAncient, setActiveAncient] = useState<AncientDefinition | null>(null);
  const [collector, setCollector] = useState<{ level: number; current: number; needed: number } | null>(null);
  const [defeated, setDefeated] = useState<string[]>([]);

  useEffect(() => {
    const progress = loadProgress();
    setCollector(progressWithinLevel(progress.xp));
    setDefeated(progress.defeatedAncientIds);
  }, []);

  const handleBattleChange = (next: BattleState) => {
    if (battle && !battle.winner && next.winner && activeAncient) {
      const won = next.winner === "player";
      const progress = updateProgress((current) => {
        const afterBattle = recordBattle(current, won);
        return won ? recordAncientDefeat(afterBattle, activeAncient.id) : afterBattle;
      });
      setCollector(progressWithinLevel(progress.xp));
      setDefeated(progress.defeatedAncientIds);
    }
    setBattle(next);
  };

  if (battle && activeAncient) {
    return (
      <BattleArena
        battle={battle}
        onChange={handleBattleChange}
        planOpponent={(state) => planAncientActions(state, "opponent")}
        onExit={() => { setBattle(null); setActiveAncient(null); }}
        exitLabel="Leave the encounter"
        eyebrowExtra="Ancient encounter"
      />
    );
  }

  const level = collector?.level ?? 1;

  return (
    <main className="min-h-screen bg-[#080b10] px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-orange-300">Ancient encounters</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">The Old Clay stirs</h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-400">Ancients fight alone against a full herd — and they do not consider that a disadvantage. Defeat one to earn 100 XP and a permanent badge.</p>
          {collector && (
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Collector Level {collector.level} · {collector.current}/{collector.needed} XP to next level</p>
          )}
        </header>

        {ANCIENTS.map((ancient) => {
          const unlocked = level >= ancient.unlockLevel;
          const beaten = defeated.includes(ancient.id);
          return (
            <section key={ancient.id} className={`rounded-2xl border p-6 ${unlocked ? "border-orange-400/30 bg-orange-400/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black">{ancient.name}</h2>
                    {beaten && <span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-300">Defeated</span>}
                    {!unlocked && <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-slate-400">Unlocks at Level {ancient.unlockLevel}</span>}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-300">{ancient.title}</p>
                  <p className="mt-3 text-sm text-slate-400">{ancient.lore}</p>
                  <p className="mt-3 text-xs text-slate-500">{ancient.herd.bond.benefit}</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p className="text-3xl font-black text-orange-300">{ancient.herd.members[0]?.ancient?.maxHP} HP</p>
                  <p>Strikes for {ancient.herd.members[0]?.ancient?.strikeDamage}</p>
                  <p className="mt-1">Round-cap survivor: the Ancient</p>
                </div>
              </div>

              {unlocked && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.22em] text-slate-400">Choose your herd</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {herds.map((herd) => {
                      const active = herd.id === playerHerd?.id;
                      return (
                        <button key={herd.id} onClick={() => setPlayerHerd(herd)} className={`rounded-2xl border p-4 text-left transition ${active ? "border-orange-300 bg-orange-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                          <div className="mb-3 flex -space-x-2">{herd.members.slice(0, 6).map((member) => <SpeciesToken key={member.id} member={member} />)}</div>
                          <h4 className="font-black">{herd.name}</h4>
                          <p className="text-xs text-slate-500">{herd.playStyle}</p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    disabled={!playerHerd}
                    onClick={() => {
                      if (!playerHerd) return;
                      setActiveAncient(ancient);
                      setBattle(createBattle(playerHerd, ancient.herd, Date.now() % 100000));
                    }}
                    className="mt-5 w-full rounded-xl bg-orange-400 px-6 py-3 font-black text-slate-950 hover:bg-orange-300 disabled:opacity-40"
                  >
                    Challenge {ancient.name}
                  </button>
                </div>
              )}
            </section>
          );
        })}

        <div className="mt-6 text-center text-sm text-slate-500">
          Need XP? <Link href="/battle" className="text-amber-300 hover:text-amber-200">Fight community battles</Link> (+10 played, +25 won) or <Link href="/deck" className="text-amber-300 hover:text-amber-200">publish a herd</Link> (+20).
        </div>
      </div>
    </main>
  );
}
