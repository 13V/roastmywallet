import { NextResponse } from 'next/server';
import Redis from 'ioredis';

// Helper to get current hour ID (timestamp / 1 hr)
const getHourId = () => Math.floor(Date.now() / (1000 * 60 * 60));

interface LeaderboardEntry {
    wallet: string;
    winRate: number;
    paperHandScore: number;
    rugPulls: number;
    roast: string;
    diagnosis?: string;
    timestamp: number;
}

interface LeaderboardData {
    hourId: number;
    data: LeaderboardEntry[];
    globalCount: number;
}

// Force dynamic on Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Initialize Redis client lazily to avoid connection issues during build if env is missing
let redisClient: Redis | null = null;

function getRedis() {
    if (!redisClient && process.env.REDIS_URL) {
        redisClient = new Redis(process.env.REDIS_URL);
    }
    return redisClient;
}

async function getLeaderboard(): Promise<LeaderboardData> {
    try {
        const currentHour = getHourId();
        const redis = getRedis();

        // Fallback if no Redis connection (e.g. build time or missing env)
        if (!redis) {
            console.warn('Redis client not initialized (Missing REDIS_URL)');
            return { hourId: currentHour, data: [], globalCount: 0 };
        }

        // Fetch from Redis
        const rawData = await redis.get('roast:leaderboard');
        const storedData: LeaderboardData | null = rawData ? JSON.parse(rawData) : null;

        console.log('Redis Fetch Result:', storedData ? 'Data Found' : 'NULL (First Run?)');

        // Default structure
        let result: LeaderboardData = {
            hourId: currentHour,
            data: [],
            globalCount: storedData?.globalCount || 0
        };

        if (storedData) {
            result.globalCount = storedData.globalCount || 0;

            // Check if hour matches. if not, data array stays empty (reset)
            if (storedData.hourId === currentHour) {
                result.data = storedData.data || [];
            } else {
                // HOUR MISMATCH - ARCHIVE PREVIOUS WINNER BEFORE RESET
                // Find previous winner (highest rug pulls)
                if (storedData.data && storedData.data.length > 0) {
                    const previousWinner = storedData.data.sort((a, b) => b.rugPulls - a.rugPulls)[0];
                    if (previousWinner) {
                        try {
                            const redis = getRedis();
                            if (redis) {
                                await redis.set('roast:last_winner', JSON.stringify({
                                    wallet: previousWinner.wallet,
                                    rugPulls: previousWinner.rugPulls,
                                    hourId: storedData.hourId,
                                    timestamp: Date.now()
                                }));
                                console.log('Archived Last Winner:', previousWinner.wallet);
                            }
                        } catch (err) {
                            console.error('Failed to archive winner:', err);
                        }
                    }
                }
            }
        } else {
            console.log('No Redis data found. Starting fresh.');
        }

        return result;
    } catch (error) {
        console.error('Error reading Redis leaderboard:', error);
        return { hourId: getHourId(), data: [], globalCount: 0 };
    }
}

async function saveLeaderboard(data: LeaderboardEntry[], count: number) {
    try {
        const redis = getRedis();
        if (!redis) return;

        const payload: LeaderboardData = {
            hourId: getHourId(),
            data: data,
            globalCount: count
        };
        // Save to Redis
        await redis.set('roast:leaderboard', JSON.stringify(payload));
    } catch (error) {
        console.error('Error saving Redis leaderboard:', error);
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode');

    // NEW: Endpoint to get the last hour's winner
    if (mode === 'last-winner') {
        const redis = getRedis();
        if (redis) {
            const lastWinnerRaw = await redis.get('roast:last_winner');
            return NextResponse.json(lastWinnerRaw ? JSON.parse(lastWinnerRaw) : { message: 'No winner recorded yet' });
        }
        return NextResponse.json({ error: 'Redis unavail' }, { status: 500 });
    }

    const { data, globalCount } = await getLeaderboard();
    // Sort by highest rug pulls (descending) and LIMIT TO TOP 10
    const sorted = data.sort((a, b) => b.rugPulls - a.rugPulls).slice(0, 10);

    // Return object with both list and count
    return NextResponse.json({
        leaderboard: sorted,
        globalCount: globalCount
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wallet, roast, stats } = body;

        if (!wallet || !stats) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 });
        }

        const { data, globalCount } = await getLeaderboard();
        const currentData = [...data];
        const newGlobalCount = globalCount + 1;

        // Check if wallet already exists
        const existingIndex = currentData.findIndex((item) => item.wallet === wallet);

        // Ensure rugPulls is saved
        const newEntry: LeaderboardEntry = {
            wallet,
            winRate: stats.winRate,
            paperHandScore: stats.paperHandScore,
            rugPulls: stats.rugPulls || 0,
            roast: roast,
            diagnosis: stats.diagnosis,
            timestamp: Date.now()
        };

        if (existingIndex >= 0) {
            currentData[existingIndex] = newEntry;
        } else {
            currentData.push(newEntry);
        }

        // Sort by highest rug pulls (descending)
        const sorted = currentData.sort((a, b) => b.rugPulls - a.rugPulls);

        // Optimization: Limit stored size to prevent KV bloat (Top 50)
        const trimmed = sorted.slice(0, 50);

        await saveLeaderboard(trimmed, newGlobalCount);

        return NextResponse.json({
            success: true,
            data: trimmed.slice(0, 10),
            globalCount: newGlobalCount
        });

    } catch (error) {
        console.error('Error updating leaderboard:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
