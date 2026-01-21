import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { asset, side, size } = body;

    if (!asset || !side || !size) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: asset, side, size'
      }, { status: 400 });
    }

    // Call the backend agent API to close this specific position
    const agentResponse = await fetch('http://localhost:3099/close-position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset, side, size }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      return NextResponse.json({
        success: false,
        error: `Agent API error: ${errorText}`,
      }, { status: agentResponse.status });
    }

    const result = await agentResponse.json();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to close position:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to close position'
    }, { status: 500 });
  }
}
