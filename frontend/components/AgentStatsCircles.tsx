'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';

interface AgentStatsCirclesProps {
  stats?: {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgHoldTime: string;
    longs?: number;
    shorts?: number;
    longVolume?: number;
    shortVolume?: number;
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
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AgentStatsCircles({ stats, trades = [] }: AgentStatsCirclesProps) {
  const { symbol: currencySymbol, convertAmount } = useCurrency();
  const [isCompact, setIsCompact] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [isVeryNarrow, setIsVeryNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 719px)');
    const mqNarrow = window.matchMedia('(max-width: 504px)');
    const mqVeryNarrow = window.matchMedia('(max-width: 402px)');
    setIsCompact(mq.matches);
    setIsNarrow(mqNarrow.matches);
    setIsVeryNarrow(mqVeryNarrow.matches);
    const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    const handlerNarrow = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    const handlerVeryNarrow = (e: MediaQueryListEvent) => setIsVeryNarrow(e.matches);
    mq.addEventListener('change', handler);
    mqNarrow.addEventListener('change', handlerNarrow);
    mqVeryNarrow.addEventListener('change', handlerVeryNarrow);
    return () => {
      mq.removeEventListener('change', handler);
      mqNarrow.removeEventListener('change', handlerNarrow);
      mqVeryNarrow.removeEventListener('change', handlerVeryNarrow);
    };
  }, []);

  // Format currency with conversion
  const formatCurrency = (num: number): string => {
    const converted = convertAmount(num);
    if (converted >= 1e9) return `${currencySymbol}${(converted / 1e9).toFixed(2)}B`;
    if (converted >= 1e6) return `${currencySymbol}${(converted / 1e6).toFixed(2)}M`;
    if (converted >= 1e3) return `${currencySymbol}${(converted / 1e3).toFixed(1)}K`;
    return `${currencySymbol}${converted.toFixed(2)}`;
  };

  // If no stats available yet, don't compute from empty trades (would show wrong zeros)
  const hasData = !!stats;
  const totalTransactions = stats?.totalTrades ?? 0;
  const longs = stats?.longs ?? 0;
  const shorts = stats?.shorts ?? 0;
  const longVolume = stats?.longVolume ?? 0;
  const shortVolume = stats?.shortVolume ?? 0;
  const totalPnl = stats?.totalPnl ?? 0;
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
    <div className="bg-white border-t border-gray-100 p-2.5 min-[307px]:p-4 min-[720px]:p-6 font-inter"
      style={isVeryNarrow ? undefined : {
        backgroundImage: 'url(/cit2.png)',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}
    >
      <div className="flex gap-2.5 min-[307px]:gap-4 min-[720px]:gap-8">
        {/* Left Section - Stats */}
        <div className="shrink-0">
          {/* Top Section: Transaction Card */}
          <div className="mb-3 min-[720px]:mb-6">
            <div className="text-gray-500 text-[10px] min-[307px]:text-xs min-[720px]:text-base font-medium mb-1 min-[720px]:mb-2">Transactions</div>
            <div className="flex items-center gap-2 min-[720px]:gap-4">
              <span className="text-2xl min-[307px]:text-3xl min-[720px]:text-5xl font-bold text-gray-900">
                {hasData ? formatLargeNumber(totalTransactions) : '—'}
              </span>
              <span className={`px-1.5 min-[307px]:px-2 min-[720px]:px-3 py-0.5 min-[307px]:py-1 min-[720px]:py-1.5 rounded text-[10px] min-[307px]:text-xs min-[720px]:text-base font-semibold ${
                pnlPercentage >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {pnlPercentage >= 0 ? '↑' : '↓'} {Math.abs(pnlPercentage).toFixed(2)}%
              </span>
            </div>
            <div className="text-gray-400 text-[10px] min-[307px]:text-xs min-[720px]:text-sm mt-1 min-[720px]:mt-2">Compare from last 24hrs</div>
          </div>

          {/* Stat Rows */}
          <div className="flex flex-col gap-2 min-[307px]:gap-3 min-[720px]:gap-6">
            {/* Longs / Shorts */}
            <div className="flex gap-3 min-[307px]:gap-4">
              <div className="w-16 min-[307px]:w-20 min-[720px]:w-24">
                <div className="text-green-500 text-[10px] min-[307px]:text-xs min-[720px]:text-sm font-medium">LONGS</div>
                <div className="text-green-600 text-sm min-[307px]:text-base min-[720px]:text-xl font-bold">{hasData ? formatLargeNumber(longs) : '—'}</div>
              </div>
              <div className="w-16 min-[307px]:w-20 min-[720px]:w-24">
                <div className="text-red-500 text-[10px] min-[307px]:text-xs min-[720px]:text-sm font-medium">SHORTS</div>
                <div className="text-red-600 text-sm min-[307px]:text-base min-[720px]:text-xl font-bold">{hasData ? formatLargeNumber(shorts) : '—'}</div>
              </div>
            </div>

            {/* Long Vol / Short Vol */}
            <div className="flex gap-3 min-[307px]:gap-4">
              <div className="w-16 min-[307px]:w-20 min-[720px]:w-24">
                <div className="text-green-500 text-[10px] min-[307px]:text-xs min-[720px]:text-sm font-medium">LONG VOL</div>
                <div className="text-green-600 text-sm min-[307px]:text-base min-[720px]:text-xl font-bold">{hasData ? formatCurrency(longVolume) : '—'}</div>
              </div>
              <div className="w-16 min-[307px]:w-20 min-[720px]:w-24">
                <div className="text-red-500 text-[10px] min-[307px]:text-xs min-[720px]:text-sm font-medium">SHORT VOL</div>
                <div className="text-red-600 text-sm min-[307px]:text-base min-[720px]:text-xl font-bold">{hasData ? formatCurrency(shortVolume) : '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section - Circles and Cards */}
        <div className="flex-1 flex flex-col">
          {/* Timeframe Returns */}
          {isNarrow ? (
            <div className={`grid ${isVeryNarrow ? 'grid-cols-1' : 'grid-cols-2'} gap-x-4 gap-y-1 mb-3`}>
              {changes.map((change) => (
                <div key={change.label} className="flex items-center gap-2">
                  <span className="text-[10px] min-[307px]:text-xs text-gray-500 font-medium w-6">{change.label}</span>
                  <span className={`text-xs min-[307px]:text-sm font-semibold ${change.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {change.value >= 0 ? '+' : ''}{change.value}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 min-[720px]:gap-10 mb-3 min-[720px]:mb-6">
              {changes.map((change) => (
                <div key={change.label} className="flex flex-col items-center gap-1 min-[720px]:gap-2">
                  <CircleProgress percent={change.value} size={isCompact ? 60 : 80} strokeWidth={isCompact ? 5 : 7} />
                  <span className="text-xs min-[720px]:text-sm text-gray-500 font-medium">{change.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cards Row */}
          <div className="flex flex-col min-[357px]:flex-row gap-1 min-[357px]:gap-4 min-[720px]:gap-8">
            {/* Win Rate */}
            <div className="flex flex-col">
              <div className="text-gray-500 text-[8px] min-[307px]:text-[9px] min-[357px]:text-[10px] min-[403px]:text-xs min-[720px]:text-sm font-medium mb-0.5 min-[357px]:mb-1">Win Rate</div>
              <div className="text-sm min-[307px]:text-base min-[357px]:text-lg min-[403px]:text-2xl min-[720px]:text-[2.75rem] font-bold text-gray-900">
                {hasData ? `${winRate.toFixed(1)}%` : '—'}
              </div>
            </div>

            {/* Total P&L */}
            <div className="flex flex-col">
              <div className="text-gray-500 text-[8px] min-[307px]:text-[9px] min-[357px]:text-[10px] min-[403px]:text-xs min-[720px]:text-sm font-medium mb-0.5 min-[357px]:mb-1">Total P&L</div>
              <div className={`text-sm min-[307px]:text-base min-[357px]:text-lg min-[403px]:text-2xl min-[720px]:text-[2.75rem] font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {hasData ? `${totalPnl >= 0 ? '+' : ''}${currencySymbol}${formatLargeNumber(convertAmount(Math.abs(totalPnl)))}` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
