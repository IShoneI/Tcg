"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { COLLECTIONS, useGameStore } from "@/store/gameStore";
import { demoWalletAddress } from "@/config/wallet";
import {
  applyClass,
  buildHerdBond,
  buildSignatureDeck,
  createClassState,
  FORMAT_SPECIES,
  isVeteranLineup,
  SPECIES_STATS,
  validateHerd,
} from "@/engine/herdRules";
import { savePublishedHerd } from "@/services/herdStorage";
import type { NFTCard } from "@/types/card";
import type { HerdMember, PublishedHerd, Species } from "@/types/herd";

const CORE = FORMAT_SPECIES["core-six"];

export default function HerdWorkshopPage() {
  const {
    cards,
    activeCollection,
    setActiveCollection,
    loadCards,
    isLoadingCards,
    loadError,
    lastFetchedAt,
  } = useGameStore();
  const [collectorName, setCollectorName] = useState("My Collector Profile");
  const [herdName, setHerdName] = useState("My Core Six");
  const [bondKind, setBondKind] = useState<"skin" | "colour">("skin");
  const [selected, setSelected] = useState<Partial<Record<Species, string>>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const claynosaurz = COLLECTIONS[0];
    if (activeCollection.slug !== claynosaurz.slug) {
      setActiveCollection(claynosaurz);
      return;
    }
    if (!lastFetchedAt && !isLoadingCards && !loadError) {
      void loadCards(demoWalletAddress);
    }
  }, [
    activeCollection.slug,
    isLoadingCards,
    lastFetchedAt,
    loadCards,
    loadError,
    setActiveCollection,
  ]);

  const bySpecies = useMemo(() => {
    const result = new Map<Species, NFTCard[]>();
    for (const species of CORE) result.set(species, []);
    for (const card of cards) {
      const species = attr(card, "Species") as Species | undefined;
      if (species && result.has(species)) result.get(species)?.push(card);
    }
    return result;
  }, [cards]);

  useEffect(() => {
    setSelected((current) => {
      const next = { ...current };
      for (const species of CORE) next[species] ??= bySpecies.get(species)?.[0]?.id;
      return next;
    });
  }, [bySpecies]);

  const previewMembers = useMemo(
    () => CORE.map((species) => bySpecies.get(species)?.find((card) => card.id === selected[species])).filter((card): card is NFTCard => Boolean(card)).map(toMember),
    [bySpecies, selected]
  );

  const publish = () => {
    setMessage(null);
    if (previewMembers.length !== CORE.length) {
      setMessage({ ok: false, text: "A Core Six herd needs one Rex, Trice, Stego, Ankylo, Raptor and Bronto." });
      return;
    }
    try {
      const id = `local-${slug(collectorName)}-${slug(herdName)}`;
      const bond = buildHerdBond(previewMembers, bondKind);
      const build = { ...buildSignatureDeck(previewMembers, "core-six"), publishedAt: new Date().toISOString() };
      const herd: PublishedHerd = {
        id,
        slug: id,
        name: herdName.trim() || "Untitled Herd",
        collectorName: collectorName.trim() || "Anonymous Collector",
        description: `${bond.value}-matched Core Six herd, published from this browser.`,
        bannerColour: bondKind === "skin" ? "#f59e0b" : "#38bdf8",
        format: "core-six",
        members: previewMembers,
        bond,
        build,
        usage: { selections: 0, uniquePilots: 0, favourites: 0 },
        isVeteranHerd: isVeteranLineup(previewMembers),
        playStyle: "Collector signature build",
      };
      const errors = validateHerd(herd);
      if (errors.length) throw new Error(errors.join(" "));
      savePublishedHerd(herd);
      setMessage({ ok: true, text: `${herd.name} is published locally and ready on the battle-select screen.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "The herd could not be published." });
    }
  };

  return (
    <main className="min-h-screen bg-[#080b10] px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.32em] text-amber-300">Collector tools</p><h1 className="mt-2 text-4xl font-black">Herd Workshop</h1><p className="mt-2 max-w-2xl text-slate-400">Curate one NFT from each Core Six species, preserve permanent classes and publish an owner-signature build for community play.</p></div>
          <Link href="/battle" className="rounded-xl bg-amber-300 px-5 py-3 font-bold text-slate-950">Open herd select</Link>
        </header>

        {cards.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6">
            <h2 className="text-xl font-bold">Load a wallet herd first</h2>
            <p className="mt-2 text-sm text-slate-400">The workshop uses the Claynosaurz already verified by the gallery. Open the collection, let it finish loading, then return here.</p>
            <Link href="/gallery" className="mt-4 inline-block rounded-lg border border-amber-300/30 px-4 py-2 text-sm text-amber-300">Open collection gallery</Link>
          </div>
        ) : (
          <>
            <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-3">
              <label className="text-sm text-slate-400">Collector name<input value={collectorName} onChange={(event) => setCollectorName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
              <label className="text-sm text-slate-400">Herd name<input value={herdName} onChange={(event) => setHerdName(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100" /></label>
              <label className="text-sm text-slate-400">Herd Bond<select value={bondKind} onChange={(event) => setBondKind(event.target.value as "skin" | "colour")} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"><option value="skin">Matching Skin</option><option value="colour">Matching Colour</option></select></label>
            </section>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CORE.map((species) => {
                const choices = bySpecies.get(species) ?? [];
                const chosen = choices.find((card) => card.id === selected[species]);
                return (
                  <article key={species} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                    <div className="aspect-[16/10] bg-slate-900">{chosen?.image ? <img src={chosen.image} alt={chosen.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-4xl font-black text-slate-700">{species.slice(0, 2)}</div>}</div>
                    <div className="p-4"><div className="mb-2 flex items-center justify-between"><h2 className="font-black">{species}</h2><span className="text-xs text-slate-500">{choices.length} owned</span></div><select value={selected[species] ?? ""} onChange={(event) => setSelected((current) => ({ ...current, [species]: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm" disabled={!choices.length}><option value="">No eligible NFT</option>{choices.map((card) => <option key={card.id} value={card.id}>{card.name} · {attr(card, "Class") || "Provisional"}</option>)}</select>{chosen && <p className="mt-2 text-xs text-slate-500">{attr(chosen, "Skin")} Skin · {attr(chosen, "Color")} Colour · {attr(chosen, "Class") || "Class choice available"}</p>}</div>
                  </article>
                );
              })}
            </section>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Publish this Core Six</h2><p className="text-sm text-slate-500">{previewMembers.filter((member) => member.classState.source === "on-chain").length}/{CORE.length} permanently classed · {previewMembers.length}/{CORE.length} species selected</p></div><button onClick={publish} className="rounded-xl bg-amber-300 px-6 py-3 font-black text-slate-950">Publish locally</button></div>
              {message && <p className={`mt-4 rounded-lg p-3 text-sm ${message.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{message.text}</p>}
              <p className="mt-4 text-xs text-slate-600">Prototype publishing is stored only in this browser. Server profiles, wallet signatures and periodic ownership revalidation are the next production layer.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function toMember(card: NFTCard): HerdMember {
  const species = (attr(card, "Species") || "Rex") as Species;
  const onChainClass = attr(card, "Class");
  const classState = createClassState(species, onChainClass);
  return {
    id: card.id,
    name: card.nickname || card.name,
    image: card.image,
    species,
    skin: attr(card, "Skin") || "Unknown",
    colour: attr(card, "Color") || "Unknown",
    mood: attr(card, "Mood"),
    motion: attr(card, "Motion"),
    background: attr(card, "Background"),
    layerCount: Number(attr(card, "Layer Count") || 0),
    classState,
    stats: applyClass(SPECIES_STATS[species], classState.className),
  };
}

function attr(card: NFTCard, name: string): string {
  return String(card.attributes.find((attribute) => attribute.trait_type.toLowerCase() === name.toLowerCase())?.value ?? "").trim();
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "herd";
}

