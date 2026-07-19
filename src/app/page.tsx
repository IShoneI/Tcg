"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { demoWalletAddress, isDemoWalletEnabled } from "@/config/wallet";

export default function Home() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();

  // Auto-redirect to gallery when wallet connects
  useEffect(() => {
    if (isDemoWalletEnabled || (connected && publicKey)) {
      router.push("/gallery");
    }
  }, [connected, publicKey, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="font-display text-5xl sm:text-6xl font-bold mb-4 tracking-tight">
          NFT <span className="text-clay-400">TCG</span>
        </h1>
        <p className="text-lg text-gray-400 mb-2">
          Your NFTs are already cards. Now play them.
        </p>
        <p className="text-sm text-gray-500 mb-10">
          Connect your Phantom wallet to turn your Claynosaurz (or any
          collection) into battle-ready trading cards with stats generated from
          on-chain data.
        </p>

        {/* Wallet Connect */}
        <div className="flex flex-col items-center gap-4">
          {isDemoWalletEnabled ? (
            <button
              onClick={() => router.push("/gallery")}
              className="px-5 py-3 rounded-lg bg-clay-500 text-black font-semibold hover:bg-clay-400 transition-colors"
            >
              Open development gallery
            </button>
          ) : (
            <WalletMultiButton />
          )}
          {isDemoWalletEnabled && (
            <span className="text-xs text-amber-400">
              Demo wallet · read-only · {demoWalletAddress.slice(0, 4)}…{demoWalletAddress.slice(-4)}
            </span>
          )}
          {!connected && (
            <span className="text-xs text-gray-600">
              Phantom required · Mainnet only · Read-only access
            </span>
          )}
        </div>
      </div>

      {/* Feature pills */}
      <div className="mt-16 flex flex-wrap justify-center gap-3 max-w-lg">
        {[
          "Wallet → Cards",
          "On-chain stats",
          "Hold time bonuses",
          "Trait rarity",
          "Turn-based battles",
          "No minting",
        ].map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full text-xs font-medium
                       bg-white/5 text-gray-400 border border-white/10"
          >
            {tag}
          </span>
        ))}
      </div>
    </main>
  );
}
