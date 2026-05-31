"use client";

import React, { useState, useEffect } from "react";
import {
  getCampaigns,
  createCampaign,
  donateToCampaign,
  postImpactUpdate,
  getImpactUpdates,
  getDonationHistory,
  Campaign,
  ImpactUpdate,
  DonationRecord,
  XLM_TO_STROOPS
} from "../lib/contract";

interface MainFeatureProps {
  publicKey: string;
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function MainFeature({ publicKey, refreshTrigger, onRefresh }: MainFeatureProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [globalHistory, setGlobalHistory] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"campaigns" | "create" | "stream">("campaigns");

  // Campaign specific interactive states
  const [donationAmounts, setDonationAmounts] = useState<{ [id: number]: string }>({});
  const [donatingIds, setDonatingIds] = useState<{ [id: number]: boolean }>({});
  const [impactTexts, setImpactTexts] = useState<{ [id: number]: string }>({});
  const [postingIds, setPostingIds] = useState<{ [id: number]: boolean }>({});
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [campaignUpdates, setCampaignUpdates] = useState<{ [id: number]: ImpactUpdate[] }>({});
  const [campaignDonations, setCampaignDonations] = useState<{ [id: number]: DonationRecord[] }>({});

  // Registration states
  const [regTitle, setRegTitle] = useState<string>("");
  const [regDesc, setRegDesc] = useState<string>("");
  const [regGoal, setRegGoal] = useState<string>("");
  const [regWallet, setRegWallet] = useState<string>("");
  const [registering, setRegistering] = useState<boolean>(false);

  // Global action status
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Load campaigns and global donation log
  const loadData = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const allCampaigns = await getCampaigns(1, 50);
      setCampaigns(allCampaigns);

      const history = await getDonationHistory();
      setGlobalHistory(history);

      // Pre-fill campaign details if selected
      if (selectedCampaign !== null) {
        await loadCampaignDetails(selectedCampaign);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        text: err.message || "Failed to load campaigns from Stellar network.",
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignDetails = async (campaignId: number) => {
    try {
      const [updates, donations] = await Promise.all([
        getImpactUpdates(campaignId),
        getDonationHistory(campaignId)
      ]);
      setCampaignUpdates(prev => ({ ...prev, [campaignId]: updates }));
      setCampaignDonations(prev => ({ ...prev, [campaignId]: donations }));
    } catch (err) {
      console.error("Failed to load details for campaign:", campaignId, err);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleSelectCampaign = async (id: number) => {
    if (selectedCampaign === id) {
      setSelectedCampaign(null);
    } else {
      setSelectedCampaign(id);
      await loadCampaignDetails(id);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      setStatusMsg({ text: "Please connect your Freighter wallet first.", isError: true });
      return;
    }
    if (!regTitle || !regDesc || !regGoal || !regWallet) {
      setStatusMsg({ text: "Please fill in all campaign registration fields.", isError: true });
      return;
    }

    const goalNum = parseFloat(regGoal);
    if (isNaN(goalNum) || goalNum <= 0) {
      setStatusMsg({ text: "Funding goal must be a valid positive number.", isError: true });
      return;
    }

    setRegistering(true);
    setStatusMsg(null);

    try {
      const txHash = await createCampaign(publicKey, regTitle, regDesc, goalNum, regWallet);
      setStatusMsg({
        text: `Campaign successfully registered! Tx Hash: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
        isError: false,
      });
      // Clear forms
      setRegTitle("");
      setRegDesc("");
      setRegGoal("");
      setRegWallet("");
      setActiveTab("campaigns");
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        text: err.message || "Failed to register campaign on the Stellar network.",
        isError: true,
      });
    } finally {
      setRegistering(false);
    }
  };

  // Donate XLM
  const handleDonate = async (campaignId: number) => {
    if (!publicKey) {
      setStatusMsg({ text: "Please connect your Freighter wallet to contribute.", isError: true });
      return;
    }

    const amountStr = donationAmounts[campaignId];
    const amountVal = parseFloat(amountStr);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert("Please enter a valid donation amount.");
      return;
    }

    setDonatingIds(prev => ({ ...prev, [campaignId]: true }));
    setStatusMsg(null);

    try {
      const txHash = await donateToCampaign(publicKey, campaignId, amountVal);
      setStatusMsg({
        text: `Thank you! Donated ${amountVal} XLM successfully. Tx Hash: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
        isError: false,
      });
      setDonationAmounts(prev => ({ ...prev, [campaignId]: "" }));
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        text: err.message || "Donation failed. Check your wallet balance or Freighter network.",
        isError: true,
      });
    } finally {
      setDonatingIds(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  // Post Impact Update
  const handlePostUpdate = async (campaignId: number) => {
    if (!publicKey) {
      setStatusMsg({ text: "Connect your Freighter wallet to post updates.", isError: true });
      return;
    }

    const text = impactTexts[campaignId];
    if (!text || text.trim() === "") {
      alert("Please enter an update text.");
      return;
    }

    setPostingIds(prev => ({ ...prev, [campaignId]: true }));
    setStatusMsg(null);

    try {
      const txHash = await postImpactUpdate(publicKey, campaignId, text);
      setStatusMsg({
        text: `Impact update posted successfully! Tx Hash: ${txHash.slice(0, 8)}...${txHash.slice(-8)}`,
        isError: false,
      });
      setImpactTexts(prev => ({ ...prev, [campaignId]: "" }));
      // Reload details for this campaign
      await loadCampaignDetails(campaignId);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        text: err.message || "Failed to post impact update. Only the NGO wallet can update this campaign.",
        isError: true,
      });
    } finally {
      setPostingIds(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full mt-4">
      {/* Navigation tabs */}
      <div className="flex border-b border-neutral-800">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 ${
            activeTab === "campaigns"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Active Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 ${
            activeTab === "create"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Register Campaign (NGO)
        </button>
        <button
          onClick={() => setActiveTab("stream")}
          className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all duration-300 border-b-2 ${
            activeTab === "stream"
              ? "border-indigo-500 text-indigo-400 font-bold"
              : "border-transparent text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Donation Stream ({globalHistory.length})
        </button>
      </div>

      {/* Global Status Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs leading-relaxed animate-fade-in ${
            statusMsg.isError
              ? "bg-rose-950/30 border-rose-900/50 text-rose-300"
              : "bg-emerald-950/30 border-emerald-900/50 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusMsg.isError ? "bg-rose-500" : "bg-emerald-500"}`} />
            <p className="font-semibold">{statusMsg.isError ? "Action Failed" : "Action Succeeded"}</p>
          </div>
          <p className="mt-1.5 font-mono">{statusMsg.text}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest">
            Synchronizing with Stellar Testnet Ledger...
          </p>
        </div>
      ) : (
        <>
          {/* TAB 1: Campaigns */}
          {activeTab === "campaigns" && (
            <div className="grid grid-cols-1 gap-6">
              {campaigns.length === 0 ? (
                <div className="text-center py-16 bg-neutral-900/30 border border-neutral-800/80 rounded-2xl">
                  <p className="text-sm text-neutral-400">No campaigns registered on this contract yet.</p>
                  <button
                    onClick={() => setActiveTab("create")}
                    className="mt-4 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition duration-300"
                  >
                    Be the first NGO to register
                  </button>
                </div>
              ) : (
                campaigns.map((c) => {
                  const goalVal = parseFloat(c.goal);
                  const fundedVal = parseFloat(c.funded);
                  const percent = Math.min(100, Math.round((fundedVal / (goalVal || 1)) * 100));

                  return (
                    <div
                      key={c.id}
                      className="bg-neutral-900/40 border border-neutral-800/60 hover:border-neutral-700/80 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl group"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-neutral-800 text-neutral-400 rounded">
                              ID: {c.id}
                            </span>
                            <h3 className="text-base font-semibold text-neutral-100 group-hover:text-indigo-400 transition-colors duration-300">
                              {c.title}
                            </h3>
                          </div>
                          <p className="text-xs text-neutral-400 mt-2 leading-relaxed max-w-2xl">
                            {c.description}
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-[11px] text-neutral-500 font-mono">
                            <p>
                              <span className="text-neutral-400 font-medium">NGO:</span> {c.ngo.slice(0, 6)}...{c.ngo.slice(-6)}
                            </p>
                            <p>
                              <span className="text-neutral-400 font-medium">Payout:</span> {c.wallet.slice(0, 6)}...{c.wallet.slice(-6)}
                            </p>
                          </div>
                        </div>

                        {/* Direct Contribution Box */}
                        <div className="flex items-center gap-2 p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl self-start md:self-auto min-w-[240px]">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Amount XLM"
                            value={donationAmounts[c.id] || ""}
                            onChange={(e) =>
                              setDonationAmounts({ ...donationAmounts, [c.id]: e.target.value })
                            }
                            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-600/50 w-full"
                          />
                          <button
                            onClick={() => handleDonate(c.id)}
                            disabled={donatingIds[c.id]}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition duration-200 disabled:opacity-50 min-w-[80px]"
                          >
                            {donatingIds[c.id] ? "Sending..." : "Donate"}
                          </button>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-6">
                        <div className="flex justify-between text-xs font-semibold font-mono text-neutral-400 mb-2">
                          <span>{c.funded} XLM Raised</span>
                          <span>{percent}% ({c.goal} XLM Goal)</span>
                        </div>
                        <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                          <div
                            className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanding details for History & NGO Impact Updates */}
                      <div className="mt-4 border-t border-neutral-900/60 pt-4">
                        <button
                          onClick={() => handleSelectCampaign(c.id)}
                          className="text-xs font-semibold text-indigo-400/90 hover:text-indigo-300 transition-colors flex items-center gap-1"
                        >
                          <span>{selectedCampaign === c.id ? "Hide details" : "View donor logs & milestone updates"}</span>
                          <svg
                            className={`h-3 w-3 transition-transform duration-300 ${
                              selectedCampaign === c.id ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {selectedCampaign === c.id && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 p-4 bg-neutral-950/40 rounded-xl border border-neutral-800/40 animate-slide-down">
                            {/* Donation Log (Events) */}
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3 border-b border-neutral-800 pb-1.5">
                                Campaign Donors
                              </h4>
                              {(!campaignDonations[c.id] || campaignDonations[c.id].length === 0) ? (
                                <p className="text-xs text-neutral-500 italic">No donations logged yet.</p>
                              ) : (
                                <ul className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 text-xs font-mono">
                                  {campaignDonations[c.id].map((log, index) => (
                                    <li
                                      key={index}
                                      className="flex items-center justify-between p-2 bg-neutral-900/30 border border-neutral-900 rounded-lg"
                                    >
                                      <span className="text-neutral-400">
                                        {log.donor.slice(0, 5)}...{log.donor.slice(-5)}
                                      </span>
                                      <span className="text-indigo-400 font-bold">+{log.amount} XLM</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* Impact Update Feed */}
                            <div className="flex flex-col">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3 border-b border-neutral-800 pb-1.5">
                                Impact & Milestones Feed
                              </h4>
                              
                              {/* NGO Action Box to add milestone (shown only if Freighter connected matches NGO) */}
                              {publicKey === c.ngo && (
                                <div className="flex gap-2 mb-3 bg-neutral-900/50 border border-neutral-800 p-2 rounded-lg">
                                  <input
                                    type="text"
                                    placeholder="NGO: Post milestone update..."
                                    value={impactTexts[c.id] || ""}
                                    onChange={(e) =>
                                      setImpactTexts({ ...impactTexts, [c.id]: e.target.value })
                                    }
                                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-indigo-600/40 w-full"
                                  />
                                  <button
                                    onClick={() => handlePostUpdate(c.id)}
                                    disabled={postingIds[c.id]}
                                    className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition duration-200 disabled:opacity-50 min-w-[70px]"
                                  >
                                    {postingIds[c.id] ? "Saving..." : "Post"}
                                  </button>
                                </div>
                              )}

                              {(!campaignUpdates[c.id] || campaignUpdates[c.id].length === 0) ? (
                                <p className="text-xs text-neutral-500 italic">No milestone updates posted.</p>
                              ) : (
                                <div className="flex flex-col gap-2.5 max-h-[160px] overflow-y-auto pr-1">
                                  {campaignUpdates[c.id].map((update, index) => (
                                    <div
                                      key={index}
                                      className="p-3 bg-neutral-900/40 border border-neutral-900 rounded-lg text-xs leading-relaxed"
                                    >
                                      <p className="text-neutral-200">{update.text}</p>
                                      <span className="text-[10px] text-neutral-500 block mt-1.5 font-mono">
                                        {new Date(update.timestamp * 1000).toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: NGO Campaign Registration Form */}
          {activeTab === "create" && (
            <div className="max-w-xl mx-auto w-full bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 md:p-8">
              <h3 className="text-lg font-semibold text-neutral-100 mb-6">NGO Campaign Registration</h3>
              <form onSubmit={handleCreateCampaign} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Campaign Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Save the Forest Reserves"
                    value={regTitle}
                    onChange={(e) => setRegTitle(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Description
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide details on the campaign, milestones, and fund allocations..."
                    value={regDesc}
                    onChange={(e) => setRegDesc(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Funding Goal (XLM)
                    </label>
                    <input
                      type="number"
                      step="1"
                      required
                      placeholder="e.g. 500"
                      value={regGoal}
                      onChange={(e) => setRegGoal(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Payout Wallet Address
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Stellar Public Key"
                      value={regWallet}
                      onChange={(e) => setRegWallet(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-neutral-100 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition duration-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={registering}
                  className="mt-4 w-full py-3 text-xs font-semibold uppercase tracking-widest text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl transition duration-300 hover:scale-[1.01] active:scale-95 shadow-lg shadow-indigo-600/10 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {registering ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deploying Campaign to Ledger...
                    </>
                  ) : (
                    "Register On-Chain"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Global Donation stream */}
          {activeTab === "stream" && (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6">
              <h3 className="text-base font-semibold text-neutral-100 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                Live Donation Stream (Testnet Contract Events)
              </h3>
              {globalHistory.length === 0 ? (
                <div className="text-center py-12 text-xs text-neutral-500 italic">
                  No direct donation events logs found in recent ledger entries.
                </div>
              ) : (
                <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
                  {globalHistory.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 bg-neutral-950/40 border border-neutral-850 hover:border-neutral-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 font-mono rounded">
                          Campaign {item.campaignId}
                        </span>
                        <p className="text-neutral-300 font-mono">
                          Donor: {item.donor.slice(0, 6)}...{item.donor.slice(-6)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <span className="text-emerald-400 font-bold text-sm">+{item.amount} XLM</span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(item.timestamp * 1000).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
