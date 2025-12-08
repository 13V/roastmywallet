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
