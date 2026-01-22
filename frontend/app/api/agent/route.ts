import { NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { appendFileSync, writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';

// Store the agent process globally
let agentProcess: ChildProcess | null = null;
// Track paused state
export let isAgentPaused = false;

export function setAgentPaused(paused: boolean) {
  isAgentPaused = paused;
}

// Path for agent output log
const getAgentLogPath = () => path.resolve(process.cwd(), '..', 'agent_output.log');

// Get active wallet from runtime config
function getActiveWallet(): { privateKey: string; publicKey: string } | null {
  const runtimeConfigPath = path.join(process.cwd(), '.runtime-wallet.json');
  try {
    if (existsSync(runtimeConfigPath)) {
      const data = readFileSync(runtimeConfigPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Fallback to env
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assets, interval } = body;

    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return NextResponse.json({ error: 'Assets are required' }, { status: 400 });
    }

    if (!interval) {
      return NextResponse.json({ error: 'Interval is required' }, { status: 400 });
    }

    // Kill existing process if running
    if (agentProcess && !agentProcess.killed) {
      agentProcess.kill('SIGTERM');
      agentProcess = null;
    }

    // Build command arguments
    const projectRoot = path.resolve(process.cwd(), '..');
    const args = [
      'run',
      'python',
      'src/main.py',
      '--assets',
      ...assets,
      '--interval',
      interval,
    ];

    // Clear the agent log file on start
    const agentLogPath = getAgentLogPath();
    writeFileSync(agentLogPath, '');

    // Get active wallet config for the agent
    const runtimeWallet = getActiveWallet();
    const agentEnv: Record<string, string | undefined> = {
      ...process.env,
      API_PORT: '3099', // Use different port than Next.js
    };

    // Override with runtime wallet if available
    if (runtimeWallet) {
      agentEnv.HYPERLIQUID_PRIVATE_KEY = runtimeWallet.privateKey;
      agentEnv.HYPERLIQUID_ACCOUNT_ADDRESS = runtimeWallet.publicKey;
    }

    // Spawn the agent process with a different API port to avoid conflict with Next.js
    agentProcess = spawn('poetry', args, {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: agentEnv,
    });

    const pid = agentProcess.pid;

    agentProcess.on('error', (error) => {
      console.error('Agent process error:', error);
    });

    agentProcess.on('exit', (code, signal) => {
      console.log(`Agent process exited with code ${code}, signal ${signal}`);
      agentProcess = null;
    });

    // Log stdout/stderr and capture to file
    agentProcess.stdout?.on('data', (data) => {
      console.log(`Agent stdout: ${data}`);
      try {
        appendFileSync(agentLogPath, data.toString());
      } catch { /* ignore */ }
    });

    agentProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      console.error(`Agent stderr: ${output}`);
      try {
        appendFileSync(agentLogPath, output);
      } catch { /* ignore */ }
    });

    return NextResponse.json({
      success: true,
      message: 'Agent started',
      pid,
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
    if (agentProcess && !agentProcess.killed) {
      agentProcess.kill('SIGTERM');
      agentProcess = null;
      isAgentPaused = false;
      return NextResponse.json({ success: true, message: 'Agent stopped' });
    }
    isAgentPaused = false;
    return NextResponse.json({ success: true, message: 'No agent running' });
  } catch (error) {
    console.error('Failed to stop agent:', error);
    return NextResponse.json({ error: 'Failed to stop agent' }, { status: 500 });
  }
}

export async function GET() {
  const isRunning = agentProcess !== null && !agentProcess.killed;
  return NextResponse.json({
    running: isRunning,
    paused: isAgentPaused,
    pid: isRunning ? agentProcess?.pid : null,
  });
}
