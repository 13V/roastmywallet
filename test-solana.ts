import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';
const WALLET = '9axYGdhRG5APiqJ64yvt8sZdvgGPyR4NQo8vNshHhjYz';

async function testConnection() {
    console.log(`Testing connection to ${RPC_ENDPOINT}...`);
    try {
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const pubKey = new PublicKey(WALLET);
        console.log(`Fetching balance for ${WALLET}...`);
        const balance = await connection.getBalance(pubKey);
        console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

        console.log(`Fetching signatures...`);
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 5 });
        console.log(`Found ${signatures.length} signatures.`);
        console.log("Success!");
    } catch (error) {
        console.error("Error:", error);
    }
}

testConnection();
