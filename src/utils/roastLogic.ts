import { WalletData } from './solana';
import {
    DIAGNOSIS_LIST,
    ROASTS_WHALE,
    ROASTS_PLEB,
    ROASTS_DEGEN,
    ROASTS_PAPERHAND,
    ROASTS_GENERIC
} from './roastContent';

// Seedable random function for consistent results per wallet (if needed)
const pseudoRandom = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
};

export const getDiagnosis = (address: string, data?: WalletData): string => {
    // If we have data, we can be smarter
    if (data) {
        if (data.isDust) return "POOR";
        if (data.isWhale) return "WHALE";
        if (data.txCount > 100) return "TERMINAL DEGEN";
        if (data.txCount < 5) return "INACTIVE";
    }

    // Fallback to deterministic random selection from the massive list
    const rand = pseudoRandom(address);
    return DIAGNOSIS_LIST[rand % DIAGNOSIS_LIST.length];
};

export const generateRoastMessage = (data: WalletData): { roast: string; stats: any } => {
    let category = "generic";

    // Determine Category
    if (data.isDust) category = "broke";
    else if (data.isWhale) category = "whale";
    else if (data.txCount > 20) category = "degen";
    else if (data.txCount < 5) category = "paperhand"; // Low activity = paperhand/inactive

    // Select roasts based on category
    let roasts: string[] = ROASTS_GENERIC;

    switch (category) {
        case 'broke': roasts = ROASTS_PLEB; break;
        case 'whale': roasts = ROASTS_WHALE; break;
        case 'degen': roasts = ROASTS_DEGEN; break;
        case 'paperhand': roasts = ROASTS_PAPERHAND; break;
        default: roasts = ROASTS_GENERIC;
    }

    // Select true random roast for variety
    const randomRoast = roasts[Math.floor(Math.random() * roasts.length)];

    // Generate Randomized Stats
    const stats = {
        paperHandScore: category === 'paperhand' ? 90 + Math.floor(Math.random() * 10) : Math.floor(Math.random() * 100),
        rugPulls: Math.floor(Math.random() * 12),
        athBuys: Math.floor(Math.random() * 20),
        profitableTrades: Math.floor(Math.random() * 8),
        totalTrades: data.txCount * (Math.floor(Math.random() * 3) + 1),
        winRate: Math.floor(Math.random() * 30) // Generally keep winrate low for the roast effect
    };

    return {
        roast: randomRoast,
        stats
    };
};
