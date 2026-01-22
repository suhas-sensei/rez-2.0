import { NextResponse } from 'next/server';
import { isAgentPaused, setAgentPaused } from '../route';

export async function POST() {
  try {
    if (!isAgentPaused) {
      return NextResponse.json({ success: true, message: 'Agent already running' });
    }

    setAgentPaused(false);
    return NextResponse.json({ success: true, message: 'Agent resumed' });
  } catch (error) {
    console.error('Failed to resume agent:', error);
    return NextResponse.json({ error: 'Failed to resume agent' }, { status: 500 });
  }
}
