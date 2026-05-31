"use client";

import React, { useState, useEffect } from "react";
import { getFreighterPublicKey, fundWithFriendbot } from "../lib/stellar";

interface WalletConnectProps {
  publicKey: string;
  setPublicKey: (key: string) => void;
  onRefresh: () => void;
}

export default function WalletConnect({ publicKey, setPublicKey, onRefresh }: WalletConnectProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [funding, setFunding] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Check if wallet is already connected/authorized
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // We only pre-fetch if Freighter is unlocked, so we don't annoy the user with prompts
        const activeKey = await getFreighterPublicKey();
        if (activeKey) {
          setPublicKey(activeKey);
        }
      } catch (err) {
        // Silently fail on load (e.g. if user is not unlocked)
      }
    };
    checkConnection();
  }, [setPublicKey]);

  const handleConnect = async () => {
    setLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const activeKey = await getFreighterPublicKey();
      setPublicKey(activeKey);
      setSuccessMsg("Freighter connected successfully.");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to connect Freighter.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setPublicKey("");
    setError("");
    setSuccessMsg("");
  };

  const handleGetXLM = async () => {
    if (!publicKey) return;
    setFunding(true);
    setError("");
    setSuccessMsg("");
    try {
      const success = await fundWithFriendbot(publicKey);
      if (success) {
        setSuccessMsg("10,000 Testnet XLM credited to your account! Horizon may take a few seconds to update.");
        onRefresh();
      }
    } catch (err: any) {
      setError(err.message || "Failed to fund account via Friendbot.");
    } finally {
      setFunding(false);
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 5)}...${addr.slice(-5)}`;
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-xl w-full">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${publicKey ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.6)]" : "bg-neutral-600"}`} />
        <div>
          <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">Stellar Network Status</h2>
          {publicKey ? (
            <p className="text-sm font-medium text-neutral-100 font-mono mt-0.5 select-all">
              {truncateAddress(publicKey)}
            </p>
          ) : (
            <p className="text-sm font-medium text-neutral-500 mt-0.5">Wallet Not Connected</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {publicKey ? (
          <>
            <button
              onClick={handleGetXLM}
              disabled={funding}
              className="px-4 py-2 text-xs font-semibold text-indigo-400 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-900/50 hover:border-indigo-700/60 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_10px_rgba(99,102,241,0.05)]"
            >
              {funding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-3 w-3 text-indigo-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Funding...
                </span>
              ) : (
                "Get Testnet XLM"
              )}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800 hover:bg-neutral-700/80 border border-neutral-700 rounded-xl transition duration-300"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl transition duration-300 shadow-[0_4px_20px_rgba(99,102,241,0.3)] disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02]"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              "Connect Freighter Wallet"
            )}
          </button>
        )}
      </div>

      {/* Global alert feedback underneath if needed */}
      {(error || successMsg) && (
        <div className="w-full mt-3 pt-3 border-t border-neutral-800/80 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-xl">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-xl animate-fade-in">
              {successMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
