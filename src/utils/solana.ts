import { Connection, PublicKey, LAMPORTS_PER_SOL, ParsedTransactionWithMeta } from '@solana/web3.js';

// List of public RPC endpoints to try in order
const PUBLIC_ENDPOINTS = [
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
    'https://solana-mainnet.rpc.extrnode.com',
];

// Use custom RPC if available, otherwise fall back to public list
const RPC_ENDPOINTS = process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    ? [process.env.NEXT_PUBLIC_SOLANA_RPC_URL, ...PUBLIC_ENDPOINTS]
    : PUBLIC_ENDPOINTS;

const RETRY_DELAY = 1000; // 1 second

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface WalletData {
    address: string;
    balance: number;
    txCount: number;
    signatures: string[];
    isDust: boolean;
    isWhale: boolean;
    hasRoastToken: boolean;
    tokenAccountCount: number;
    failedTxCount: number;
    daysActive: number;
}

export interface RoastStats {
    paperHandScore: number;
    rugPulls: number; // Now "Shitcoin Graveyard" (Token Account Count)
    athBuys: number; // Now "Desperation Rate" (Failed Tx %)
    profitableTrades: number;
    totalTrades: number;
    winRate: number; // Now "Days Since Rekt" (Wallet Age)
}

async function tryFetchWithRpc(endpoint: string, address: string, retries = 2): Promise<WalletData> {
    console.log(`Attempting to fetch data from ${endpoint}...`);

    try {
        const connection = new Connection(endpoint, 'confirmed');
        const pubKey = new PublicKey(address);

        // Fetch balance
        const balance = await connection.getBalance(pubKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        // Fetch last 1000 signatures (max limit) to get better stats
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 1000 });

        // Calculate Failed Transactions
        const failedTxCount = signatures.filter(tx => tx.err !== null).length;

        // Calculate Days Active (based on oldest fetched tx)
        const oldestTx = signatures[signatures.length - 1];
        const daysActive = oldestTx && oldestTx.blockTime
            ? Math.floor((Date.now() / 1000 - oldestTx.blockTime) / (60 * 60 * 24))
            : 0;

        // Fetch Token Accounts (Shitcoin Graveyard)
        // Token Program ID: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
        const tokenAccounts = await connection.getTokenAccountsByOwner(pubKey, {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        });

        return {
            address,
            balance: solBalance,
            txCount: signatures.length,
            signatures: signatures.map(s => s.signature),
            isDust: solBalance < 0.1,
            isWhale: solBalance > 100,
            hasRoastToken: false, // TODO: Implement token account fetching
            tokenAccountCount: tokenAccounts.value.length,
            failedTxCount,
            daysActive
        };
    } catch (error) {
        if (retries > 0) {
            console.warn(`Error fetching from ${endpoint}. Retrying in ${RETRY_DELAY}ms... (${retries} retries left)`);
            await sleep(RETRY_DELAY);
            return tryFetchWithRpc(endpoint, address, retries - 1);
        }
        throw error;
    }
}

export async function getWalletData(address: string): Promise<WalletData> {
    let lastError: any;

    for (const endpoint of RPC_ENDPOINTS) {
        try {
            return await tryFetchWithRpc(endpoint, address);
        } catch (error) {
            console.warn(`Failed to fetch from ${endpoint}:`, error);
            lastError = error;
            // Continue to next endpoint
        }
    }

    // If we get here, all endpoints failed
    console.error("All RPC endpoints failed.");
    throw new Error(`Failed to fetch wallet data from all available RPCs. Last error: ${lastError?.message || lastError}`);
}

export function calculateRoastStats(data: WalletData): RoastStats {
    // Deterministic "Randomness" based on wallet address characters to keep it consistent for the same wallet
    // but still feeling random.
    const seed = data.address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const pseudoRandom = (offset: number) => {
        const x = Math.sin(seed + offset) * 10000;
        return x - Math.floor(x);
    };

    // Real metrics influence
    const isActive = data.txCount > 50;

    // Paper Hand Score: Higher if balance is low but tx count is high (churning)
    let paperHandScore = Math.floor(pseudoRandom(1) * 30) + 70; // Base 70-100
    if (data.isDust && isActive) paperHandScore += 5;
    if (data.isWhale) paperHandScore -= 20;
    paperHandScore = Math.min(100, Math.max(0, paperHandScore));

    return {
        paperHandScore,
        rugPulls: data.tokenAccountCount, // REAL: Memecoin Graveyard
        athBuys: Math.round((data.failedTxCount / Math.max(data.txCount, 1)) * 100), // REAL: Desperation Rate (%)
        profitableTrades: Math.floor(pseudoRandom(3) * 10), // Still fake (needs PnL)
        totalTrades: data.txCount, // REAL: Visible Tx Count
        winRate: data.daysActive // REAL: Days Since Rekt
    };
}
