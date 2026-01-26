import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';
import { getWalletFromSession } from '@/lib/session';

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
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';

  // Get wallet from session (per-user)
  const sessionWallet = await getWalletFromSession();

  let queryAddress: string;
  if (sessionWallet?.publicKey) {
    queryAddress = sessionWallet.publicKey;
  } else if (process.env.HYPERLIQUID_ACCOUNT_ADDRESS) {
    queryAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  } else if (process.env.HYPERLIQUID_PRIVATE_KEY) {
    const wallet = new Wallet(process.env.HYPERLIQUID_PRIVATE_KEY);
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
