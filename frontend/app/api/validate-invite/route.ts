import { NextResponse } from 'next/server';
import { createSessionCookie, SESSION_COOKIE_NAME } from '@/lib/session';

// Wallet configurations mapped by invite code
const WALLET_CONFIGS: Record<string, { privateKey: string; publicKey: string }> = {
  'A7F2': {
    privateKey: '0x856e5a7b87c008f52900c54275e3c5fff27726fcf93398326761088f947db5e',
    publicKey: '0x1395577107A570270B09cFF59C9572a3A53689ec',
  },
  'M3X8': {
    privateKey: '0x4ae6c00543c89317b76695f0c43ef13f2124dbda2f96fd2d22e9327d3e4b22b',
    publicKey: '0xAAF4e0970760F1C8e88334a395d20CF19ABeabAa',
  },
  'Q9K4': {
    privateKey: '0x5f199150a2b20bd38d7ad35d77aeef39ed1a96e3400b7ab7bb59dd822d8ef910',
    publicKey: '0x14446Ff436d086058871dD545A391193B24F609F',
  },
};

export async function POST(request: Request) {
  try {
    const { inviteCode } = await request.json();

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    const upperCode = inviteCode.toUpperCase().trim();
    const walletConfig = WALLET_CONFIGS[upperCode];

    if (!walletConfig) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 401 });
    }

    // Create session data to store in cookie
    const sessionData = createSessionCookie(walletConfig, upperCode);

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      walletAddress: walletConfig.publicKey,
    });

    // Set session cookie (httpOnly for security, 24 hour expiry)
    // Session data is stored directly in the cookie (base64 encoded)
    response.cookies.set(SESSION_COOKIE_NAME, sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
