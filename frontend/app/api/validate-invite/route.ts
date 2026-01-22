import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

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

// Runtime config file path (used for session-based wallet switching)
const RUNTIME_CONFIG_PATH = path.join(process.cwd(), '.runtime-wallet.json');

export function getActiveWalletConfig(): { privateKey: string; publicKey: string } | null {
  try {
    if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
      const data = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // Fallback to env
  }
  return null;
}

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

    // Write to runtime config file for immediate use
    try {
      fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(walletConfig, null, 2));
    } catch (fileError) {
      console.error('Failed to write runtime config:', fileError);
    }

    // Also update the main .env file
    const envPath = path.join(process.cwd(), '..', '.env');
    try {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      const updates: Record<string, string> = {
        'HYPERLIQUID_PRIVATE_KEY': walletConfig.privateKey,
        'HYPERLIQUID_ACCOUNT_ADDRESS': walletConfig.publicKey,
      };

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
          envContent += `\n${key}=${value}`;
        }
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n');
    } catch (fileError) {
      console.error('Failed to update .env file:', fileError);
    }

    return NextResponse.json({
      success: true,
      walletAddress: walletConfig.publicKey,
    });

  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
