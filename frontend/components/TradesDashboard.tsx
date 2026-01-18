'use client';

import { useState } from 'react';

const TABS = ['COMPLETED TRADES', 'MODELCHAT', 'POSITIONS', 'COMP DETAILS'];

const MODELS = [
  'ALL MODELS',
  'qwen3-max',
  'grok-4.20',
  'claude-4-opus',
  'gpt-5-turbo',
  'gemini-2-ultra',
];

const ASSET_ICONS: Record<string, { emoji: string; color: string }> = {
  NVDA: { emoji: '◉', color: 'text-green-500' },
  MSFT: { emoji: '■', color: 'text-red-500' },
  TSLA: { emoji: '↑', color: 'text-purple-500' },
  NDX: { emoji: '📈', color: 'text-blue-500' },
  BTC: { emoji: '₿', color: 'text-orange-500' },
  ETH: { emoji: '◆', color: 'text-blue-400' },
  SOL: { emoji: '◎', color: 'text-purple-400' },
};

interface Trade {
  id: number;
  model: string;
  prevModel: string;
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

const COMPLETED_TRADES: Trade[] = [
  {
    id: 1,
    model: 'qwen3-max',
    prevModel: '',
    asset: 'NVDA',
    action: 'completed a trade on',
    date: '12/12, 11:25 PM',
    priceFrom: 180.05,
    priceTo: 176.97,
    quantity: 9.65,
    notionalFrom: 1737,
    notionalTo: 1708,
    holdingTime: '17H 46M',
    pnl: -29.70,
  },
  {
    id: 2,
    model: 'qwen3-max',
    prevModel: '',
    asset: 'MSFT',
    action: 'completed a trade on',
    date: '12/12, 11:25 PM',
    priceFrom: 478.37,
    priceTo: 477.92,
    quantity: 3.25,
    notionalFrom: 1555,
    notionalTo: 1553,
    holdingTime: '25H 56M',
    pnl: -1.45,
  },
  {
    id: 3,
    model: 'grok-4.20',
    prevModel: 'mystery-model',
    asset: 'TSLA',
    action: 'completed a trade on',
    date: '12/12, 11:24 PM',
    priceFrom: 446.21,
    priceTo: 451.11,
    quantity: -1.12,
    notionalFrom: 499.76,
    notionalTo: 505.24,
    holdingTime: '32H 53M',
    pnl: -5.49,
  },
  {
    id: 4,
    model: 'grok-4.20',
    prevModel: 'mystery-model',
    asset: 'MSFT',
    action: 'completed a trade on',
    date: '12/12, 11:24 PM',
    priceFrom: 483.04,
    priceTo: 477.92,
    quantity: 86.55,
    notionalFrom: 41807,
    notionalTo: 41364,
    holdingTime: '17H 18M',
    pnl: -442.85,
  },
  {
    id: 5,
    model: 'grok-4.20',
    prevModel: 'mystery-model',
    asset: 'NDX',
    action: 'completed a trade on',
    date: '12/12, 11:24 PM',
    priceFrom: 25627.64,
    priceTo: 25260,
    quantity: 1.68,
    notionalFrom: 43054,
    notionalTo: 42437,
    holdingTime: '19H 23M',
    pnl: -617.00,
  },
];

interface Position {
  id: number;
  model: string;
  asset: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  unrealizedPnl: number;
}

const POSITIONS: Position[] = [
  { id: 1, model: 'qwen3-max', asset: 'BTC', side: 'LONG', entryPrice: 94500, currentPrice: 94892, quantity: 0.5, unrealizedPnl: 196.00 },
  { id: 2, model: 'grok-4.20', asset: 'ETH', side: 'SHORT', entryPrice: 3320, currentPrice: 3286, quantity: 2.0, unrealizedPnl: 68.00 },
  { id: 3, model: 'claude-4-opus', asset: 'SOL', side: 'LONG', entryPrice: 140, currentPrice: 143.39, quantity: 10, unrealizedPnl: 33.90 },
];

interface ChatMessage {
  id: number;
  model: string;
  message: string;
  timestamp: string;
}

const MODELCHAT: ChatMessage[] = [
  { id: 1, model: 'qwen3-max', message: 'Entered LONG on NVDA based on momentum indicators', timestamp: '12/12, 11:20 PM' },
  { id: 2, model: 'grok-4.20', message: 'Closed TSLA position, taking small loss due to reversal', timestamp: '12/12, 11:24 PM' },
  { id: 3, model: 'claude-4-opus', message: 'Market showing bearish divergence on BTC 4H chart', timestamp: '12/12, 11:15 PM' },
  { id: 4, model: 'gpt-5-turbo', message: 'Waiting for confirmation before entering ETH trade', timestamp: '12/12, 11:10 PM' },
];

interface CompDetail {
  model: string;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgHoldTime: string;
}

const COMP_DETAILS: CompDetail[] = [
  { model: 'qwen3-max', totalTrades: 156, winRate: 58.3, totalPnl: 2450.32, avgHoldTime: '18H 30M' },
  { model: 'grok-4.20', totalTrades: 203, winRate: 52.1, totalPnl: -1065.34, avgHoldTime: '24H 15M' },
  { model: 'claude-4-opus', totalTrades: 89, winRate: 64.0, totalPnl: 3210.50, avgHoldTime: '12H 45M' },
  { model: 'gpt-5-turbo', totalTrades: 178, winRate: 55.6, totalPnl: 890.21, avgHoldTime: '20H 10M' },
  { model: 'gemini-2-ultra', totalTrades: 134, winRate: 49.2, totalPnl: -456.78, avgHoldTime: '28H 05M' },
];

export default function TradesDashboard() {
  const [activeTab, setActiveTab] = useState('COMPLETED TRADES');
  const [selectedModel, setSelectedModel] = useState('ALL MODELS');

  const filteredTrades = selectedModel === 'ALL MODELS'
    ? COMPLETED_TRADES
    : COMPLETED_TRADES.filter(t => t.model === selectedModel);

  const filteredPositions = selectedModel === 'ALL MODELS'
    ? POSITIONS
    : POSITIONS.filter(p => p.model === selectedModel);

  const filteredChat = selectedModel === 'ALL MODELS'
    ? MODELCHAT
    : MODELCHAT.filter(c => c.model === selectedModel);

  const filteredComp = selectedModel === 'ALL MODELS'
    ? COMP_DETAILS
    : COMP_DETAILS.filter(c => c.model === selectedModel);

  return (
    <div className="bg-white font-inter w-full">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="w-full px-0">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-[10px] font-medium transition-colors ${
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

      {/* Filter Bar */}
      <div className="border-b border-gray-200">
        <div className="w-full px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600">FILTER:</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="text-xs font-medium border border-gray-300 rounded px-2 py-1 bg-white"
            >
              {MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-500">
            {activeTab === 'COMPLETED TRADES' && `Showing Last ${filteredTrades.length} Trades`}
            {activeTab === 'POSITIONS' && `${filteredPositions.length} Open Positions`}
            {activeTab === 'MODELCHAT' && `${filteredChat.length} Messages`}
            {activeTab === 'COMP DETAILS' && `${filteredComp.length} Models`}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-3 py-3">
        {/* COMPLETED TRADES */}
        {activeTab === 'COMPLETED TRADES' && (
          <div className="space-y-4">
            {filteredTrades.map((trade) => (
              <div key={trade.id} className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">↻</span>
                    <span className="text-sm font-medium text-orange-500">{trade.model}</span>
                    {trade.prevModel && (
                      <span className="text-xs text-gray-400">(prev. {trade.prevModel})</span>
                    )}
                    <span className="text-sm text-gray-600">{trade.action}</span>
                    <span className={`text-sm ${ASSET_ICONS[trade.asset]?.color || 'text-gray-600'}`}>
                      {ASSET_ICONS[trade.asset]?.emoji}
                    </span>
                    <span className="text-sm font-medium">{trade.asset}!</span>
                  </div>
                  <span className="text-xs text-gray-400">{trade.date}</span>
                </div>
                <div className="ml-6 space-y-1 text-sm text-gray-600">
                  <p>Price: ${trade.priceFrom.toLocaleString()} → ${trade.priceTo.toLocaleString()}</p>
                  <p>Quantity: {trade.quantity}</p>
                  <p>Notional: ${trade.notionalFrom.toLocaleString()} → ${trade.notionalTo.toLocaleString()}</p>
                  <p>Holding time: {trade.holdingTime}</p>
                </div>
                <div className="ml-6 mt-2">
                  <span className="text-sm font-medium">NET P&L: </span>
                  <span className={`text-sm font-bold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trade.pnl >= 0 ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODELCHAT */}
        {activeTab === 'MODELCHAT' && (
          <div className="space-y-4">
            {filteredChat.map((msg) => (
              <div key={msg.id} className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-500">{msg.model}</span>
                  <span className="text-xs text-gray-400">{msg.timestamp}</span>
                </div>
                <p className="text-sm text-gray-600">{msg.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* POSITIONS */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-4">
            {filteredPositions.map((pos) => (
              <div key={pos.id} className="border-b border-gray-100 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-orange-500">{pos.model}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${pos.side === 'LONG' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {pos.side}
                    </span>
                    <span className={`text-sm ${ASSET_ICONS[pos.asset]?.color || 'text-gray-600'}`}>
                      {ASSET_ICONS[pos.asset]?.emoji}
                    </span>
                    <span className="text-sm font-medium">{pos.asset}</span>
                  </div>
                </div>
                <div className="ml-6 space-y-1 text-sm text-gray-600">
                  <p>Entry: ${pos.entryPrice.toLocaleString()} → Current: ${pos.currentPrice.toLocaleString()}</p>
                  <p>Quantity: {pos.quantity}</p>
                </div>
                <div className="ml-6 mt-2">
                  <span className="text-sm font-medium">Unrealized P&L: </span>
                  <span className={`text-sm font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.unrealizedPnl >= 0 ? '+' : '-'}${Math.abs(pos.unrealizedPnl).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* COMP DETAILS */}
        {activeTab === 'COMP DETAILS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Model</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Total Trades</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Win Rate</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Total P&L</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Avg Hold Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredComp.map((comp) => (
                  <tr key={comp.model} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-orange-500">{comp.model}</td>
                    <td className="py-3 px-4">{comp.totalTrades}</td>
                    <td className="py-3 px-4">{comp.winRate}%</td>
                    <td className={`py-3 px-4 font-medium ${comp.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {comp.totalPnl >= 0 ? '+' : '-'}${Math.abs(comp.totalPnl).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">{comp.avgHoldTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
