import { getWalletData, calculateRoastStats } from './solana';

const TEST_WALLET = '9axYGdhRG5APiqJ64yvt8sZdvgGPyR4NQo8vNshHhjYz';

async function runTest() {
    console.log(`Testing with wallet: ${TEST_WALLET}`);

    const data = await getWalletData(TEST_WALLET);

    if (data) {
        console.log("Wallet Data Fetched Successfully:");
        console.log(`Balance: ${data.balance} SOL`);
        console.log(`Transactions Fetched: ${data.txCount}`);

        const stats = calculateRoastStats(data);
        console.log("\nCalculated Roast Stats:");
        console.log(JSON.stringify(stats, null, 2));
    } else {
        console.error("Failed to fetch wallet data.");
    }
}

runTest();
