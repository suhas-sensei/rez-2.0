import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asset, size, side } = body;

    if (!asset) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: asset'
      }, { status: 400 });
    }

    const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
    const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key not configured'
      }, { status: 500 });
    }

    // Determine public key for the backend
    let publicKey: string;
    if (accountAddress) {
      publicKey = accountAddress;
    } else {
      const wallet = new Wallet(privateKey);
      publicKey = wallet.address;
    }

    // Call the backend API to close this specific position
    console.log(`Calling backend at ${BACKEND_URL}/close-position for asset: ${asset}`);

    const response = await fetch(`${BACKEND_URL}/close-position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset: asset,
        private_key: privateKey,
        public_key: publicKey,
        size: size,  // Pass size to skip extra API call
        side: side,  // Pass side (LONG/SHORT) to determine close direction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend close-position error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Backend error: ${response.status} - ${errorText}`,
      });
    }

    const result = await response.json();
    console.log(`Backend close-position result for ${asset}:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to close position:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to close position'
    }, { status: 500 });
  }
}
