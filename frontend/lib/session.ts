import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export interface WalletSession {
  privateKey: string;
  publicKey: string;
  inviteCode: string;
  createdAt: number;
}

// In-memory session store (per-user wallets)
const sessionStore = new Map<string, WalletSession>();

// Session expiry: 24 hours
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_NAME = 'rez-session';

// Clean up expired sessions periodically
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.entries()) {
    if (now - session.createdAt > SESSION_EXPIRY_MS) {
      sessionStore.delete(sessionId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpiredSessions, 10 * 60 * 1000);

export function createSession(wallet: { privateKey: string; publicKey: string }, inviteCode: string): string {
  const sessionId = uuidv4();
  sessionStore.set(sessionId, {
    ...wallet,
    inviteCode,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId: string): WalletSession | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  // Check if expired
  if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

export function deleteSession(sessionId: string): void {
  sessionStore.delete(sessionId);
}

// Helper to get wallet from current request cookies
export async function getWalletFromSession(): Promise<{ privateKey: string; publicKey: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) return null;

  const session = getSession(sessionId);
  if (!session) return null;

  return {
    privateKey: session.privateKey,
    publicKey: session.publicKey,
  };
}

// Helper to get full session data including session ID
export async function getFullSession(): Promise<{ sessionId: string; privateKey: string; publicKey: string } | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) return null;

  const session = getSession(sessionId);
  if (!session) return null;

  return {
    sessionId,
    privateKey: session.privateKey,
    publicKey: session.publicKey,
  };
}
