import {
  Contract,
  rpc,
  TransactionBuilder,
  Account,
  scValToNative,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { getNetworkConfig, getFreighterPublicKey, signAndSubmitTransaction } from "./stellar";

// The contract ID on Testnet
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

// Conversion factor: 1 XLM = 10,000,000 stroops
export const XLM_TO_STROOPS = 10_000_000;

export interface Campaign {
  id: number;
  ngo: string;
  wallet: string;
  title: string;
  description: string;
  goal: string; // formatted as XLM string
  funded: string; // formatted as XLM string
}

export interface ImpactUpdate {
  campaignId: number;
  text: string;
  timestamp: number; // unix timestamp
}

export interface DonationRecord {
  donor: string;
  campaignId: number;
  amount: string; // formatted as XLM string
  timestamp: number;
}

const getContractInstance = (): Contract => {
  if (!CONTRACT_ID) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ID environment variable is not defined");
  }
  return new Contract(CONTRACT_ID);
};

/**
 * Helper to build a transaction and simulate it for read-only contract calls.
 */
const simulateCall = async (methodName: string, args: xdr.ScVal[] = []): Promise<any> => {
  const { rpcUrl, networkPassphrase } = getNetworkConfig();
  const server = new rpc.Server(rpcUrl);
  const contract = getContractInstance();

  // Create a dummy source account to build the transaction
  const dummyPublicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const dummyAccount = new Account(dummyPublicKey, "0");

  const transaction = new TransactionBuilder(dummyAccount, {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(contract.call(methodName, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (rpc.Api.isSimulationSuccess(simulation)) {
    if (simulation.result?.retval) {
      return scValToNative(simulation.result.retval);
    }
    return null;
  }

  throw new Error(`Simulation of ${methodName} failed: ${simulation.error || "Unknown error"}`);
};

/**
 * Helper to assemble, simulate, sign and submit a write transaction.
 */
const writeCall = async (methodName: string, args: xdr.ScVal[]): Promise<string> => {
  const { rpcUrl, networkPassphrase } = getNetworkConfig();
  const server = new rpc.Server(rpcUrl);
  const contract = getContractInstance();

  // 1. Get connected public key from Freighter
  const publicKey = await getFreighterPublicKey();

  // 2. Fetch source account details from network
  let account: Account;
  try {
    account = await server.getAccount(publicKey);
  } catch (error) {
    throw new Error("Your account was not found on the Stellar Testnet. Please fund it first using the 'Get Testnet XLM' button.");
  }
  // 3. Build initial transaction
  const transaction = new TransactionBuilder(account, {
    fee: "100000", // baseline fee, will be optimized by simulation
    networkPassphrase,
  })
    .addOperation(contract.call(methodName, ...args))
    .setTimeout(30)
    .build();

  // 4. Simulate transaction to calculate fees and resource footprint
  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation error: ${simulation.error}`);
  }

  // 5. Assemble transaction with footprints and fees
  const assembledTransaction = rpc.assembleTransaction(transaction, simulation) as any;

  // 6. Sign transaction via Freighter and submit to Testnet
  const xdrBase64 = assembledTransaction.toEnvelope().toXDR("base64");
  const txHash = await signAndSubmitTransaction(xdrBase64);
  return txHash;
};

/* --- READ METHODS --- */

export const getCampaignCount = async (): Promise<number> => {
  try {
    const count = await simulateCall("get_campaign_count");
    return Number(count || 0);
  } catch (error) {
    console.error("Error fetching campaign count:", error);
    return 0;
  }
};

export const getCampaign = async (campaignId: number): Promise<Campaign> => {
  const rawCampaign = await simulateCall("get_campaign", [
    nativeToScVal(campaignId, { type: "u32" }),
  ]);

  return {
    id: Number(rawCampaign.id),
    ngo: rawCampaign.ngo,
    wallet: rawCampaign.wallet,
    title: rawCampaign.title.toString(),
    description: rawCampaign.description.toString(),
    goal: (Number(rawCampaign.goal) / XLM_TO_STROOPS).toString(),
    funded: (Number(rawCampaign.funded) / XLM_TO_STROOPS).toString(),
  };
};

export const getCampaigns = async (start: number = 1, limit: number = 50): Promise<Campaign[]> => {
  try {
    const rawCampaigns = await simulateCall("get_campaigns", [
      nativeToScVal(start, { type: "u32" }),
      nativeToScVal(limit, { type: "u32" }),
    ]);

    if (!rawCampaigns || !Array.isArray(rawCampaigns)) {
      return [];
    }

    return rawCampaigns.map((raw: any) => ({
      id: Number(raw.id),
      ngo: raw.ngo,
      wallet: raw.wallet,
      title: raw.title.toString(),
      description: raw.description.toString(),
      goal: (Number(raw.goal) / XLM_TO_STROOPS).toString(),
      funded: (Number(raw.funded) / XLM_TO_STROOPS).toString(),
    }));
  } catch (error) {
    console.error("Error fetching campaigns list:", error);
    return [];
  }
};

export const getImpactUpdates = async (campaignId: number): Promise<ImpactUpdate[]> => {
  try {
    const rawUpdates = await simulateCall("get_impact_updates", [
      nativeToScVal(campaignId, { type: "u32" }),
    ]);

    if (!rawUpdates || !Array.isArray(rawUpdates)) {
      return [];
    }

    return rawUpdates.map((raw: any) => ({
      campaignId: Number(raw.campaign_id),
      text: raw.text.toString(),
      timestamp: Number(raw.timestamp),
    }));
  } catch (error) {
    console.error(`Error fetching impact updates for campaign ${campaignId}:`, error);
    return [];
  }
};

/* --- WRITE METHODS --- */

/**
 * Initializes the contract. Call this once after deploying the contract.
 * @param tokenAddress The Stellar native token (XLM) contract address.
 * On Testnet, this is CDLZFC3SYJYDZT7K67VZ75HPJSIZ27F6GBDG4K7K5BGBB7565EUXT6IB
 */
export const initializeContract = async (tokenAddress: string): Promise<string> => {
  return writeCall("initialize", [
    nativeToScVal(tokenAddress, { type: "address" }),
  ]);
};

/**
 * Creates a new Charity Campaign.
 */
export const createCampaign = async (
  ngoAddress: string,
  title: string,
  description: string,
  goalXlm: number,
  campaignWallet: string
): Promise<string> => {
  const goalStroops = Math.round(goalXlm * XLM_TO_STROOPS);

  return writeCall("create_campaign", [
    nativeToScVal(ngoAddress, { type: "address" }),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    nativeToScVal(goalStroops, { type: "i128" }),
    nativeToScVal(campaignWallet, { type: "address" }),
  ]);
};

/**
 * Donates XLM to a campaign on-chain.
 */
export const donateToCampaign = async (
  donorAddress: string,
  campaignId: number,
  amountXlm: number
): Promise<string> => {
  const amountStroops = Math.round(amountXlm * XLM_TO_STROOPS);

  return writeCall("donate", [
    nativeToScVal(donorAddress, { type: "address" }),
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
};

/**
 * NGO publishes a milestone/impact update.
 */
export const postImpactUpdate = async (
  ngoAddress: string,
  campaignId: number,
  updateText: string
): Promise<string> => {
  return writeCall("post_impact_update", [
    nativeToScVal(ngoAddress, { type: "address" }),
    nativeToScVal(campaignId, { type: "u32" }),
    nativeToScVal(updateText, { type: "string" }),
  ]);
};

/**
 * Query donation events for campaigns from Soroban RPC or Horizon events log.
 * Provides real-time transparency of donors and amount.
 */
export const getDonationHistory = async (campaignId?: number): Promise<DonationRecord[]> => {
  const { rpcUrl } = getNetworkConfig();
  const server = new rpc.Server(rpcUrl);

  try {
    // Query events from ledger (within last 10000 ledgers)
    const ledgerInfo = await server.getLatestLedger();
    const startLedger = Math.max(0, ledgerInfo.sequence - 10000);

    const response = await server.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [CONTRACT_ID],
          topics: [
            // Matches topic 1 (donated symbol)
            [xdr.ScVal.scvSymbol("donated").toXDR("base64")]
          ]
        }
      ],
      limit: 100
    });

    if (!response.events) return [];

    return response.events.map((evt) => {
      const topics = evt.topic.map((t: any) => {
        try {
          if (typeof t === "string") {
            return scValToNative(xdr.ScVal.fromXDR(t, "base64"));
          }
          return scValToNative(t);
        } catch {
          return scValToNative(t as any);
        }
      });

      const value = (() => {
        try {
          if (typeof evt.value === "string") {
            return scValToNative(xdr.ScVal.fromXDR(evt.value, "base64"));
          }
          if ((evt.value as any).xdr) {
            return scValToNative(xdr.ScVal.fromXDR((evt.value as any).xdr, "base64"));
          }
          return scValToNative(evt.value as any);
        } catch {
          return scValToNative(evt.value as any);
        }
      })();

      // topic[0] = symbol("donated"), topic[1] = campaign_id, topic[2] = donor (address)
      const eventCampaignId = Number(topics[1]);
      const donor = topics[2] as string;

      // payload: value[0] = amount (stroops), value[1] = timestamp
      const amountStroops = Number(value[0]);
      const timestamp = Number(value[1]);

      return {
        donor,
        campaignId: eventCampaignId,
        amount: (amountStroops / XLM_TO_STROOPS).toString(),
        timestamp
      };
    })
    .filter((record) => campaignId === undefined || record.campaignId === campaignId)
    .sort((a, b) => b.timestamp - a.timestamp); // newest first
  } catch (error) {
    console.error("Failed to fetch donation events history:", error);
    return [];
  }
};
