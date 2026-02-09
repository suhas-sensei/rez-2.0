import { cookies } from 'next/headers';

export interface WalletSession {
  privateKey: string;
  publicKey: string;
  inviteCode: string;
  createdAt: number;
}

export const SESSION_COOKIE_NAME = 'rez-session';

// Encode session data to store directly in cookie
function encodeSession(session: WalletSession): string {
  return Buffer.from(JSON.stringify(session)).toString('base64');
}

// Decode session data from cookie
function decodeSession(encoded: string): WalletSession | null {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as WalletSession;
  } catch {
    return null;
  }
}

// Session expiry: 24 hours
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function createSessionCookie(wallet: { privateKey: string; publicKey: string }, inviteCode: string): string {
  const session: WalletSession = {
    ...wallet,
    inviteCode,
    createdAt: Date.now(),
  };
  return encodeSession(session);
}

// Helper to get wallet from current request cookies
export async function getWalletFromSession(): Promise<{ privateKey: string; publicKey: string } | null> {
  const cookieStore = await cookies();
  const sessionData = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionData) return null;

  const session = decodeSession(sessionData);
  if (!session) return null;

  // Check if expired
  if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    return null;
  }

  return {
    privateKey: session.privateKey,
    publicKey: session.publicKey,
  };
}

// Helper to get full session data including session ID (use publicKey as ID)
export async function getFullSession(): Promise<{ sessionId: string; privateKey: string; publicKey: string } | null> {
  const cookieStore = await cookies();
  const sessionData = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionData) return null;

  const session = decodeSession(sessionData);
  if (!session) return null;

  // Check if expired
  if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    return null;
  }

  return {
    sessionId: session.publicKey, // Use wallet address as session ID
    privateKey: session.privateKey,
    publicKey: session.publicKey,
  };
}
