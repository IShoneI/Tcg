"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { demoWalletAddress, isDemoWalletEnabled } from "@/config/wallet";

export default function Home() {
  const { connected } = useWallet();
  return (
    <main className="min-h-screen overflow-hidden bg-[#080b10] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-6">
        <nav className="flex items-center justify-between"><span className="text-lg font-black tracking-tight">DINO<span className="text-amber-300">WARZ</span></span><div className="flex gap-2 text-sm"><Link href="/gallery" className="rounded-lg px-3 py-2 text-slate-400 hover:text-white">Collection</Link><Link href="/deck" className="rounded-lg px-3 py-2 text-slate-400 hover:text-white">Workshop</Link><Link href="/boss" className="rounded-lg px-3 py-2 text-orange-300 hover:text-orange-200">Ancients</Link></div></nav>
        <section className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.38em] text-amber-300">The herd is the hero</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-black leading-[0.92] tracking-[-0.055em] sm:text-7xl">Collect a herd.<br /><span className="text-slate-500">Become playable.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Collectors publish their matching Claynosaurz herds as complete fighters. Anyone can choose one, learn its signature build and lead it into a tactical battle.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/battle" className="rounded-xl bg-amber-300 px-6 py-3 font-black text-slate-950 hover:bg-amber-200">Choose a community herd</Link><Link href="/deck" className="rounded-xl border border-white/15 px-6 py-3 font-bold hover:bg-white/5">Publish my herd</Link></div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-600">{isDemoWalletEnabled ? <span>Read-only demo wallet · {demoWalletAddress.slice(0, 4)}…{demoWalletAddress.slice(-4)}</span> : connected ? <span>Wallet connected · ready to curate</span> : <WalletMultiButton />}</div>
          </div>
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute inset-8 rounded-full bg-amber-300/10 blur-3xl" />
            <div className="relative grid rotate-[-2deg] grid-cols-3 gap-3 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl">
              {["REX", "TRI", "STE", "ANK", "RAP", "BRO"].map((species, index) => <div key={species} className={`aspect-[3/4] rounded-xl border p-3 ${index === 1 ? "border-amber-300/50 bg-amber-300/10" : "border-white/10 bg-slate-950"}`}><span className="text-[10px] uppercase tracking-widest text-slate-500">Mastered</span><div className="grid h-full place-items-center text-xl font-black text-slate-300">{species}</div></div>)}
              <div className="col-span-3 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.26em] text-amber-300">Call of the Veterans ready</div>
            </div>
          </div>
        </section>
        <footer className="flex flex-wrap justify-between gap-3 border-t border-white/5 py-5 text-xs text-slate-600"><span>Non-commercial community prototype</span><span>Wallet assets remain untouched</span></footer>
      </div>
    </main>
  );
}
