import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';

interface AssetPosition {
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    leverage?: {
      value: number;
    };
    liquidationPx: string | null;
  };
}

export async function GET() {
  // Use main account address if set, otherwise derive from private key
  const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';

  // Determine which address to query
  let queryAddress: string;
  if (accountAddress) {
    queryAddress = accountAddress;
  } else if (privateKey) {
    const wallet = new Wallet(privateKey);
    queryAddress = wallet.address;
  } else {
    return NextResponse.json({ error: 'Account address not configured' }, { status: 500 });
  }

  try {
    const apiBase = network === 'testnet'
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';

    // Fetch account state from Hyperliquid
    const response = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: queryAddress,
      }),
    });
    const data = await response.json();

    let accountState = null;
    const positions: Array<{
      id: string;
      asset: string;
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      currentPrice: number;
      quantity: number;
      leverage: number;
      unrealizedPnl: number;
      liquidationPrice?: number;
    }> = [];

    if (data && data.marginSummary) {
      const margin = data.marginSummary;
      const accountValue = parseFloat(margin.accountValue || '0');
      const totalRawUsd = parseFloat(margin.totalRawUsd || '0');
      accountState = {
        balance: accountValue,
        unrealizedPnl: accountValue - totalRawUsd,
        marginUsed: parseFloat(margin.totalMarginUsed || '0'),
      };
    }

    // Parse asset positions
    if (data && data.assetPositions && Array.isArray(data.assetPositions)) {
      for (const assetPos of data.assetPositions as AssetPosition[]) {
        const pos = assetPos.position;
        const size = parseFloat(pos.szi);
        if (size === 0) continue;

        const entryPrice = parseFloat(pos.entryPx);
        const positionValue = parseFloat(pos.positionValue);
        const currentPrice = positionValue / Math.abs(size);

        positions.push({
          id: `${pos.coin}-${Date.now()}`,
          asset: pos.coin,
          side: size > 0 ? 'LONG' : 'SHORT',
          entryPrice,
          currentPrice,
          quantity: Math.abs(size),
          leverage: pos.leverage?.value || 1,
          unrealizedPnl: parseFloat(pos.unrealizedPnl),
          liquidationPrice: pos.liquidationPx ? parseFloat(pos.liquidationPx) : undefined,
        });
      }
    }

    return NextResponse.json({
      address: queryAddress,
      network,
      accountState,
      positions,
    });
  } catch (error) {
    console.error('Failed to fetch wallet data:', error);
    return NextResponse.json({ error: 'Failed to fetch wallet data' }, { status: 500 });
  }
}
