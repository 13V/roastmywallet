import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const FILE_PATH = path.join(DATA_DIR, 'leaderboard.json');

// Helper to get current hour ID (timestamp / 1 hr)
const getHourId = () => Math.floor(Date.now() / (1000 * 60 * 60));

function getLeaderboard() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        let fileData;
        if (fs.existsSync(FILE_PATH)) {
            const raw = fs.readFileSync(FILE_PATH, 'utf8');
            fileData = JSON.parse(raw);
        }

        const currentHour = getHourId();

        // Default structure
        let result = {
            hourId: currentHour,
            data: [],
            globalCount: fileData?.globalCount || 0
        };

        // If file exists but is old array format (migration)
        if (Array.isArray(fileData)) {
            result.globalCount = (fileData as any[]).length; // Estimate from old data
        } else if (fileData) {
            // It's the new object format
            result.globalCount = fileData.globalCount || 0;
            // Check if hour matches, if so keep data, else reset data (but keep globalCount)
            if (fileData.hourId === currentHour) {
                result.data = fileData.data || [];
            }
        }

        return result;
    } catch (error) {
        console.error('Error reading leaderboard:', error);
        return { hourId: getHourId(), data: [], globalCount: 0 };
    }
}

function saveLeaderboard(data: any[], count: number) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        // Always save with current hour ID
        const payload = {
            hourId: getHourId(),
            data: data,
            globalCount: count
        };
        fs.writeFileSync(FILE_PATH, JSON.stringify(payload, null, 2));
    } catch (error) {
        console.error('Error saving leaderboard:', error);
    }
}

export async function GET() {
    const { data, globalCount } = getLeaderboard();
    // Sort by highest rug pulls (descending) and LIMIT TO TOP 10
    const sorted = data.sort((a: any, b: any) => b.rugPulls - a.rugPulls).slice(0, 10);

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

        const { data, globalCount } = getLeaderboard();
        const currentData = data;
        const newGlobalCount = globalCount + 1;

        // Check if wallet already exists, update if so
        const existingIndex = currentData.findIndex((item: any) => item.wallet === wallet);

        // Ensure rugPulls is saved
        const newEntry = {
            wallet,
            winRate: stats.winRate,
            paperHandScore: stats.paperHandScore,
            rugPulls: stats.rugPulls || 0,
            roast: roast,
            diagnosis: stats.diagnosis, // Capture diagnosis too if sent
            timestamp: Date.now()
        };

        if (existingIndex >= 0) {
            currentData[existingIndex] = newEntry;
        } else {
            currentData.push(newEntry);
        }

        // Sort by highest rug pulls (descending)
        const sorted = currentData.sort((a: any, b: any) => b.rugPulls - a.rugPulls);

        // Optimization: Don't store more than 50 locally even if we only return 10
        // This keeps the file size small
        const trimmed = sorted.slice(0, 50);

        saveLeaderboard(trimmed, newGlobalCount);

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
