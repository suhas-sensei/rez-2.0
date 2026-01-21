import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';

export async function POST() {
  const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';

  if (!privateKey) {
    return NextResponse.json({ error: 'Private key not configured' }, { status: 500 });
  }

  // Determine query address for fetching positions
  let queryAddress: string;
  if (accountAddress) {
    queryAddress = accountAddress;
  } else {
    const wallet = new Wallet(privateKey);
    queryAddress = wallet.address;
  }

  const apiBase = network === 'testnet'
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz';

  try {
    // First, get all open positions
    const stateResponse = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: queryAddress,
      }),
    });
    const stateData = await stateResponse.json();

    if (!stateData.assetPositions || stateData.assetPositions.length === 0) {
      return NextResponse.json({ success: true, message: 'No positions to close', closed: 0 });
    }

    // Call the backend agent API to close positions
    const agentResponse = await fetch('http://localhost:3099/close-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!agentResponse.ok) {
      // If agent API doesn't exist, return positions that need closing
      return NextResponse.json({
        success: false,
        error: 'Agent API not available. Positions need manual closing.',
        positions: stateData.assetPositions.map((p: { position: { coin: string; szi: string } }) => ({
          coin: p.position.coin,
          size: p.position.szi,
        })),
      });
    }

    const result = await agentResponse.json();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to close positions:', error);
    return NextResponse.json({ error: 'Failed to close positions' }, { status: 500 });
  }
}
