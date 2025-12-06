import { NextResponse } from 'next/server';
import { getWalletData } from '../../../utils/solana';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    try {
        const data = await getWalletData(address);

        if (data.error) {
            return NextResponse.json(data, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 });
    }
}
