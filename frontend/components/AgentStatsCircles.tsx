'use client';

import { useCurrency } from '@/context/CurrencyContext';

interface AgentStatsCirclesProps {
  stats?: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgHoldTime: string;
  };
  trades?: {
    id: number | string;
    asset: string;
    action: string;
    pnl: number;
    notionalFrom: number;
    notionalTo: number;
  }[];
}

// Copied from TransactionsTable.tsx
function CircleProgress({ percent, size = 60, strokeWidth = 6 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const absPercent = Math.abs(percent);
  const fillPercent = Math.min(absPercent, 100);
  const strokeDashoffset = circumference - (fillPercent / 100) * circumference;
  const isProfit = percent >= 0;
  const color = isProfit ? '#22c55e' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className={isProfit ? '' : 'scale-x-[-1]'}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className={`absolute text-sm font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
        {isProfit ? '+' : ''}{percent}%
      </span>
    </div>
  );
}

function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function AgentStatsCircles({ stats, trades = [] }: AgentStatsCirclesProps) {
  const { symbol: currencySymbol, convertAmount } = useCurrency();

  // Format currency with conversion
  const formatCurrency = (num: number): string => {
    const converted = convertAmount(num);
    if (converted >= 1e9) return `${currencySymbol}${(converted / 1e9).toFixed(2)}B`;
    if (converted >= 1e6) return `${currencySymbol}${(converted / 1e6).toFixed(2)}M`;
    if (converted >= 1e3) return `${currencySymbol}${(converted / 1e3).toFixed(1)}K`;
    return `${currencySymbol}${converted.toFixed(2)}`;
  };

  // Calculate stats from trades and positions
  const totalTransactions = stats?.totalTrades ?? trades.length;

  // Count longs and shorts from trades
  const longs = trades.filter(t => t.action?.toUpperCase().includes('LONG') || t.action?.toUpperCase() === 'BUY').length;
  const shorts = trades.filter(t => t.action?.toUpperCase().includes('SHORT') || t.action?.toUpperCase() === 'SELL').length;

  // Calculate volumes
  const longVolume = trades
    .filter(t => t.action?.toUpperCase().includes('LONG') || t.action?.toUpperCase() === 'BUY')
    .reduce((sum, t) => sum + (t.notionalFrom || 0), 0);
  const shortVolume = trades
    .filter(t => t.action?.toUpperCase().includes('SHORT') || t.action?.toUpperCase() === 'SELL')
    .reduce((sum, t) => sum + (t.notionalFrom || 0), 0);

  // Get stats
  const totalPnl = stats?.totalPnl ?? trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = stats?.winRate ?? 0;

  // Calculate PnL percentage
  const totalVolume = longVolume + shortVolume;
  const pnlPercentage = totalVolume > 0 ? parseFloat(((totalPnl / totalVolume) * 100).toFixed(2)) : 0;

  // Timeframe returns
  const changes = [
    { label: '5M', value: 0 },
    { label: '1H', value: parseFloat((pnlPercentage * 0.1).toFixed(2)) },
    { label: '6H', value: parseFloat((pnlPercentage * 0.4).toFixed(2)) },
    { label: '24H', value: pnlPercentage },
  ];

  return (
    <div className="bg-white border-t border-gray-100 p-6 font-inter"
      style={{
        backgroundImage: 'url(/cit2.png)',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '70% auto',
      }}
    >
      <div className="flex gap-8">
        {/* Left Section - Stats */}
        <div className="shrink-0">
          {/* Top Section: Transaction Card */}
          <div className="mb-6">
            <div className="text-gray-500 text-base font-medium mb-2">Transactions</div>
            <div className="flex items-center gap-4">
              <span className="text-5xl font-bold text-gray-900">
                {formatLargeNumber(totalTransactions)}
              </span>
              <span className={`px-3 py-1.5 rounded text-base font-semibold ${
                pnlPercentage >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {pnlPercentage >= 0 ? '↑' : '↓'} {Math.abs(pnlPercentage).toFixed(2)}%
              </span>
            </div>
            <div className="text-gray-400 text-sm mt-2">Compare from last 24hrs</div>
          </div>

          {/* Stat Rows */}
          <div className="flex flex-col gap-6">
            {/* Longs / Shorts */}
            <div className="flex gap-4">
              <div className="w-24">
                <div className="text-green-500 text-sm font-medium">LONGS</div>
                <div className="text-green-600 text-xl font-bold">{formatLargeNumber(longs)}</div>
              </div>
              <div className="w-24">
                <div className="text-red-500 text-sm font-medium">SHORTS</div>
                <div className="text-red-600 text-xl font-bold">{formatLargeNumber(shorts)}</div>
              </div>
            </div>

            {/* Long Vol / Short Vol */}
            <div className="flex gap-4">
              <div className="w-24">
                <div className="text-green-500 text-sm font-medium">LONG VOL</div>
                <div className="text-green-600 text-xl font-bold">{formatCurrency(longVolume)}</div>
              </div>
              <div className="w-24">
                <div className="text-red-500 text-sm font-medium">SHORT VOL</div>
                <div className="text-red-600 text-xl font-bold">{formatCurrency(shortVolume)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Circles and Cards */}
        <div className="flex-1 flex flex-col">
          {/* Circular Progress Indicators */}
          <div className="flex items-center gap-10 mb-6">
            {changes.map((change) => (
              <div key={change.label} className="flex flex-col items-center gap-2">
                <CircleProgress percent={change.value} size={80} strokeWidth={7} />
                <span className="text-sm text-gray-500 font-medium">{change.label}</span>
              </div>
            ))}
          </div>

          {/* Cards Row */}
          <div className="flex gap-8">
            {/* Win Rate */}
            <div className="flex flex-col">
              <div className="text-gray-500 text-sm font-medium mb-1">Win Rate</div>
              <div className="text-[2.75rem] font-bold text-gray-900">
                {winRate.toFixed(1)}%
              </div>
            </div>

            {/* Total P&L */}
            <div className="flex flex-col">
              <div className="text-gray-500 text-sm font-medium mb-1">Total P&L</div>
              <div className={`text-[2.75rem] font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalPnl >= 0 ? '+' : ''}{currencySymbol}{formatLargeNumber(convertAmount(Math.abs(totalPnl)))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
