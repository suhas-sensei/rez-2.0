'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useTimezone } from '@/context/TimezoneContext';

const TABS = ['AGENT CHAT', 'POSITIONS', 'OPEN ORDERS', 'COMPLETED TRADES'];

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
  time?: number; // Unix timestamp for sorting
  hash?: string | null; // Transaction hash for explorer link
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
  type: 'decision' | 'info' | 'trade' | 'error' | 'reasoning' | 'market';
  message: string;
  timestamp: string;
  asset?: string;
}

export interface OpenOrder {
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
}

export interface AgentStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgHoldTime: string;
  sharpeRatio?: number;
  maxDrawdown?: number;
  longs?: number;
  shorts?: number;
  longVolume?: number;
  shortVolume?: number;
}

interface TradesDashboardProps {
  trades?: Trade[];
  positions?: Position[];
  openOrders?: OpenOrder[];
  messages?: AgentMessage[];
  isAgentRunning?: boolean;
  onClearMessages?: () => void;
  onPositionsClosed?: () => void;
}

export default function TradesDashboard({
  trades = [],
  positions = [],
  openOrders = [],
  messages,
  isAgentRunning = false,
  onClearMessages,
  onPositionsClosed,
}: TradesDashboardProps) {
  const { formatAmount } = useCurrency();
  const { formatDateTime } = useTimezone();

  // Default placeholder data with timezone-aware formatting
  const defaultMessages: AgentMessage[] = [
    { id: 1, type: 'info', message: 'Agent initialized. Waiting for market data...', timestamp: formatDateTime(new Date()) },
  ];

  // Use provided messages or default
  const resolvedMessages = messages ?? defaultMessages;

  const [activeTab, setActiveTab] = useState('AGENT CHAT');
  const [isClosingPositions, setIsClosingPositions] = useState(false);
  const [closingPositionId, setClosingPositionId] = useState<string | number | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [showClearButton, setShowClearButton] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [displayedMessages, setDisplayedMessages] = useState(resolvedMessages);
  const [newMessageIds, setNewMessageIds] = useState<Set<string | number>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'holdingTime' | 'entry' | 'exit' | 'quantity'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Helper to parse holding time to minutes for sorting
  const parseHoldingTime = (ht: string): number => {
    if (!ht || ht === '-' || ht === '< 1m') return 0;
    let mins = 0;
    const dayMatch = ht.match(/(\d+)d/);
    const hourMatch = ht.match(/(\d+)h/);
    const minMatch = ht.match(/(\d+)m/);
    if (dayMatch) mins += parseInt(dayMatch[1]) * 24 * 60;
    if (hourMatch) mins += parseInt(hourMatch[1]) * 60;
    if (minMatch) mins += parseInt(minMatch[1]);
    return mins;
  };

  // Compute sorted trades directly (not in useEffect to avoid timing issues)
  const sortedTrades = (() => {
    if (!trades || trades.length === 0) return [];

    const limitedTrades = trades.slice(0, 150);

    const sorted = [...limitedTrades].sort((a, b) => {
      let aVal = 0;
      let bVal = 0;

      switch (sortBy) {
        case 'pnl':
          aVal = Number(a.pnl) || 0;
          bVal = Number(b.pnl) || 0;
          break;
        case 'holdingTime':
          aVal = parseHoldingTime(a.holdingTime);
          bVal = parseHoldingTime(b.holdingTime);
          break;
        case 'entry':
          aVal = Number(a.priceFrom) || 0;
          bVal = Number(b.priceFrom) || 0;
          break;
        case 'exit':
          aVal = Number(a.priceTo) || 0;
          bVal = Number(b.priceTo) || 0;
          break;
        case 'quantity':
          // Multiply by large number to handle small decimal precision
          aVal = (Number(a.quantity) || 0) * 100000000;
          bVal = (Number(b.quantity) || 0) * 100000000;
          break;
        default: // date
          aVal = a.time || 0;
          bVal = b.time || 0;
      }

      // desc: high to low (b - a), asc: low to high (a - b)
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // Debug log
    console.log(`Sort by ${sortBy} (${sortOrder}):`, sorted.slice(0, 5).map(t => ({
      qty: t.quantity,
      pnl: t.pnl,
      date: t.date
    })));

    return sorted;
  })();

  // Update displayed messages when messages prop changes (but not when clearing)
  useEffect(() => {
    if (!isClearing) {
      // Track which messages are new
      const currentIds = new Set(displayedMessages.map(m => m.id));
      const incoming = resolvedMessages.filter(m => !currentIds.has(m.id));
      const incomingIds = new Set(incoming.map(m => m.id));

      setNewMessageIds(incomingIds);
      setDisplayedMessages(resolvedMessages);

      // Clear new message IDs after animation completes
      if (incomingIds.size > 0) {
        setTimeout(() => setNewMessageIds(new Set()), 600);
      }
    }
  }, [resolvedMessages, isClearing, displayedMessages]);

  const handleClearMessagesWithAnimation = () => {
    if (!onClearMessages || resolvedMessages.length === 0) return;

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
      } else {
        // Trigger position refresh on success
        onPositionsClosed?.();
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
      } else {
        // Trigger position refresh on success
        onPositionsClosed?.();
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
          {activeTab === 'AGENT CHAT' ? (
            <span
              className="text-xs xl:text-sm 2xl:text-base text-gray-500 cursor-pointer hover:text-red-500 transition-colors"
              onMouseEnter={() => setShowClearButton(true)}
              onMouseLeave={() => setShowClearButton(false)}
              onClick={handleClearMessagesWithAnimation}
            >
              {(() => {
                const reasoningCount = resolvedMessages.filter(msg => msg.type === 'reasoning').length;
                return showClearButton && reasoningCount > 0 ? 'Clear Messages' : `${reasoningCount} Messages`;
              })()}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs xl:text-sm 2xl:text-base text-gray-500">
                {activeTab === 'COMPLETED TRADES' && `${sortedTrades.length} Trades`}
                {activeTab === 'POSITIONS' && `${positions.length} Open Positions`}
                {activeTab === 'OPEN ORDERS' && `${openOrders.length} Open Orders`}
              </span>
              {activeTab === 'COMPLETED TRADES' && sortedTrades.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                    title="Sort trades"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </button>
                  {showSortDropdown && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                      <div className="p-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">Sort by</span>
                      </div>
                      {[
                        { value: 'date', label: 'Date' },
                        { value: 'pnl', label: 'P&L' },
                        { value: 'holdingTime', label: 'Holding Time' },
                        { value: 'entry', label: 'Entry Price' },
                        { value: 'exit', label: 'Exit Price' },
                        { value: 'quantity', label: 'Quantity' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            if (sortBy === option.value) {
                              setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                            } else {
                              setSortBy(option.value as typeof sortBy);
                              setSortOrder('desc');
                            }
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center justify-between ${
                            sortBy === option.value ? 'bg-gray-50 text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          <span>{option.label}</span>
                          {sortBy === option.value && (
                            <span className="text-gray-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-3 xl:px-6 py-3 xl:py-5 overflow-auto flex-1">
        {/* AGENT CHAT - Show only the agent's internal monologue (reasoning type) */}
        {activeTab === 'AGENT CHAT' && (
          <div className="space-y-3 xl:space-y-4 overflow-x-hidden">
            {(() => {
              // Filter to show only reasoning messages (agent's self-talk)
              const reasoningMessages = displayedMessages.filter(msg => msg.type === 'reasoning');

              if (reasoningMessages.length === 0) {
                return (
                  <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">No agent thoughts yet</p>
                    <p className="text-xs mt-1">The agent's internal reasoning will appear here</p>
                  </div>
                );
              }

              return reasoningMessages.map((msg, index) => {
                const baseClasses = "bg-gray-50/80 rounded-2xl border border-gray-100 shadow-sm p-4 xl:p-5";
                const isNewMessage = newMessageIds.has(msg.id);
                const animationClass = isClearing
                  ? "animate-android-swipe-right"
                  : (isNewMessage ? "animate-android-notification" : "");

                // Add staggered delay when clearing - last message disappears first
                const animationDelay = isClearing ? `${(reasoningMessages.length - 1 - index) * 0.1}s` : '0s';

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
                    <p className="text-[10px] sm:text-xs xl:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  </div>
                );
              });
            })()}
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
                    <p>Entry: {formatAmount(pos.entryPrice)} | Current: {formatAmount(pos.currentPrice)}</p>
                    <p>Size: {pos.quantity} {pos.asset}</p>
                    {pos.liquidationPrice && (
                      <p className="text-red-500">Liq. Price: {formatAmount(pos.liquidationPrice)}</p>
                    )}
                  </div>
                  <div className="ml-0 sm:ml-6 mt-2">
                    <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-700">Unrealized P&L: </span>
                    <span className={`text-[10px] sm:text-xs xl:text-sm font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pos.unrealizedPnl >= 0 ? '+' : ''}{formatAmount(pos.unrealizedPnl)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* OPEN ORDERS */}
        {activeTab === 'OPEN ORDERS' && (
          <div className="space-y-4 xl:space-y-6">
            {openOrders.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No open orders</p>
                <p className="text-xs mt-1">Open orders will appear here</p>
              </div>
            ) : (
              openOrders.map((order) => {
                const isBuy = order.side === 'B';
                const price = parseFloat(order.limitPx);
                const size = parseFloat(order.sz);
                const origSize = parseFloat(order.origSz);
                const orderValue = price * origSize;
                const filledSize = origSize - size;
                const hasTrigger = order.triggerCondition !== 'N/A' && order.triggerPx !== '0.0';

                return (
                  <div key={order.oid} className="bg-gray-50/50 border-b border-gray-300 pb-4 xl:pb-5 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1 sm:gap-0">
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded font-medium ${
                          isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                        <span className="text-[10px] sm:text-xs xl:text-sm font-medium text-gray-900">{order.coin}</span>
                        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {order.orderType}
                        </span>
                        {order.reduceOnly && (
                          <span className="text-[10px] sm:text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            Reduce Only
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-400">
                        {new Date(order.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="ml-0 sm:ml-6 space-y-1 text-[10px] sm:text-xs xl:text-sm text-gray-600">
                      <p>Price: {formatAmount(price)}</p>
                      <p>Size: {size} / {origSize} {order.coin} ({formatAmount(orderValue)})</p>
                      {filledSize > 0 && (
                        <p className="text-blue-600">Filled: {filledSize} {order.coin}</p>
                      )}
                      {hasTrigger && (
                        <p>Trigger: {order.triggerCondition} @ {formatAmount(parseFloat(order.triggerPx))}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* COMPLETED TRADES */}
        {activeTab === 'COMPLETED TRADES' && (
          <div className="space-y-4 xl:space-y-6" key={`${sortBy}-${sortOrder}`}>
            {sortedTrades.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-sm">No completed trades</p>
                <p className="text-xs mt-1">Trade history will appear here</p>
              </div>
            ) : (
              sortedTrades.map((trade) => (
                <div key={trade.id} className="bg-gray-50/50 border-b border-gray-300 pb-4 xl:pb-5 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-0.5 sm:gap-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-gray-400 text-xs">↻</span>
                      <span className="text-xs xl:text-sm text-gray-600">{trade.action}</span>
                      <span className="text-xs xl:text-sm font-semibold text-gray-900">{trade.asset}</span>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-400">{trade.date}</span>
                  </div>
                  <div className="ml-0 sm:ml-6 space-y-1 text-xs xl:text-sm text-gray-600">
                    <p className="hidden sm:block">Entry: {formatAmount(trade.priceFrom)} &rarr; Exit: {formatAmount(trade.priceTo)}</p>
                    <div className="sm:hidden flex gap-4">
                      <p>Entry: <span className="font-medium text-gray-800">{formatAmount(trade.priceFrom)}</span></p>
                      <p>Exit: <span className="font-medium text-gray-800">{formatAmount(trade.priceTo)}</span></p>
                    </div>
                    <p>Qty: {trade.quantity} ({formatAmount(trade.notionalTo)})</p>
                    <p>Holding time: {trade.holdingTime !== '-' ? trade.holdingTime : '< 1m'}</p>
                  </div>
                  <div className="ml-0 sm:ml-6 mt-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs xl:text-sm font-medium text-gray-700">NET P&L: </span>
                      <span className={`text-xs xl:text-sm font-bold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {trade.pnl >= 0 ? '+' : ''}{formatAmount(trade.pnl)}
                      </span>
                    </div>
                    {trade.hash && (
                      <a
                        href={`https://app.hyperliquid-testnet.xyz/explorer/tx/${trade.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] sm:text-[10px] text-gray-400 hover:text-gray-600 hover:underline"
                      >
                        View Transaction
                      </a>
                    )}
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
