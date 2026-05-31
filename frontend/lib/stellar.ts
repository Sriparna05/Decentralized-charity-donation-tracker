import { isConnected, getAddress, signTransaction } from "@stellar/freighter-api";
import { Horizon, TransactionBuilder } from "@stellar/stellar-sdk";

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
}

export const getNetworkConfig = (): NetworkConfig => {
  return {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org",
  };
};

/**
 * Connect to Freighter extension and retrieve the active public key.
 */
export const getFreighterPublicKey = async (): Promise<string> => {
  if (typeof window === "undefined") {
    throw new Error("Window is undefined");
  }

  const connected = await isConnected();
  if (!connected) {
    throw new Error("Freighter browser extension not found. Please install Freighter from freighter.app");
  }

  try {
    const result = await getAddress();
    if (result.error) {
      throw new Error(result.error);
    }
    if (!result.address) {
      throw new Error("Could not retrieve public key. Please unlock Freighter and authorize access.");
    }
    return result.address;
  } catch (error: any) {
    throw new Error(error.message || "Failed to retrieve public key from Freighter");
  }
};

/**
 * Funds the provided public key using Friendbot (Testnet XLM faucet).
 */
export const fundWithFriendbot = async (publicKey: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
    if (response.ok) {
      return true;
    }
    const errText = await response.text();
    throw new Error(errText || "Friendbot funding failed");
  } catch (error: any) {
    throw new Error(error.message || "Failed to call Friendbot");
  }
};

/**
 * Sign a transaction XDR with Freighter and submit it to the Testnet Horizon endpoint.
 */
export const signAndSubmitTransaction = async (xdr: string): Promise<string> => {
  const { horizonUrl, networkPassphrase } = getNetworkConfig();
  const server = new Horizon.Server(horizonUrl);

  let signedXdr: string;
  try {
    const signedResult = await signTransaction(xdr, {
      networkPassphrase,
    }) as any;

    if (signedResult.error) {
      throw new Error(signedResult.error);
    }
    
    if (!signedResult.signedTxXdr) {
      throw new Error("No signed transaction XDR returned from Freighter.");
    }
    
    signedXdr = signedResult.signedTxXdr;
  } catch (error: any) {
    throw new Error(error.message || "Transaction signing with Freighter failed or was rejected");
  }

  try {
    const transaction = (TransactionBuilder as any).fromXDR(signedXdr, networkPassphrase);
    const txResponse = await server.submitTransaction(transaction);
    return txResponse.hash;
  } catch (error: any) {
    console.error("Submission failed details:", error);
    
    // Attempt to extract detailed reason from Horizon result codes
    const resultCodes = (error as any).response?.data?.extras?.result_codes;
    if (resultCodes) {
      const opResult = resultCodes.operations?.[0] || resultCodes.transaction;
      throw new Error(`Transaction failed: ${opResult}`);
    }
    
    const detail = (error as any).response?.data?.detail;
    throw new Error(detail || "Transaction submission failed. Make sure your account has enough XLM.");
  }
};
