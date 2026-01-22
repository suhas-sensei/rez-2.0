import { NextResponse } from 'next/server';
import { getFullSession } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST() {
  try {
    const session = await getFullSession();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const response = await fetch(`${BACKEND_URL}/resume-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.sessionId }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to resume agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Agent resumed' });
  } catch (error) {
    console.error('Failed to resume agent:', error);
    return NextResponse.json({ error: 'Failed to resume agent' }, { status: 500 });
  }
}
