import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { Wallet } from 'ethers';
import { getFullSession } from '@/lib/session';

// Backend API URL (Python server)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

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
    if (session) {
      try {
        const logsResponse = await fetch(`${BACKEND_URL}/logs/${session.sessionId}?limit=${limit}`);
        if (logsResponse.ok) {
          const logsData = await logsResponse.json();
          backendLogs = logsData.logs || [];
        }
      } catch (err) {
        console.error('Failed to fetch backend logs:', err);
      }
    }

    const projectRoot = path.resolve(process.cwd(), '..');
    const diaryPath = path.join(projectRoot, 'diary.jsonl');

    if (!existsSync(diaryPath)) {
      return NextResponse.json({
        entries: [],
        completedTrades: [],
        stats: null,
        message: 'No diary file found'
      });
    }

    const content = readFileSync(diaryPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    // Parse each line as JSON
    const entries: DiaryEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as DiaryEntry;
        entries.push(entry);
      } catch {
        // Skip malformed lines
        continue;
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

    // Calculate stats
    const stats: AgentStats = {
      totalTrades: tradeEntries.length,
      winRate: completedTrades.length > 0
        ? (completedTrades.filter(t => t.pnl > 0).length / completedTrades.length) * 100
        : 0,
      totalPnl: completedTrades.reduce((sum, t) => sum + t.pnl, 0),
      avgHoldTime: calculateAvgHoldTime(),
      holdDecisions: holdEntries.length,
      buyDecisions: tradeEntries.filter(e => e.action === 'buy').length,
      sellDecisions: tradeEntries.filter(e => e.action === 'sell').length,
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

    // Use live account state from Hyperliquid, fallback to prompts.log
    let accountState = liveData.accountState;
    if (!accountState && latestPrompt?.account) {
      const acc = latestPrompt.account;
      accountState = {
        balance: acc.account_value || acc.balance || 0,
        unrealizedPnl: 0,
        marginUsed: 0,
      };
    }

    // Add backend logs as enriched messages (agent output from multi-user backend)
    for (const log of backendLogs) {
      // Parse timestamp from log format: [2024-01-01T12:00:00.000Z] message OR 2024-01-01 12:00:00,000 - INFO - message
      let match = log.match(/^\[([^\]]+)\]\s*(.+)$/);
      if (match) {
        enrichedMessages.push({
          id: `backend-${match[1]}-${Math.random()}`,
          type: 'reasoning',
          message: match[2],
          timestamp: new Date(match[1]).toLocaleString(),
        });
      } else {
        // Try Python logging format: 2024-01-01 12:00:00,000 - LEVEL - message
        match = log.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}),?\d*\s*-\s*\w+\s*-\s*(.+)$/);
        if (match) {
          enrichedMessages.push({
            id: `backend-${match[1]}-${Math.random()}`,
            type: 'reasoning',
            message: match[2],
            timestamp: new Date(match[1].replace(' ', 'T')).toLocaleString(),
          });
        } else if (log.trim()) {
          // Fallback: just show the log as-is
          enrichedMessages.push({
            id: `backend-${Date.now()}-${Math.random()}`,
            type: 'reasoning',
            message: log,
            timestamp: new Date().toLocaleString(),
          });
        }
      }
    }

    return NextResponse.json({
      entries: recentEntries,
      enrichedMessages,
      completedTrades: completedTrades.reverse(),
      positions: livePositions,
      stats,
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
