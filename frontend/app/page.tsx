"use client";

import React, { useState } from "react";
import WalletConnect from "../components/WalletConnect";
import MainFeature from "../components/MainFeature";

export default function Home() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-50 relative overflow-hidden font-sans pb-16">
      {/* Decorative premium background grid & subtle glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <header className="border-b border-neutral-900 bg-neutral-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Minimalist Glowing Logo */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 21l-8.228-8.228A5.99 5.99 0 0112 4.228a5.99 5.99 0 018.228 8.544L12 21z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-extrabold tracking-widest text-neutral-100 uppercase font-sans">
                Stellar<span className="text-indigo-400">Hope</span>
              </span>
              <span className="block text-[9px] text-neutral-500 font-mono tracking-widest uppercase mt-[-2px]">
                Charity Tracker
              </span>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <span className="px-2.5 py-1 text-[10px] font-bold text-neutral-400 bg-neutral-900 border border-neutral-800 rounded-full tracking-wider uppercase">
              Stellar Testnet
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-10 w-full flex flex-col gap-6 relative z-10 flex-1">
        {/* Intro Hero Section */}
        <div className="text-center sm:text-left py-4">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-neutral-50 via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
            Transparent On-Chain Charity Tracker
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-2xl leading-relaxed">
            Empowering global philanthropy with complete visibility. NGOs register funding goals directly 
            to the Stellar Testnet ledger. Donors transfer XLM directly, audit logs are saved as blockchain events, and NGOs share milestone updates transparently.
          </p>
        </div>

        {/* Freighter Wallet Connect Component */}
        <WalletConnect
          publicKey={publicKey}
          setPublicKey={setPublicKey}
          onRefresh={handleRefresh}
        />

        {/* Dashboard and Contract Interactions Component */}
        <MainFeature
          publicKey={publicKey}
          refreshTrigger={refreshTrigger}
          onRefresh={handleRefresh}
        />
      </main>

      <footer className="border-t border-neutral-900 mt-20 pt-8 max-w-6xl mx-auto px-6 w-full text-center relative z-10">
        <p className="text-[10px] font-medium text-neutral-600 tracking-wider uppercase">
          Build for Stellar Global Impact Hackathon • Testnet Sandbox Mode Only
        </p>
      </footer>
    </div>
  );
}
