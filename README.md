# Stellar Hope — Decentralized Charity Donation Tracker

Stellar Hope is a fully transparent, decentralized charity donation platform built on the Stellar Testnet. It addresses the lack of trust and traceability in traditional NGO fundraising by logging every single donation transaction on-chain as immutable contract events and performing direct, peer-to-peer XLM token transfers from donors directly to the NGO's specified payout wallet. Additionally, NGOs can post authenticated "impact updates" directly on the ledger as milestones are hit, providing donors with verifiable, real-time updates on how their funds are being used.

## Tech Stack
* **Smart Contract:** Rust & Soroban SDK (`soroban-sdk = "21.0.0"`)
* **Frontend Framework:** Next.js 14/16 (App Router)
* **Package Manager:** Bun
* **Programming Languages:** Rust, TypeScript, HTML/CSS
* **Styling:** Tailwind CSS (Custom sleek, dark, glassmorphism theme)
* **Blockchain Integrations:** `@stellar/stellar-sdk` & `@stellar/freighter-api`
* **Network:** Stellar Testnet

## Prerequisites
* **Rust installed:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* **Wasm target:** `rustup target add wasm32-unknown-unknown`
* **Stellar CLI:** `cargo install --locked stellar-cli --features opt`
* **Node.js 18+** or **Bun (v1.1+)**
* **Freighter wallet browser extension** installed from [https://freighter.app](https://freighter.app)

## Project Structure
```
/contracts
  ├── src
  │    └── lib.rs          # Full Soroban Smart Contract with registration, direct transfer, and updates
  └── Cargo.toml           # Crate package configuration separating dev-dependencies
/frontend
  ├── app
  │    ├── layout.tsx      # Set up modern Google fonts (Outfit, JetBrains Mono) & HTML wrap
  │    ├── page.tsx        # Homepage, hero section, and state hub
  │    └── globals.css     # Global styles and tailwind imports
  ├── components
  │    ├── WalletConnect.tsx  # Connect Freighter button and Friendbot faucet handler
  │    └── MainFeature.tsx    # NGO Registration, Active Campaigns, Donations, and Live Event Stream
  ├── lib
  │    ├── stellar.ts      # Freighter connection, signing, and Horizon network helpers
  │    └── contract.ts     # Direct Soroban contract simulations (read) and write builders
  ├── tailwind.config.ts   # Custom font mappings and color extensions
  ├── package.json         # Bun dependencies configuration
  └── .env.local           # Local environment variables targeting Testnet
.env.example               # Template environment configuration
README.md                  # This detailed user manual and guide
```

---

## Step 1 — Build the Smart Contract
1. Navigate into the contracts directory:
   ```bash
   cd contracts
   ```
2. Compile the Rust contract to a WebAssembly binary targeting the wasm32 instruction set in release mode:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```
This command compiles your Rust code into a highly optimized, light WASM binary located at:
`contracts/target/wasm32-unknown-unknown/release/charity_tracker.wasm`.

---

## Step 2 — Set Up a Testnet Identity
1. Generate a new Stellar keypair named `my-key` on the global Testnet:
   ```bash
   stellar keys generate --global my-key --network testnet
   ```
2. Retrieve the public Stellar key address:
   ```bash
   stellar keys address my-key
   ```
*This command automatically triggers Friendbot to fund your newly generated identity account with 10,000 Testnet XLM so it is active and has gas.*

---

## Step 3 — Deploy Contract to Testnet
1. Deploy the compiled WASM contract directly to the Stellar Testnet using the newly created identity:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/charity_tracker.wasm \
     --source my-key \
     --network testnet
   ```
2. Copy the returned Contract ID (looks like `CDLZFC3...` or similar) — you will need to add it to your environment file in Step 5.

3. *Optional (Initialize Contract):* Initialize the contract with the native token (XLM) address (`CDLZFC3SYJYDZT7K67VZ75HPJSIZ27F6GBDG4K7K5BGBB7565EUXT6IB` on Testnet):
   ```bash
   stellar contract invoke \
     --id <YOUR_CONTRACT_ID> \
     --source my-key \
     --network testnet \
     -- \
     initialize \
     --token CDLZFC3SYJYDZT7K67VZ75HPJSIZ27F6GBDG4K7K5BGBB7565EUXT6IB
   ```

---

## Step 4 — Install Frontend Dependencies
1. Navigate back up to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install the Next.js and Stellar JS packages using Bun (or npm/yarn):
   ```bash
   bun install
   ```

---

## Step 5 — Configure Environment Variables
1. Copy the environment template:
   ```bash
   cp ../.env.example .env.local
   ```
2. Open `.env.local` and paste your deployed Contract ID from Step 3:
   ```env
   NEXT_PUBLIC_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJSIZ27F6GBDG4K7K5BGBB7565EUXT6IB_YOURS
   ```

---

## Step 6 — Run the Frontend
1. Launch the Next.js development server:
   ```bash
   bun dev
   ```
2. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Step 7 — Using the App
1. **Prepare Freighter Wallet:** Install the Freighter extension from [https://freighter.app](https://freighter.app) and set it to **Testnet** mode (`Settings` → `Network` → `Testnet`).
2. **Connect Wallet:** Open the app and click the glowing gradient **"Connect Freighter Wallet"** button at the top right of the dashboard.
3. **Fund Wallet (Friendbot):** If your wallet is new or empty, click the **"Get Testnet XLM"** button next to your truncated public key to instantly request 10,000 Testnet XLM.
4. **Register a Campaign:**
   * Click the **"Register Campaign (NGO)"** tab.
   * Provide a Title, Description, and Funding Goal in XLM.
   * Paste a valid public key under "Payout Wallet Address" where the donation funds will be transferred directly.
   * Click **"Register On-Chain"** and approve the Freighter pop-up transaction.
5. **Contribute XLM:**
   * Go back to the **"Active Campaigns"** tab.
   * On any campaign card, enter the amount of XLM you wish to contribute, and click **"Donate"**.
   * Approve the sign request on Freighter. The XLM is sent peer-to-peer directly to the payout wallet on-chain, and the progress bar will instantly update.
6. **Post NGO Milestones:**
   * Expand the campaign card details using **"View donor logs & milestone updates"**.
   * If you are connected to the app with the same wallet that registered the campaign, you will see a text box to post an impact update.
   * Enter a short milestone string (e.g. "Acquired first batch of seeds!") and click **"Post"** to save it on the blockchain.
7. **Audit donation events:**
   * Click the **"Donation Stream"** tab to view the live chronological logs of all successful contributions parsed from contract events.

---

## Smart Contract Functions

| Function Name | Parameters | Type | Description |
|---|---|---|---|
| `initialize` | `token: Address` | Write | Configures the native token address (XLM) used for transfers. Can only be initialized once. |
| `create_campaign` | `ngo: Address`, `title: String`, `description: String`, `goal: i128`, `wallet: Address` | Write | Registers a campaign under the NGO's keys. Returns `u32` campaign ID. |
| `donate` | `donor: Address`, `campaign_id: u32`, `amount: i128` | Write | Triggers an on-chain transfer of native token from donor to NGO wallet. |
| `post_impact_update` | `ngo: Address`, `campaign_id: u32`, `update: String` | Write | Appends a timestamped text string to the campaign milestone feed. Only callable by NGO. |
| `get_campaign` | `campaign_id: u32` | Read | Fetches specific campaign title, description, NGO, payout wallet, goal, and funded amount. |
| `get_campaign_count` | *none* | Read | Fetches the total number of registered campaigns. |
| `get_campaigns` | `start: u32`, `limit: u32` | Read | Returns a slice of campaigns for pagination. |
| `get_impact_updates` | `campaign_id: u32` | Read | Fetches the full historical array of milestone text updates for a campaign. |

---

## Common Errors & Fixes

* **"Transaction simulation failed"**
  * *Reason:* The smart contract has not been deployed to Testnet yet, or the contract ID in your `.env.local` is incorrect or missing.
  * *Fix:* Verify you deployed using the Stellar CLI in Step 3, copy the returned `CD...` ID, paste it into `.env.local` under `NEXT_PUBLIC_CONTRACT_ID`, and restart the bun server.
* **"Freighter not found"**
  * *Reason:* The Freighter browser extension is not installed or enabled.
  * *Fix:* Install it from [freighter.app](https://freighter.app), open it to set up a password/account, and refresh your browser.
* **"Account not found"**
  * *Reason:* Your connected Freighter public key has not been initialized on the Stellar Testnet ledger yet.
  * *Fix:* Click the **"Get Testnet XLM"** button in the app header to automatically invoke Friendbot to fund and activate your wallet.
* **"wasm32 target not found"**
  * *Reason:* The Rust toolchain lacks the WASM compilation targets.
  * *Fix:* Run `rustup target add wasm32-unknown-unknown` in your terminal and rebuild.

---

## Testnet Resources
* **Stellar Testnet Explorer (StellarExpert):** [https://stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)
* **Stellar Lab (Manual Transactions & Queries):** [https://lab.stellar.org](https://lab.stellar.org)
* **Testnet Friendbot Faucet:** `https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>`
