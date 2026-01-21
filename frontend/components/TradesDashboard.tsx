'use client';

import { useState } from 'react';

const TABS = ['MODELCHAT', 'POSITIONS', 'COMPLETED TRADES', 'AGENT STATS'];

const ASSET_ICONS: Record<string, { emoji: string; color: string }> = {
  BTC: { emoji: '₿', color: 'text-orange-500' },
  ETH: { emoji: '◆', color: 'text-blue-400' },
  SOL: { emoji: '◎', color: 'text-purple-400' },
  AVAX: { emoji: '▲', color: 'text-red-400' },
  DOGE: { emoji: 'Ð', color: 'text-yellow-500' },
  STRK: { emoji: '⚡', color: 'text-purple-500' },
};

export interface Trade {
  id: number | string;
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

export interface Position {
  id: number | string;
  asset: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  leverage?: number;
  unrealizedPnl: number;
  liquidationPrice?: number;
}

export interface AgentMessage {
  id: number | string;
  type: 'decision' | 'info' | 'trade' | 'error';
  message: string;
  timestamp: string;
  asset?: string;
}

export interface AgentStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgHoldTime: string;
  sharpeRatio?: number;
  maxDrawdown?: number;
}

interface TradesDashboardProps {
  trades?: Trade[];
  positions?: Position[];
  messages?: AgentMessage[];
  stats?: AgentStats;
  isAgentRunning?: boolean;
}

// Default placeholder data
const DEFAULT_MESSAGES: AgentMessage[] = [
  { id: 1, type: 'info', message: 'Agent initialized. Waiting for market data...', timestamp: new Date().toLocaleString() },
];

export default function TradesDashboard({
  trades = [],
  positions = [],
  messages = DEFAULT_MESSAGES,
  stats,
  isAgentRunning = false,
}: TradesDashboardProps) {
  const [activeTab, setActiveTab] = useState('MODELCHAT');
  const [isClosingPositions, setIsClosingPositions] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState<string | number | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const handleCloseAllPositions = async () => {
    if (positions.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to close all ${positions.length} position(s)? This will market sell/buy to close.`
    );
    if (!confirmed) return;

    setIsClosingPositions(true);
    setCloseError(null);

    try {
      const response = await fetch('/api/positions/close-all', {
        method: 'POST',
      });
      const data = await response.json();

      if (!data.success) {
        setCloseError(data.error || 'Failed to close positions');
      }
    } catch (error) {
      setCloseError('Network error while closing positions');
      console.error('Failed to close positions:', error);
    } finally {
      setIsClosingPositions(false);
    }
  };

  const handleClosePosition = async (pos: Position) => {
    const confirmed = window.confirm(
      `Close ${pos.side} ${pos.asset} position (${pos.quantity} ${pos.asset})?`
    );
    if (!confirmed) return;

    setClosingPositionId(pos.id);
    setCloseError(null);

    try {
      const response = await fetch('/api/positions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: pos.asset,
          side: pos.side,
          size: pos.quantity,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        setCloseError(data.error || `Failed to close ${pos.asset} position`);
      }
    } catch (error) {
      setCloseError(`Network error closing ${pos.asset} position`);
      console.error('Failed to close position:', error);
    } finally {
      setClosingPositionId(null);
    }
  };

  const messageTypeStyles = {
    decision: 'bg-blue-50 border-blue-200 text-blue-800',
    info: 'bg-gray-50 border-gray-200 text-gray-700',
    trade: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const messageTypeIcons = {
    decision: '🤔',
    info: 'ℹ️',
    trade: '📈',
    error: '⚠️',
  };

  return (
    <div className="bg-white font-inter w-full h-full flex flex-col">
      {/* Tabs */}
      <div className="border-b border-gray-200 shrink-0">
        <div className="w-full px-0 overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 xl:px-5 py-2 xl:py-3 text-[10px] sm:text-xs xl:text-sm 2xl:text-base font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-gray-100 text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-black hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-b border-gray-200 shrink-0">
        <div className="w-full px-3 sm:px-4 xl:px-6 py-2 xl:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAgentRunning ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs xl:text-sm text-green-600 font-medium">Agent Active</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-xs xl:text-sm text-gray-500 font-medium">Agent Stopped</span>
              </>
            )}
          </div>
          <span className="text-xs xl:text-sm 2xl:text-base text-gray-500">
            {activeTab === 'COMPLETED TRADES' && `${trades.length} Trades`}
            {activeTab === 'POSITIONS' && `${positions.length} Open Positions`}
            {activeTab === 'MODELCHAT' && `${messages.length} Messages`}
            {activeTab === 'AGENT STATS' && 'Performance Metrics'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-2 sm:px-3 xl:px-6 py-3 xl:py-5 overflow-auto flex-1">
        {/* MODELCHAT */}
        {activeTab === 'MODELCHAT' && (
          <div className="space-y-3 xl:space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Agent activity will appear here</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`border rounded-lg p-3 xl:p-4 ${messageTypeStyles[msg.type]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base">{messageTypeIcons[msg.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        {msg.asset && (
                          <span className={`text-xs font-medium ${ASSET_ICONS[msg.asset]?.color || 'text-gray-600'}`}>
                            {ASSET_ICONS[msg.asset]?.emoji} {msg.asset}
                          </span>
                        )}
                        <span className="text-[10px] xl:text-xs text-gray-400 shrink-0">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs sm:text-sm xl:text-base">{msg.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* POSITIONS */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-4 xl:space-y-6">
            {/* Close All Button - Always visible */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">
                {positions.length} open position{positions.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleCloseAllPositions}
                disabled={isClosingPositions || positions.length === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 disabled:cursor-not-allowed rounded transition-colors"
              >
                {isClosingPositions ? 'Closing...' : 'Close All Positions'}
              </button>
            </div>
            {closeError && (
              <div className="px-3 py-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">
                {closeError}
              </div>
            )}
            {positions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No open positions</p>
                <p className="text-xs mt-1">Positions will appear here when the agent opens trades</p>
              </div>
            ) : (
              positions.map((pos) => (
                <div key={pos.id} className="border-b border-gray-100 pb-4 xl:pb-6">
                  <div className="flex items-center justify-between mb-2 xl:mb-3">
                    <div className="flex items-center gap-1 sm:gap-2 xl:gap-3 flex-wrap">
                      <span className={`text-[10px] sm:text-xs xl:text-sm px-1.5 sm:px-2 xl:px-3 py-0.5 xl:py-1 rounded font-medium ${
                        pos.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {pos.side}
                      </span>
                      <span className={`text-xs sm:text-sm xl:text-base 2xl:text-lg ${ASSET_ICONS[pos.asset]?.color || 'text-gray-600'}`}>
                        {ASSET_ICONS[pos.asset]?.emoji}
                      </span>
                      <span className="text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium">{pos.asset}</span>
                      {pos.leverage && (
                        <span className="text-[10px] sm:text-xs xl:text-sm text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {pos.leverage}x
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleClosePosition(pos)}
                      disabled={closingPositionId === pos.id}
                      className="px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {closingPositionId === pos.id ? 'Closing...' : 'Close'}
                    </button>
                  </div>
                  <div className="ml-0 sm:ml-6 xl:ml-8 space-y-1 xl:space-y-2 text-xs sm:text-sm xl:text-base 2xl:text-lg text-gray-600">
                    <p>Entry: ${pos.entryPrice.toLocaleString()} | Current: ${pos.currentPrice.toLocaleString()}</p>
                    <p>Size: {pos.quantity} {pos.asset}</p>
                    {pos.liquidationPrice && (
                      <p className="text-red-500">Liq. Price: ${pos.liquidationPrice.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="ml-0 sm:ml-6 xl:ml-8 mt-2 xl:mt-3">
                    <span className="text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium">Unrealized P&L: </span>
                    <span className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COMPLETED TRADES */}
        {activeTab === 'COMPLETED TRADES' && (
          <div className="space-y-4 xl:space-y-6">
            {trades.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No completed trades</p>
                <p className="text-xs mt-1">Trade history will appear here</p>
              </div>
            ) : (
              trades.map((trade) => (
                <div key={trade.id} className="border-b border-gray-100 pb-4 xl:pb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 xl:mb-3 gap-1 sm:gap-0">
                    <div className="flex items-center gap-1 sm:gap-2 xl:gap-3 flex-wrap">
                      <span className="text-gray-400 text-sm xl:text-base 2xl:text-lg">↻</span>
                      <span className="text-xs sm:text-sm xl:text-base 2xl:text-lg text-gray-600">{trade.action}</span>
                      <span className={`text-xs sm:text-sm xl:text-base 2xl:text-lg ${ASSET_ICONS[trade.asset]?.color || 'text-gray-600'}`}>
                        {ASSET_ICONS[trade.asset]?.emoji}
                      </span>
                      <span className="text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium">{trade.asset}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs xl:text-sm text-gray-400">{trade.date}</span>
                  </div>
                  <div className="ml-4 sm:ml-6 xl:ml-8 space-y-1 xl:space-y-2 text-xs sm:text-sm xl:text-base 2xl:text-lg text-gray-600">
                    <p>Price: ${trade.priceFrom.toLocaleString()} → ${trade.priceTo.toLocaleString()}</p>
                    <p>Qty: {trade.quantity} | Notional: ${trade.notionalFrom.toLocaleString()} → ${trade.notionalTo.toLocaleString()}</p>
                    <p>Holding time: {trade.holdingTime}</p>
                  </div>
                  <div className="ml-4 sm:ml-6 xl:ml-8 mt-2 xl:mt-3">
                    <span className="text-xs sm:text-sm xl:text-base 2xl:text-lg font-medium">NET P&L: </span>
                    <span className={`text-xs sm:text-sm xl:text-base 2xl:text-lg font-bold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* AGENT STATS */}
        {activeTab === 'AGENT STATS' && (
          <div>
            {!stats ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No stats available</p>
                <p className="text-xs mt-1">Statistics will appear after the agent completes trades</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 xl:gap-6">
                <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                  <p className="text-xs xl:text-sm text-gray-500 mb-1">Total Trades</p>
                  <p className="text-xl xl:text-2xl font-bold text-gray-900">{stats.totalTrades}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                  <p className="text-xs xl:text-sm text-gray-500 mb-1">Win Rate</p>
                  <p className="text-xl xl:text-2xl font-bold text-gray-900">{stats.winRate.toFixed(1)}%</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                  <p className="text-xs xl:text-sm text-gray-500 mb-1">Total P&L</p>
                  <p className={`text-xl xl:text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                  <p className="text-xs xl:text-sm text-gray-500 mb-1">Avg Hold Time</p>
                  <p className="text-xl xl:text-2xl font-bold text-gray-900">{stats.avgHoldTime}</p>
                </div>
                {stats.sharpeRatio !== undefined && (
                  <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                    <p className="text-xs xl:text-sm text-gray-500 mb-1">Sharpe Ratio</p>
                    <p className="text-xl xl:text-2xl font-bold text-gray-900">{stats.sharpeRatio.toFixed(2)}</p>
                  </div>
                )}
                {stats.maxDrawdown !== undefined && (
                  <div className="bg-gray-50 rounded-lg p-4 xl:p-6">
                    <p className="text-xs xl:text-sm text-gray-500 mb-1">Max Drawdown</p>
                    <p className="text-xl xl:text-2xl font-bold text-red-500">-{stats.maxDrawdown.toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
