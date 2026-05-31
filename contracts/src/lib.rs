#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub ngo: Address,
    pub wallet: Address,
    pub title: String,
    pub description: String,
    pub goal: i128, // in stroops (1 XLM = 10,000,000 stroops)
    pub funded: i128, // in stroops
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ImpactUpdate {
    pub campaign_id: u32,
    pub text: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Initialized,
    TokenAddress,
    CampaignCount,
    Campaign(u32),
    ImpactUpdates(u32),
}

#[contract]
pub struct CharityTracker;

#[contractimpl]
impl CharityTracker {
    /// Initialize the contract with the native token (XLM) address.
    pub fn initialize(env: Env, token: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::TokenAddress, &token);
        env.storage().instance().set(&DataKey::CampaignCount, &0u32);
    }

    /// Register a new charity campaign. Returns the generated campaign ID.
    pub fn create_campaign(
        env: Env,
        ngo: Address,
        title: String,
        description: String,
        goal: i128,
        wallet: Address,
    ) -> u32 {
        ngo.require_auth();
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract not initialized");
        }
        if goal <= 0 {
            panic!("Funding goal must be greater than zero");
        }

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0);
        count += 1;

        let campaign = Campaign {
            id: count,
            ngo: ngo.clone(),
            wallet: wallet.clone(),
            title,
            description,
            goal,
            funded: 0,
        };

        env.storage().persistent().set(&DataKey::Campaign(count), &campaign);
        env.storage().instance().set(&DataKey::CampaignCount, &count);

        // Emit standard event for campaign creation
        env.events().publish(
            (symbol_short!("created"), count, ngo),
            (wallet, goal, env.ledger().timestamp()),
        );

        count
    }

    /// Contribute XLM (native token) to a campaign on-chain.
    pub fn donate(env: Env, donor: Address, campaign_id: u32, amount: i128) {
        donor.require_auth();
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract not initialized");
        }
        if amount <= 0 {
            panic!("Donation amount must be greater than zero");
        }

        let mut campaign = match env
            .storage()
            .persistent()
            .get::<_, Campaign>(&DataKey::Campaign(campaign_id))
        {
            Some(c) => c,
            None => panic!("Campaign not found"),
        };

        // Fetch XLM Native Token contract address
        let token_address: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenAddress)
            .expect("Token address not set");

        let token_client = token::Client::new(&env, &token_address);
        
        // Direct on-chain transfer from Donor to the NGO's specified wallet address
        token_client.transfer(&donor, &campaign.wallet, &amount);

        // Update funding status internally
        campaign.funded += amount;
        env.storage().persistent().set(&DataKey::Campaign(campaign_id), &campaign);

        // Emit donation event
        env.events().publish(
            (symbol_short!("donated"), campaign_id, donor),
            (amount, env.ledger().timestamp()),
        );
    }

    /// NGO posts an impact update on-chain for a milestone reached.
    pub fn post_impact_update(env: Env, ngo: Address, campaign_id: u32, update: String) {
        ngo.require_auth();
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract not initialized");
        }

        let campaign = match env
            .storage()
            .persistent()
            .get::<_, Campaign>(&DataKey::Campaign(campaign_id))
        {
            Some(c) => c,
            None => panic!("Campaign not found"),
        };

        // Ensure only the registered NGO can post updates
        if campaign.ngo != ngo {
            panic!("Only the registered NGO can post updates for this campaign");
        }

        let mut updates: Vec<ImpactUpdate> = env
            .storage()
            .persistent()
            .get(&DataKey::ImpactUpdates(campaign_id))
            .unwrap_or_else(|| Vec::new(&env));

        let new_update = ImpactUpdate {
            campaign_id,
            text: update.clone(),
            timestamp: env.ledger().timestamp(),
        };

        updates.push_back(new_update);
        env.storage()
            .persistent()
            .set(&DataKey::ImpactUpdates(campaign_id), &updates);

        // Emit impact update event
        env.events().publish(
            (symbol_short!("impact"), campaign_id),
            (update, env.ledger().timestamp()),
        );
    }

    /// Read Campaign information.
    pub fn get_campaign(env: Env, campaign_id: u32) -> Campaign {
        match env
            .storage()
            .persistent()
            .get::<_, Campaign>(&DataKey::Campaign(campaign_id))
        {
            Some(c) => c,
            None => panic!("Campaign not found"),
        }
    }

    /// Read the total campaign count.
    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::CampaignCount)
            .unwrap_or(0)
    }

    /// Read a slice of campaigns for pagination.
    pub fn get_campaigns(env: Env, start: u32, limit: u32) -> Vec<Campaign> {
        let count = Self::get_campaign_count(env.clone());
        let mut campaigns = Vec::new(&env);
        
        let end = core::cmp::min(start + limit, count + 1);
        for i in start..end {
            if let Some(c) = env
                .storage()
                .persistent()
                .get::<_, Campaign>(&DataKey::Campaign(i))
            {
                campaigns.push_back(c);
            }
        }
        campaigns
    }

    /// Read all impact updates associated with a campaign.
    pub fn get_impact_updates(env: Env, campaign_id: u32) -> Vec<ImpactUpdate> {
        env.storage()
            .persistent()
            .get(&DataKey::ImpactUpdates(campaign_id))
            .unwrap_or_else(|| Vec::new(&env))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        token, Address, Env, String,
    };

    #[test]
    fn test_charity_tracker_flow() {
        let env = Env::default();
        env.mock_all_auths();

        // Register the contract
        let contract_id = env.register_contract(None, CharityTracker);
        let client = CharityTrackerClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let ngo = Address::generate(&env);
        let donor = Address::generate(&env);
        let campaign_wallet = Address::generate(&env);

        // Register a mock native token (XLM)
        let token_id = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(&env, &token_id);
        let token_client = token::Client::new(&env, &token_id);

        // Fund the donor
        token_admin.mint(&donor, &1_000_000_000);

        // 1. Initialize Charity Tracker with token contract
        client.initialize(&token_id);

        // 2. NGO creates a campaign
        let title = String::from_str(&env, "Save the Reefs");
        let desc = String::from_str(&env, "Funding direct marine conservation projects.");
        let goal = 500_000_000i128; // 50 XLM in stroops

        let campaign_id = client.create_campaign(&ngo, &title, &desc, &goal, &campaign_wallet);
        assert_eq!(campaign_id, 1);
        assert_eq!(client.get_campaign_count(), 1);

        // Verify campaign details
        let campaign = client.get_campaign(&1);
        assert_eq!(campaign.title, title);
        assert_eq!(campaign.goal, goal);
        assert_eq!(campaign.funded, 0);

        // 3. Donor donates 200,000,000 stroops (20 XLM)
        client.donate(&donor, &1, &200_000_000);

        // Verify balance changes
        assert_eq!(token_client.balance(&donor), 800_000_000);
        assert_eq!(token_client.balance(&campaign_wallet), 200_000_000);

        // Verify contract tracks the fund progress
        let campaign_after = client.get_campaign(&1);
        assert_eq!(campaign_after.funded, 200_000_000);

        // 4. NGO posts an impact update
        let milestone = String::from_str(&env, "Purchased 50 coral propagation structures!");
        client.post_impact_update(&ngo, &1, &milestone);

        // Verify impact updates
        let updates = client.get_impact_updates(&1);
        assert_eq!(updates.len(), 1);
        assert_eq!(updates.get(0).unwrap().text, milestone);
    }

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_cannot_double_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, CharityTracker);
        let client = CharityTrackerClient::new(&env, &contract_id);
        let token = Address::generate(&env);
        client.initialize(&token);
        client.initialize(&token);
    }
}
