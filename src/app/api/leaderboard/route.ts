import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

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

async function getLeaderboard(): Promise<LeaderboardData> {
    try {
        const currentHour = getHourId();

        // Fetch from Vercel KV
        const storedData: LeaderboardData | null = await kv.get('roast:leaderboard');
        console.log('KV Fetch Result:', storedData ? 'Data Found' : 'NULL (First Run?)');

        // Default structure
        let result: LeaderboardData = {
            hourId: currentHour,
            data: [],
            globalCount: storedData?.globalCount || 0
        };

        if (storedData) {
            result.globalCount = storedData.globalCount || 0;

            // Check if hour matches. if not, data array stays empty (reset) but globalCount persists
            if (storedData.hourId === currentHour) {
                result.data = storedData.data || [];
            }
        } else {
            console.log('No KV data found. Starting fresh.');
        }

        return result;
    } catch (error) {
        console.error('Error reading KV leaderboard:', error);
        return { hourId: getHourId(), data: [], globalCount: 0 };
    }
}

async function saveLeaderboard(data: LeaderboardEntry[], count: number) {
    try {
        const payload: LeaderboardData = {
            hourId: getHourId(),
            data: data,
            globalCount: count
        };
        // Save to Vercel KV
        await kv.set('roast:leaderboard', payload);
    } catch (error) {
        console.error('Error saving KV leaderboard:', error);
    }
}

export async function GET() {
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
