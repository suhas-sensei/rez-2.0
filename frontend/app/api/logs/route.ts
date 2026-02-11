import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { Wallet } from 'ethers';
import { getFullSession } from '@/lib/session';

// Backend API URL (Python server)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

// Fetch total PnL (account value - deposits) from Hyperliquid - matches their UI calculation
async function fetchTotalPnL(publicKey: string): Promise<number | null> {
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';
  const apiBase = network === 'testnet'
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz';

  try {
    // Get account value
    const stateRes = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'clearinghouseState', user: publicKey }),
    });
    const state = await stateRes.json();

    // Validate that marginSummary exists - if not, API returned bad data
    if (!state?.marginSummary?.accountValue) {
      console.error('fetchTotalPnL: marginSummary missing or accountValue empty');
      return null;
    }

    const accountValue = parseFloat(state.marginSummary.accountValue);

    // Get deposits/withdrawals
    const ledgerRes = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'userNonFundingLedgerUpdates',
        user: publicKey,
        startTime: 0,
        endTime: Date.now(),
      }),
    });
    const ledger = await ledgerRes.json();

    // Sum all deposits/withdrawals
    let netDeposits = 0;
    if (Array.isArray(ledger)) {
      for (const entry of ledger) {
        const delta = entry?.delta;
        if (delta?.type === 'internalTransfer' || delta?.type === 'deposit') {
          netDeposits += parseFloat(delta?.usdc || '0');
        } else if (delta?.type === 'withdraw') {
          netDeposits -= parseFloat(delta?.usdc || '0');
        }
      }
    }

    // PnL = Account Value - Net Deposits (matches Hyperliquid UI)
    return accountValue - netDeposits;
  } catch (error) {
    console.error('Failed to fetch total PnL:', error);
    return null;
  }
}

// Fetch open orders from Hyperliquid
async function fetchOpenOrders(publicKey: string): Promise<Array<{
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  origSz: string;
  orderType: string;
  timestamp: number;
  reduceOnly: boolean;
  triggerCondition: string;
  triggerPx: string;
  oid: number;
}>> {
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';
  const apiBase = network === 'testnet'
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz';

  try {
    const response = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'frontendOpenOrders', user: publicKey }),
    });

    if (!response.ok) return [];
    const orders = await response.json();
    if (!Array.isArray(orders)) return [];

    return orders.map((order: {
      coin: string;
      side: string;
      limitPx: string;
      sz: string;
      origSz: string;
      orderType: string;
      timestamp: number;
      reduceOnly: boolean;
      triggerCondition: string;
      triggerPx: string;
      oid: number;
    }) => ({
      coin: order.coin,
      side: order.side,
      limitPx: order.limitPx,
      sz: order.sz,
      origSz: order.origSz,
      orderType: order.orderType || 'Limit',
      timestamp: order.timestamp,
      reduceOnly: order.reduceOnly || false,
      triggerCondition: order.triggerCondition || 'N/A',
      triggerPx: order.triggerPx || '0.0',
      oid: order.oid,
    }));
  } catch (error) {
    console.error('Failed to fetch open orders:', error);
    return [];
  }
}

// Fetch user fills (completed trades) from Hyperliquid
async function fetchHyperliquidFills(publicKey: string): Promise<Array<{
  id: string;
  asset: string;
  action: string;
  dir: string;
  date: string;
  price: number;
  quantity: number;
  notional: number;
  side: string;
  time: number;
  fee: number;
  closedPnl: number;
  hash: string | null;
}>> {
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';
  const apiBase = network === 'testnet'
    ? 'https://api.hyperliquid-testnet.xyz'
    : 'https://api.hyperliquid.xyz';

  try {
    const response = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'userFillsByTime',
        user: publicKey,
        startTime: Date.now() - 90 * 24 * 60 * 60 * 1000, // Last 90 days
        endTime: Date.now(),
      }),
    });

    if (!response.ok) return [];
    const fills = await response.json();
    if (!Array.isArray(fills)) return [];

    return fills.map((fill: {
      coin: string;
      side: string;
      dir: string;
      px: string;
      sz: string;
      time: number;
      fee: string;
      closedPnl: string;
      oid: number;
      hash?: string;
      tid?: number;
    }) => {
      // dir: "Open Long", "Open Short", "Close Long", "Close Short"
      const isClose = fill.dir.toLowerCase().includes('close');
      const isLong = fill.dir.toLowerCase().includes('long');

      return {
        id: `fill-${fill.oid}-${fill.time}`,
        asset: fill.coin,
        action: isClose ? (isLong ? 'CLOSE LONG' : 'CLOSE SHORT') : (isLong ? 'LONG' : 'SHORT'),
        dir: fill.dir,
        date: new Date(fill.time).toLocaleString(),
        price: parseFloat(fill.px),
        quantity: parseFloat(fill.sz),
        notional: parseFloat(fill.px) * parseFloat(fill.sz),
        side: fill.side,
        time: fill.time,
        fee: parseFloat(fill.fee),
        closedPnl: parseFloat(fill.closedPnl),
        hash: fill.hash || null,
        tid: fill.tid || null,
      };
    });
  } catch (error) {
    console.error('Failed to fetch Hyperliquid fills:', error);
    return [];
  }
}

// Fetch live position data from Hyperliquid
async function fetchLiveHyperliquidData(sessionWallet?: { publicKey: string } | null): Promise<{
  accountState: { balance: number; unrealizedPnl: number; marginUsed: number } | null;
  positions: Array<{
    asset: string;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    currentPrice: number;
    quantity: number;
    leverage: number;
    unrealizedPnl: number;
    liquidationPrice?: number;
  }>;
}> {
  const network = process.env.HYPERLIQUID_NETWORK || 'mainnet';

  // Use session wallet first, then fall back to env vars
  let queryAddress: string | null = null;

  if (sessionWallet?.publicKey) {
    queryAddress = sessionWallet.publicKey;
  } else {
    const accountAddress = process.env.HYPERLIQUID_ACCOUNT_ADDRESS;
    const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;

    if (accountAddress) {
      queryAddress = accountAddress;
    } else if (privateKey) {
      const wallet = new Wallet(privateKey);
      queryAddress = wallet.address;
    }
  }

  if (!queryAddress) {
    return { accountState: null, positions: [] };
  }

  try {
    const apiBase = network === 'testnet'
      ? 'https://api.hyperliquid-testnet.xyz'
      : 'https://api.hyperliquid.xyz';

    const response = await fetch(`${apiBase}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'clearinghouseState',
        user: queryAddress,
      }),
    });
    const data = await response.json();

    let accountState = null;
    const positions: Array<{
      asset: string;
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      currentPrice: number;
      quantity: number;
      leverage: number;
      unrealizedPnl: number;
      liquidationPrice?: number;
    }> = [];

    if (data && data.marginSummary) {
      const margin = data.marginSummary;
      const accountValue = parseFloat(margin.accountValue || '0');
      const totalNtlPos = parseFloat(margin.totalNtlPos || '0');
      const totalMarginUsed = parseFloat(margin.totalMarginUsed || '0');

      // Get total unrealized PnL from positions
      let totalUnrealizedPnl = 0;

      if (data.assetPositions && Array.isArray(data.assetPositions)) {
        for (const assetPos of data.assetPositions) {
          const pos = assetPos.position;
          const size = parseFloat(pos.szi);
          if (size === 0) continue;

          const entryPrice = parseFloat(pos.entryPx);
          const positionValue = parseFloat(pos.positionValue);
          const currentPrice = Math.abs(size) > 0 ? positionValue / Math.abs(size) : entryPrice;
          const unrealizedPnl = parseFloat(pos.unrealizedPnl);

          totalUnrealizedPnl += unrealizedPnl;

          positions.push({
            asset: pos.coin,
            side: size > 0 ? 'LONG' : 'SHORT',
            entryPrice,
            currentPrice,
            quantity: Math.abs(size),
            leverage: pos.leverage?.value || 1,
            unrealizedPnl,
            liquidationPrice: pos.liquidationPx ? parseFloat(pos.liquidationPx) : undefined,
          });
        }
      }

      accountState = {
        balance: accountValue,
        unrealizedPnl: totalUnrealizedPnl,
        marginUsed: totalMarginUsed > 0 ? totalMarginUsed : Math.abs(totalNtlPos),
      };
    }

    return { accountState, positions };
  } catch (error) {
    console.error('Failed to fetch live Hyperliquid data:', error);
    return { accountState: null, positions: [] };
  }
}

interface DiaryEntry {
  timestamp: string;
  asset: string;
  action: string;
  rationale?: string;
  allocation_usd?: number;
  amount?: number;
  entry_price?: number;
  tp_price?: number | null;
  sl_price?: number | null;
  exit_plan?: string;
  order_result?: string;
  reason?: string;
  opened_at?: string;
  filled?: boolean;
}

interface MarketData {
  asset: string;
  current_price: number;
  intraday: {
    ema20: number;
    macd: number;
    rsi7: number;
    rsi14: number;
  };
  long_term: {
    ema20: number;
    ema50: number;
    atr14: number;
    rsi_series: number[];
  };
  funding_rate: number;
  funding_annualized_pct: number;
}

interface PositionData {
  symbol: string;
  quantity: number;
  entry_price: number;
  current_price: number;
  liquidation_price?: number;
  unrealized_pnl: number;
  leverage?: number;
}

interface ActiveTrade {
  asset: string;
  is_long: boolean;
  amount: number;
  entry_price: number;
  tp_oid?: string;
  sl_oid?: string;
  exit_plan?: string;
  opened_at?: string;
}

interface PromptLog {
  timestamp: string;
  account: {
    balance: number;
    account_value: number;
    total_return_pct: number;
    positions?: PositionData[];
    active_trades?: ActiveTrade[];
  };
  market_data: MarketData[];
}

interface CompletedTrade {
  id: string;
  asset: string;
  action: string;
  date: string;
  priceFrom: number;
  priceTo: number;
  quantity: number;
  notionalFrom: number;
  notionalTo: number;
  holdingTime: string;
  pnl: number;
}

interface AgentStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgHoldTime: string;
  holdDecisions: number;
  buyDecisions: number;
  sellDecisions: number;
  longs: number;
  shorts: number;
  longVolume: number;
  shortVolume: number;
}

// Parse prompts.log to extract market data context
function parsePromptsLog(projectRoot: string): PromptLog[] {
  const promptsPath = path.join(projectRoot, 'prompts.log');
  if (!existsSync(promptsPath)) return [];

  const content = readFileSync(promptsPath, 'utf-8');
  const entries: PromptLog[] = [];

  // Split by log entries (--- timestamp - ALL ASSETS ---)
  const blocks = content.split(/---\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)\s*-\s*ALL ASSETS\s*---/);

  for (let i = 1; i < blocks.length; i += 2) {
    const timestamp = blocks[i];
    const jsonBlock = blocks[i + 1]?.trim();
    if (!jsonBlock) continue;

    try {
      const data = JSON.parse(jsonBlock);
      entries.push({
        timestamp,
        account: data.account,
        market_data: data.market_data,
      });
    } catch {
      continue;
    }
  }

  return entries;
}

// Parse agent_output.log for LLM reasoning summaries
interface AgentLogEntry {
  timestamp: string;
  type: 'reasoning' | 'decision' | 'info' | 'error';
  asset?: string;
  message: string;
}

function parseAgentOutput(projectRoot: string): AgentLogEntry[] {
  const logPath = path.join(projectRoot, 'agent_output.log');
  if (!existsSync(logPath)) return [];

  const content = readFileSync(logPath, 'utf-8');
  const entries: AgentLogEntry[] = [];

  // Match LLM reasoning summaries
  const reasoningMatches = content.matchAll(
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+)\s*-\s*INFO\s*-\s*LLM reasoning summary:\s*([\s\S]+?)(?=\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}|$)/g
  );

  for (const match of reasoningMatches) {
    const timestamp = match[1].replace(',', '.');
    const reasoning = match[2].trim();

    // Split the reasoning into readable paragraphs (by asset analysis)
    entries.push({
      timestamp,
      type: 'reasoning',
      message: reasoning,
    });
  }

  // Match decision rationales for specific assets
  const decisionMatches = content.matchAll(
    /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+)\s*-\s*INFO\s*-\s*Decision rationale for (\w+):\s*(.+?)(?=\n|$)/g
  );

  for (const match of decisionMatches) {
    entries.push({
      timestamp: match[1].replace(',', '.'),
      type: 'decision',
      asset: match[2],
      message: match[3].trim(),
    });
  }

  return entries;
}

// Create conversational summary from market data
function createMarketSummary(marketData: MarketData): string {
  // Handle null/undefined values when Binance API fails
  const price = marketData.current_price?.toLocaleString() ?? 'N/A';
  const ema20 = marketData.intraday?.ema20?.toLocaleString() ?? 'N/A';
  const macd = marketData.intraday?.macd?.toFixed(2) ?? 'N/A';
  const rsi = marketData.intraday?.rsi14?.toFixed(1) ?? 'N/A';
  const longRsiValue = marketData.long_term?.rsi_series?.[marketData.long_term.rsi_series.length - 1];
  const longRsi = longRsiValue?.toFixed(1) ?? 'N/A';
  const funding = marketData.funding_annualized_pct?.toFixed(1) ?? 'N/A';

  // Handle comparisons with null checks
  const priceVsEma = (marketData.current_price != null && marketData.intraday?.ema20 != null)
    ? (marketData.current_price > marketData.intraday.ema20 ? 'above' : 'below')
    : 'vs';
  const macdStatus = marketData.intraday?.macd != null
    ? (marketData.intraday.macd > 0 ? 'positive' : 'negative')
    : '';
  const rsiNum = marketData.intraday?.rsi14;
  const rsiStatus = rsiNum != null
    ? (rsiNum > 60 ? 'overbought' : rsiNum < 40 ? 'oversold' : 'neutral')
    : 'unknown';
  const longRsiNum = longRsiValue;
  const longRsiStatus = longRsiNum != null
    ? (longRsiNum < 30 ? 'deeply oversold' : longRsiNum > 70 ? 'overbought' : 'weak')
    : 'unknown';

  return `${marketData.asset} @ $${price} • ${priceVsEma} EMA20 ($${ema20}) • MACD ${macdStatus} (${macd}) • RSI ${rsiStatus} (${rsi}) • 4H RSI ${longRsiStatus} (${longRsi}) • Funding ${funding}%`;
}

// Create conversational decision message
function createDecisionMessage(entry: DiaryEntry, marketData?: MarketData): string {
  const action = entry.action.toUpperCase();

  if (entry.action === 'hold') {
    const thinking = entry.rationale || 'No clear setup';
    if (marketData && marketData.intraday?.macd != null && marketData.intraday?.rsi14 != null) {
      const trend = marketData.intraday.macd < 0 ? 'bearish' : 'bullish';
      const rsi = marketData.intraday.rsi14;
      const momentum = rsi < 40 ? 'weak momentum' : rsi > 60 ? 'strong momentum' : 'neutral momentum';
      return `🔍 ${entry.asset}: Staying flat. ${trend} structure with ${momentum}. ${thinking}`;
    }
    return `🔍 ${entry.asset}: ${action} — ${thinking}`;
  }

  if (entry.action === 'buy') {
    const size = entry.allocation_usd ? `$${entry.allocation_usd}` : 'position';
    const entryPrice = entry.entry_price ? `@ $${entry.entry_price.toLocaleString()}` : '';
    const tp = entry.tp_price ? `TP: $${entry.tp_price.toLocaleString()}` : '';
    const sl = entry.sl_price ? `SL: $${entry.sl_price.toLocaleString()}` : '';
    const levels = [tp, sl].filter(Boolean).join(' | ');
    return `🟢 ${entry.asset}: Going LONG ${size} ${entryPrice}. ${levels}. ${entry.exit_plan || entry.rationale || ''}`;
  }

  if (entry.action === 'sell') {
    const size = entry.allocation_usd ? `$${entry.allocation_usd}` : 'position';
    const entryPrice = entry.entry_price ? `@ $${entry.entry_price.toLocaleString()}` : '';
    const tp = entry.tp_price ? `TP: $${entry.tp_price.toLocaleString()}` : '';
    const sl = entry.sl_price ? `SL: $${entry.sl_price.toLocaleString()}` : '';
    const levels = [tp, sl].filter(Boolean).join(' | ');
    return `🔴 ${entry.asset}: Going SHORT ${size} ${entryPrice}. ${levels}. ${entry.exit_plan || entry.rationale || ''}`;
  }

  if (entry.action === 'reconcile_close') {
    return `📊 ${entry.asset}: Position closed. ${entry.reason || 'Hit target or stop'}`;
  }

  return `${entry.asset}: ${action} — ${entry.rationale || 'No details'}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get session for per-user data
    let session = null;
    try {
      session = await getFullSession();
    } catch (err) {
      console.error('Failed to get session:', err);
    }

    // Fetch logs from backend if session exists
    let backendLogs: string[] = [];
    let hyperliquidFills: Awaited<ReturnType<typeof fetchHyperliquidFills>> = [];
    let openOrders: Awaited<ReturnType<typeof fetchOpenOrders>> = [];
    let totalPnLFromHyperliquid: number | null = null;
    if (session) {
      try {
        const logsResponse = await fetch(`${BACKEND_URL}/logs/${session.publicKey}?limit=${limit}`);
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          backendLogs = logsData.logs || [];
        }
      } catch (err) {
        console.error('Failed to fetch backend logs:', err);
      }

      // Fetch recent fills from Hyperliquid
      try {
        hyperliquidFills = await fetchHyperliquidFills(session.publicKey);
      } catch (err) {
        console.error('Failed to fetch Hyperliquid fills:', err);
      }

      // Fetch total PnL (account value - deposits) - matches Hyperliquid UI
      try {
        totalPnLFromHyperliquid = await fetchTotalPnL(session.publicKey);
      } catch (err) {
        console.error('Failed to fetch total PnL:', err);
      }

      // Fetch open orders from Hyperliquid
      try {
        openOrders = await fetchOpenOrders(session.publicKey);
      } catch (err) {
        console.error('Failed to fetch open orders:', err);
      }
    }

    // Use per-user diary file if session exists, otherwise fall back to global diary
    const projectRoot = path.resolve(process.cwd(), '..');
    const globalDiaryPath = path.join(projectRoot, 'diary.jsonl');
    const userDiaryPath = session ? `/tmp/rez_logs/${session.publicKey}_diary.jsonl` : null;

    // Parse diary entries from per-user file first, then fall back to global
    const entries: DiaryEntry[] = [];
    const diaryPaths = userDiaryPath ? [userDiaryPath, globalDiaryPath] : [globalDiaryPath];

    for (const diaryPath of diaryPaths) {
      if (existsSync(diaryPath)) {
        try {
          const content = readFileSync(diaryPath, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as DiaryEntry;
              entries.push(entry);
            } catch {
              // Skip malformed lines
              continue;
            }
          }
        } catch (err) {
          console.error(`Failed to read diary ${diaryPath}:`, err);
        }
      }
    }

    // Separate entries by type
    const tradeEntries = entries.filter(e => e.action === 'buy' || e.action === 'sell');
    const closeEntries = entries.filter(e => e.action === 'reconcile_close');
    const holdEntries = entries.filter(e => e.action === 'hold');

    // Helper to check if order was actually filled
    const wasOrderFilled = (entry: DiaryEntry): boolean => {
      if (!entry.order_result) return false;
      return entry.order_result.includes("'filled':") && !entry.order_result.includes("'error':");
    };

    // Match closed trades with their opening trades
    const completedTrades: CompletedTrade[] = [];

    // First check reconcile_close entries
    for (const close of closeEntries) {
      const openTrade = tradeEntries.find(t =>
        t.asset === close.asset &&
        t.opened_at &&
        close.opened_at &&
        t.opened_at === close.opened_at
      );

      if (openTrade && openTrade.entry_price && openTrade.amount) {
        const openTime = new Date(openTrade.timestamp);
        const closeTime = new Date(close.timestamp);
        const holdMs = closeTime.getTime() - openTime.getTime();
        const holdMins = Math.floor(holdMs / 60000);
        const holdHours = Math.floor(holdMins / 60);
        const holdingTime = holdHours > 0
          ? `${holdHours}h ${holdMins % 60}m`
          : `${holdMins}m`;

        completedTrades.push({
          id: `${close.timestamp}-${close.asset}`,
          asset: close.asset,
          action: openTrade.action === 'buy' ? 'LONG' : 'SHORT',
          date: new Date(close.timestamp).toLocaleString(),
          priceFrom: openTrade.entry_price,
          priceTo: openTrade.entry_price,
          quantity: openTrade.amount,
          notionalFrom: openTrade.allocation_usd || 0,
          notionalTo: openTrade.allocation_usd || 0,
          holdingTime,
          pnl: 0,
        });
      }
    }

    // Also detect completed trades from buy->sell or sell->buy sequences
    const filledTrades = tradeEntries.filter(wasOrderFilled);
    const usedTradeIds = new Set<string>();

    for (let i = 0; i < filledTrades.length; i++) {
      const openTrade = filledTrades[i];
      if (usedTradeIds.has(openTrade.timestamp)) continue;

      // Look for a closing trade (opposite action, same asset, later timestamp)
      for (let j = i + 1; j < filledTrades.length; j++) {
        const closeTrade = filledTrades[j];
        if (usedTradeIds.has(closeTrade.timestamp)) continue;

        if (closeTrade.asset === openTrade.asset &&
            closeTrade.action !== openTrade.action &&
            wasOrderFilled(closeTrade)) {

          usedTradeIds.add(openTrade.timestamp);
          usedTradeIds.add(closeTrade.timestamp);

          const openTime = new Date(openTrade.timestamp);
          const closeTime = new Date(closeTrade.timestamp);
          const holdMs = closeTime.getTime() - openTime.getTime();
          const holdMins = Math.floor(holdMs / 60000);
          const holdHours = Math.floor(holdMins / 60);
          const holdingTime = holdHours > 0
            ? `${holdHours}h ${holdMins % 60}m`
            : `${holdMins}m`;

          // Calculate PnL
          const entryPrice = openTrade.entry_price || 0;
          const exitPrice = closeTrade.entry_price || 0;
          const quantity = openTrade.amount || 0;
          const isLong = openTrade.action === 'buy';
          const pnl = isLong
            ? (exitPrice - entryPrice) * quantity
            : (entryPrice - exitPrice) * quantity;

          completedTrades.push({
            id: `${openTrade.timestamp}-${closeTrade.timestamp}-${openTrade.asset}`,
            asset: openTrade.asset,
            action: isLong ? 'LONG' : 'SHORT',
            date: new Date(closeTrade.timestamp).toLocaleString(),
            priceFrom: entryPrice,
            priceTo: exitPrice,
            quantity: quantity,
            notionalFrom: openTrade.allocation_usd || 0,
            notionalTo: closeTrade.allocation_usd || 0,
            holdingTime,
            pnl: Math.round(pnl * 100) / 100,
          });
          break;
        }
      }
    }

    // Calculate average hold time from completed trades
    const calculateAvgHoldTime = (): string => {
      if (completedTrades.length === 0) return '-';

      let totalMinutes = 0;
      for (const trade of completedTrades) {
        const holdTime = trade.holdingTime;
        let mins = 0;
        const dayMatch = holdTime.match(/(\d+)d/);
        const hourMatch = holdTime.match(/(\d+)h/);
        const minMatch = holdTime.match(/(\d+)m/);
        if (dayMatch) mins += parseInt(dayMatch[1]) * 24 * 60;
        if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
        if (minMatch) mins += parseInt(minMatch[1]);
        totalMinutes += mins;
      }

      const avgMins = Math.floor(totalMinutes / completedTrades.length);
      const days = Math.floor(avgMins / (24 * 60));
      const hours = Math.floor((avgMins % (24 * 60)) / 60);
      const mins = avgMins % 60;

      return `${days}d ${hours}h ${mins}m`;
    };

    // Parse prompts.log for market context
    const promptLogs = parsePromptsLog(projectRoot);
    const latestPrompt = promptLogs[promptLogs.length - 1];

    // Parse agent output for LLM reasoning
    const agentLogs = parseAgentOutput(projectRoot);

    // Create enriched messages with market context
    interface EnrichedMessage {
      id: string;
      type: 'market' | 'decision' | 'trade' | 'info' | 'reasoning';
      message: string;
      timestamp: string;
      asset?: string;
    }

    const enrichedMessages: EnrichedMessage[] = [];

    // Add LLM reasoning summaries (the agent's full thought process) - FIRST so they appear at the top
    for (const log of agentLogs) {
      if (log.type === 'reasoning') {
        // Show the full reasoning as a clean, natural message (like the user's screenshot)
        enrichedMessages.push({
          id: `reasoning-${log.timestamp}`,
          type: 'reasoning',
          message: log.message,
          timestamp: new Date(log.timestamp.replace(' ', 'T')).toLocaleString(),
        });
      }
    }

    // Add market context message if available
    if (latestPrompt) {
      const accountInfo = `💰 Account: $${latestPrompt.account.balance.toFixed(2)} balance | ${latestPrompt.account.total_return_pct.toFixed(2)}% return`;
      enrichedMessages.push({
        id: `account-${latestPrompt.timestamp}`,
        type: 'info',
        message: accountInfo,
        timestamp: new Date(latestPrompt.timestamp.replace(' ', 'T')).toLocaleString(),
      });

      // Add market summaries for each asset
      for (const market of latestPrompt.market_data) {
        enrichedMessages.push({
          id: `market-${market.asset}-${latestPrompt.timestamp}`,
          type: 'market',
          message: createMarketSummary(market),
          timestamp: new Date(latestPrompt.timestamp.replace(' ', 'T')).toLocaleString(),
          asset: market.asset,
        });
      }
    }

    // Only add diary entries if no LLM reasoning is available (fallback)
    // The LLM reasoning is the detailed, conversational text the user wants
    const hasReasoning = agentLogs.some(log => log.type === 'reasoning');
    const recentEntries = entries.slice(-limit).reverse();

    if (!hasReasoning) {
      // Fallback: show diary entries when no reasoning is available
      for (const entry of recentEntries) {
        // Just show the rationale directly without extra formatting
        const message = entry.rationale || `${entry.action.toUpperCase()} ${entry.asset}`;

        let type: 'decision' | 'trade' | 'info' = 'info';
        if (entry.action === 'hold') type = 'decision';
        if (entry.action === 'buy' || entry.action === 'sell') type = 'trade';

        enrichedMessages.push({
          id: `${entry.timestamp}-${entry.asset}`,
          type,
          message,
          timestamp: new Date(entry.timestamp).toLocaleString(),
          asset: entry.asset,
        });
      }
    }

    // Build positions from prompts.log (Hyperliquid positions) and diary (active trades)
    interface FrontendPosition {
      id: string;
      asset: string;
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      currentPrice: number;
      quantity: number;
      leverage?: number;
      unrealizedPnl: number;
      liquidationPrice?: number;
    }

    const positions: FrontendPosition[] = [];

    // Get positions from latest prompts.log (real Hyperliquid positions)
    if (latestPrompt?.account?.positions) {
      for (const pos of latestPrompt.account.positions) {
        if (pos.quantity && Math.abs(pos.quantity) > 0) {
          positions.push({
            id: `pos-${pos.symbol}`,
            asset: pos.symbol,
            side: pos.quantity > 0 ? 'LONG' : 'SHORT',
            entryPrice: pos.entry_price || 0,
            currentPrice: pos.current_price || 0,
            quantity: Math.abs(pos.quantity),
            leverage: pos.leverage,
            unrealizedPnl: pos.unrealized_pnl || 0,
            liquidationPrice: pos.liquidation_price,
          });
        }
      }
    }

    // Also check active_trades from prompts.log
    if (latestPrompt?.account?.active_trades) {
      for (const trade of latestPrompt.account.active_trades) {
        // Only add if not already in positions
        if (!positions.some(p => p.asset === trade.asset)) {
          const marketData = latestPrompt.market_data?.find(m => m.asset === trade.asset);
          positions.push({
            id: `trade-${trade.asset}-${trade.opened_at || Date.now()}`,
            asset: trade.asset,
            side: trade.is_long ? 'LONG' : 'SHORT',
            entryPrice: trade.entry_price || 0,
            currentPrice: marketData?.current_price || trade.entry_price || 0,
            quantity: trade.amount || 0,
            unrealizedPnl: 0,
          });
        }
      }
    }

    // Fallback: Check diary for recent buy/sell entries that haven't been closed
    // usedTradeIds contains timestamps of trades that are part of completed trades
    // Fetch LIVE position and account data from Hyperliquid (real-time)
    const liveData = await fetchLiveHyperliquidData(session);

    // Use live positions from Hyperliquid (authoritative source)
    const livePositions: FrontendPosition[] = liveData.positions.map(pos => ({
      id: `live-${pos.asset}-${Date.now()}`,
      asset: pos.asset,
      side: pos.side,
      entryPrice: pos.entryPrice,
      currentPrice: pos.currentPrice,
      quantity: pos.quantity,
      leverage: pos.leverage,
      unrealizedPnl: pos.unrealizedPnl,
      liquidationPrice: pos.liquidationPrice,
    }));

    // Always use live account state from Hyperliquid (no stale fallback)
    const accountState = liveData.accountState;

    // Add backend logs as enriched messages - ONLY LLM reasoning summaries
    for (const log of backendLogs) {
      // Only include LLM reasoning summaries (the agent's actual thoughts)
      // Skip technical logs like "Importing...", "Initializing...", etc.
      if (!log.includes('LLM reasoning summary:')) {
        continue;
      }

      // Parse timestamp from log format: [2024-01-01T12:00:00.000Z] message
      const match = log.match(/^\[([^\]]+)\]\s*LLM reasoning summary:\s*(.+)$/);
      if (match) {
        enrichedMessages.push({
          id: `backend-${match[1]}-${Math.random()}`,
          type: 'reasoning',
          message: match[2],
          timestamp: new Date(match[1]).toLocaleString(),
        });
      }
    }

    // Helper to format holding time
    const formatHoldingTime = (ms: number): string => {
      const mins = Math.floor(ms / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      if (days > 0) return `${days}d ${hours % 24}h`;
      if (hours > 0) return `${hours}h ${mins % 60}m`;
      return `${mins}m`;
    };

    // Sort fills by time (oldest first for pairing)
    const sortedFills = [...hyperliquidFills].sort((a, b) => a.time - b.time);

    // Track opening fills per asset to calculate holding time
    const openPositions: Map<string, { time: number; price: number }[]> = new Map();

    // Process fills to pair opens with closes
    const processedTrades = sortedFills.map(fill => {
      const isClose = fill.dir?.toLowerCase().includes('close');
      const asset = fill.asset;

      let holdingTime = '-';
      let entryPrice = fill.price;

      if (!isClose) {
        // Opening fill - track it
        if (!openPositions.has(asset)) {
          openPositions.set(asset, []);
        }
        openPositions.get(asset)!.push({ time: fill.time, price: fill.price });
      } else {
        // Closing fill - find matching open
        const opens = openPositions.get(asset);
        if (opens && opens.length > 0) {
          const openFill = opens.shift()!; // FIFO matching
          const holdMs = fill.time - openFill.time;
          holdingTime = formatHoldingTime(holdMs);
          entryPrice = openFill.price;
        }
      }

      return {
        id: fill.id,
        asset: fill.asset,
        action: fill.action,
        date: fill.date,
        priceFrom: entryPrice,
        priceTo: fill.price,
        quantity: fill.quantity,
        notionalFrom: entryPrice * fill.quantity,
        notionalTo: fill.notional,
        holdingTime,
        pnl: fill.closedPnl,
        dir: fill.dir,
        time: fill.time,
        hash: fill.hash,
      };
    });

    // Sort by time descending for display (most recent first)
    const allFillBasedTrades = processedTrades.sort((a, b) => b.time - a.time);

    // For display, only show closing trades (have "Close" in dir field)
    const closingFills = allFillBasedTrades.filter(t =>
      t.dir?.toLowerCase().includes('close') || t.pnl !== 0
    );
    const displayTrades = closingFills.slice(0, 200);

    // Use Hyperliquid fills if available, otherwise fall back to diary-based trades
    const finalCompletedTrades = displayTrades.length > 0 ? displayTrades : completedTrades.reverse();

    // Only compute stats from Hyperliquid fills (accurate source)
    // If no Hyperliquid fills, return null so client keeps last good stats
    let finalStats: AgentStats | null = null;

    if (allFillBasedTrades.length > 0 && totalPnLFromHyperliquid !== null) {
      const allClosingFills = allFillBasedTrades.filter(t =>
        t.dir?.toLowerCase().includes('close') || t.pnl !== 0
      );

      const allLongFills = allFillBasedTrades.filter(t =>
        t.action?.toUpperCase().includes('LONG') || t.action?.toUpperCase() === 'BUY'
      );
      const allShortFills = allFillBasedTrades.filter(t =>
        t.action?.toUpperCase().includes('SHORT') || t.action?.toUpperCase() === 'SELL'
      );

      finalStats = {
        totalTrades: allFillBasedTrades.length,
        winRate: allClosingFills.length > 0
          ? (allClosingFills.filter(t => t.pnl > 0).length / allClosingFills.length) * 100
          : 0,
        totalPnl: totalPnLFromHyperliquid,
        avgHoldTime: calculateAvgHoldTime(),
        holdDecisions: holdEntries.length,
        buyDecisions: allLongFills.length,
        sellDecisions: allShortFills.length,
        longs: allLongFills.length,
        shorts: allShortFills.length,
        longVolume: allLongFills.reduce((sum, t) => sum + (t.notionalFrom || 0), 0),
        shortVolume: allShortFills.reduce((sum, t) => sum + (t.notionalFrom || 0), 0),
      };
    }

    return NextResponse.json({
      entries: recentEntries,
      enrichedMessages,
      completedTrades: finalCompletedTrades,
      positions: livePositions,
      openOrders,
      stats: finalStats,
      accountState,
      backendLogs,
    });
  } catch (error) {
    console.error('Failed to read logs:', error);
    return NextResponse.json({
      error: 'Failed to read logs',
      entries: [],
      completedTrades: [],
      positions: [],
      stats: null,
    }, { status: 500 });
  }
}
