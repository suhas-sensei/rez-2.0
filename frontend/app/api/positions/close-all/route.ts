import { NextResponse } from 'next/server';
import { Wallet } from 'ethers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST() {
  const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;

  if (!privateKey) {
    return NextResponse.json({ success: false, error: 'Private key not configured' }, { status: 500 });
  }

  // Determine public key for the backend
  let publicKey: string;
  if (accountAddress) {
    publicKey = accountAddress;
  } else {
    const wallet = new Wallet(privateKey);
    publicKey = wallet.address;
  }

  try {
    // Call the backend API to close all positions
    console.log(`Calling backend at ${BACKEND_URL}/close-all`);

    const response = await fetch(`${BACKEND_URL}/close-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        private_key: privateKey,
        public_key: publicKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend close-all error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Backend error: ${response.status} - ${errorText}`,
      });
    }

    const result = await response.json();
    console.log('Backend close-all result:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to close positions:', error);
    return NextResponse.json({ success: false, error: 'Failed to connect to backend' }, { status: 500 });
  }
}
