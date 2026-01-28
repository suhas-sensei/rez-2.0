'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';

const TABS = ['AGENT CHAT', 'POSITIONS', 'COMPLETED TRADES'];

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
  isAgentRunning?: boolean;
  onClearMessages?: () => void;
}

// Default placeholder data
const DEFAULT_MESSAGES: AgentMessage[] = [
  { id: 1, type: 'info', message: 'Agent initialized. Waiting for market data...', timestamp: new Date().toLocaleString() },
];

export default function TradesDashboard({
  trades = [],
  positions = [],
  messages = DEFAULT_MESSAGES,
  isAgentRunning = false,
  onClearMessages,
}: TradesDashboardProps) {
  const [activeTab, setActiveTab] = useState('MODELCHAT');
  const [isClosingPositions, setIsClosingPositions] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState<string | number | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [showClearButton, setShowClearButton] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [displayedMessages, setDisplayedMessages] = useState(messages);
  const [newMessageIds, setNewMessageIds] = useState<Set<string | number>>(new Set());
  const { symbol: currencySymbol} = useCurrency();

  // Update displayed messages when messages prop changes (but not when clearing)
  useEffect(() => {
    if (!isClearing) {
      // Track which messages are new
      const currentIds = new Set(displayedMessages.map(m => m.id));
      const incoming = messages.filter(m => !currentIds.has(m.id));
      const incomingIds = new Set(incoming.map(m => m.id));

      setNewMessageIds(incomingIds);
      setDisplayedMessages(messages);

      // Clear new message IDs after animation completes
      if (incomingIds.size > 0) {
        setTimeout(() => setNewMessageIds(new Set()), 600);
      }
    }
  }, [messages, isClearing, displayedMessages]);

  const handleClearMessagesWithAnimation = () => {
    if (!onClearMessages || messages.length === 0) return;

    setIsClearing(true);
    // Wait for animation to complete before clearing
    setTimeout(() => {
      onClearMessages();
      setDisplayedMessages([]);
      setIsClearing(false);
    }, 550);
  };

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
          {activeTab === 'MODELCHAT' ? (
            <span
              className="text-xs xl:text-sm 2xl:text-base text-gray-500 cursor-pointer hover:text-red-500 transition-colors"
              onMouseEnter={() => setShowClearButton(true)}
              onMouseLeave={() => setShowClearButton(false)}
              onClick={handleClearMessagesWithAnimation}
            >
              {showClearButton && messages.length > 0 ? 'Clear Messages' : `${messages.length} Messages`}
            </span>
          ) : (
            <span className="text-xs xl:text-sm 2xl:text-base text-gray-500">
              {activeTab === 'COMPLETED TRADES' && `${trades.length} Trades`}
              {activeTab === 'POSITIONS' && `${positions.length} Open Positions`}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-2 sm:px-3 xl:px-6 py-3 xl:py-5 overflow-auto flex-1">
        {/* MODELCHAT */}
        {activeTab === 'MODELCHAT' && (
          <div className="space-y-3 xl:space-y-4 overflow-x-hidden">
            {displayedMessages.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Agent activity will appear here</p>
              </div>
            ) : (
              displayedMessages.map((msg, index) => {
                const baseClasses = "bg-gray-50/80 rounded-2xl border border-gray-100 shadow-sm p-4 xl:p-5";
                const isNewMessage = newMessageIds.has(msg.id);
                const animationClass = isClearing
                  ? "animate-android-swipe-right"
                  : (isNewMessage ? "animate-android-notification" : "");

                // Add staggered delay when clearing - last message disappears first
                const animationDelay = isClearing ? `${(displayedMessages.length - 1 - index) * 0.1}s` : '0s';

                return (
                  <div
                    key={`${msg.id}-${msg.timestamp}`}
                    className={`${baseClasses} ${animationClass}`}
                    style={{ animationDelay }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] xl:text-xs font-medium text-gray-600">Agent Rez</span>
                      <span className="text-[10px] xl:text-xs text-gray-400">{msg.timestamp}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs xl:text-sm text-gray-400 leading-relaxed">{msg.message}</p>
                  </div>
                );
              })
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
                <div key={pos.id} className="bg-gray-50/50 border-b border-gray-300 pb-4 xl:pb-5 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-medium ${
                        pos.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {pos.side}
                      </span>
                      <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-900">{pos.asset}</span>
                      {pos.leverage && (
                        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
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
                  <div className="ml-0 sm:ml-6 space-y-1 text-[10px] sm:text-xs xl:text-sm text-gray-600">
                    <p>Entry: {currencySymbol}{pos.entryPrice.toLocaleString()} | Current: {currencySymbol}{pos.currentPrice.toLocaleString()}</p>
                    <p>Size: {pos.quantity} {pos.asset}</p>
                    {pos.liquidationPrice && (
                      <p className="text-red-500">Liq. Price: {currencySymbol}{pos.liquidationPrice.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="ml-0 sm:ml-6 mt-2">
                    <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700">Unrealized P&L: </span>
                    <span className={`text-[10px] sm:text-xs xl:text-sm font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.unrealizedPnl >= 0 ? '+' : ''}{currencySymbol}{pos.unrealizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <div key={trade.id} className="bg-gray-50/50 border-b border-gray-300 pb-4 xl:pb-5 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1 sm:gap-0">
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="text-gray-400 text-[10px] sm:text-xs">↻</span>
                      <span className="text-[10px] sm:text-xs xl:text-sm text-gray-600">{trade.action}</span>
                      <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-900">{trade.asset}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-400">{trade.date}</span>
                  </div>
                  <div className="ml-0 sm:ml-6 space-y-1 text-[10px] sm:text-xs xl:text-sm text-gray-600">
                    <p>Price: {currencySymbol}{trade.priceFrom.toLocaleString()} → {currencySymbol}{trade.priceTo.toLocaleString()}</p>
                    <p>Qty: {trade.quantity} | Notional: {currencySymbol}{trade.notionalFrom.toLocaleString()} → {currencySymbol}{trade.notionalTo.toLocaleString()}</p>
                    <p>Holding time: {trade.holdingTime}</p>
                  </div>
                  <div className="ml-0 sm:ml-6 mt-2">
                    <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700">NET P&L: </span>
                    <span className={`text-[10px] sm:text-xs xl:text-sm font-bold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{currencySymbol}{trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
