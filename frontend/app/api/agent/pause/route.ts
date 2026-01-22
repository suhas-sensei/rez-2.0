import { NextResponse } from 'next/server';
import { isAgentPaused, setAgentPaused } from '../route';

export async function POST() {
  try {
    if (isAgentPaused) {
      return NextResponse.json({ success: true, message: 'Agent already paused' });
    }

    setAgentPaused(true);
    return NextResponse.json({ success: true, message: 'Agent paused' });
  } catch (error) {
    console.error('Failed to pause agent:', error);
    return NextResponse.json({ error: 'Failed to pause agent' }, { status: 500 });
  }
}
