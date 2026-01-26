import { NextResponse } from 'next/server';
import { getFullSession } from '@/lib/session';

// Backend API URL (Python server)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assets, interval, riskProfile } = body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: 'Assets are required' }, { status: 400 });
    }

    if (!interval) {
      return NextResponse.json({ error: 'Interval is required' }, { status: 400 });
    }

    // Get session data
    let session = null;
    try {
      session = await getFullSession();
    } catch (err) {
      console.error('Failed to get session:', err);
      return NextResponse.json({
        error: 'Session error. Please clear your browser data and login again with your invite code.',
        details: String(err),
      }, { status: 401 });
    }

    if (!session) {
      console.log('No session found - user needs to login with invite code');
      return NextResponse.json({
        error: 'Not authenticated. Please enter your invite code to login first.',
      }, { status: 401 });
    }

    console.log(`Starting agent for session: ${session.sessionId}`);

    // Call backend to start agent
    const response = await fetch(`${BACKEND_URL}/start-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
        assets,
        interval,
        risk_profile: riskProfile || 'conservative',
        private_key: session.privateKey,
        public_key: session.publicKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json({ error: 'Failed to start agent' }, { status: 500 });
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Agent started',
      sessionId: session.sessionId,
      assets,
      interval,
    });
  } catch (error) {
    console.error('Failed to start agent:', error);
    return NextResponse.json({ error: 'Failed to start agent' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Get session data
    let session = null;
    try {
      session = await getFullSession();
    } catch (err) {
      console.error('Failed to get session:', err);
    }

    if (!session) {
      return NextResponse.json({ success: true, message: 'No agent running' });
    }

    // Call backend to stop agent
    const response = await fetch(`${BACKEND_URL}/stop-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: session.sessionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend error:', errorText);
      return NextResponse.json({ error: 'Failed to stop agent' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Agent stopped' });
  } catch (error) {
    console.error('Failed to stop agent:', error);
    return NextResponse.json({ error: 'Failed to stop agent' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get session data
    let session = null;
    try {
      session = await getFullSession();
    } catch (err) {
      console.error('Failed to get session:', err);
    }

    if (!session) {
      return NextResponse.json({
        running: false,
        paused: false,
        pid: null,
      });
    }

    // Call backend to get agent status
    const response = await fetch(`${BACKEND_URL}/agent-status/${session.sessionId}`);

    if (!response.ok) {
      return NextResponse.json({
        running: false,
        paused: false,
        pid: null,
      });
    }

    const result = await response.json();

    return NextResponse.json({
      running: result.running,
      paused: result.paused,
      pid: result.session_id,
    });
  } catch (error) {
    console.error('Failed to get agent status:', error);
    return NextResponse.json({
      running: false,
      paused: false,
      pid: null,
    });
  }
}
