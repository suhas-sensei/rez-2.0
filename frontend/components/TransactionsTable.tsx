'use client';

import { useState, useEffect } from 'react';

const TABS = ['TOKEN INFO', 'TRANSACTIONS'];

// Hyperliquid API endpoint
const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info';

interface TokenInfo {
  transactions: number;
  totalChange: number;
  changes: { label: string; value: number }[];
  stats: {
    label: string;
    leftLabel: string;
    rightLabel: string;
    leftValue: number;
    rightValue: number;
    greenBars: number[];
    redBars: number[];
    formatType: 'number' | 'currency' | 'funding';
  }[];
  liquidity: number;
  volume: number;
  funding: number;
  countdown: string;
}

// Format functions
function formatNumber(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatFunding(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(4)}%`;
}

function formatValue(n: number, formatType: string, isRight: boolean = false): string {
  if (formatType === 'funding' && isRight) return formatFunding(n);
  if (formatType === 'currency') return formatCurrency(n);
  return formatNumber(n);
}

const DEFAULT_TOKEN_INFO: TokenInfo = {
  transactions: 0,
  totalChange: 0,
  changes: [
    { label: '5M', value: 0 },
    { label: '1H', value: 0 },
    { label: '6H', value: 0 },
    { label: '24H', value: 0 },
  ],
  stats: [
    {
      label: 'LONGS / SHORTS',
      leftLabel: 'LONGS',
      rightLabel: 'SHORTS',
      leftValue: 0,
      rightValue: 0,
      greenBars: [1, 1, 1, 1, 1, 1, 1, 1],
      redBars: [1, 1, 1, 1, 1, 1, 1, 1],
      formatType: 'number',
    },
    {
      label: 'LONG VOL / SHORT VOL',
      leftLabel: 'LONG VOL',
      rightLabel: 'SHORT VOL',
      leftValue: 0,
      rightValue: 0,
      greenBars: [1, 1, 1, 1, 1, 1, 1, 1],
      redBars: [1, 1, 1, 1, 1, 1, 1, 1],
      formatType: 'currency',
    },
    {
      label: 'OPEN INTEREST',
      leftLabel: 'OI',
      rightLabel: '',
      leftValue: 0,
      rightValue: 0,
      greenBars: [1, 1, 1, 1, 1, 1, 1, 1],
      redBars: [1, 1, 1, 1, 1, 1, 1, 1],
      formatType: 'currency',
    },
  ],
  liquidity: 0,
  volume: 0,
  funding: 0,
  countdown: '00:00:00',
};

// Generate bar heights with natural variation
function generateBars(): number[] {
  return Array(8).fill(0).map(() => 0.5 + Math.random() * 0.5);
}

function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

// Progress bar for buy/sell comparison
function ComparisonBar({ leftValue, rightValue }: { leftValue: number; rightValue: number }) {
  const total = leftValue + rightValue;
  const leftPercent = (leftValue / total) * 100;

  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
      <div
        className="h-full bg-green-500"
        style={{ width: `${leftPercent}%` }}
      />
      <div
        className="h-full bg-red-500"
        style={{ width: `${100 - leftPercent}%` }}
      />
    </div>
  );
}

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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
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
      <span className={`absolute text-[10px] xl:text-sm font-semibold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
        {isProfit ? '+' : ''}{percent}%
      </span>
    </div>
  );
}

// Gauge chart with needle for revenue goal style display
function GaugeChart({ percent, size = 100 }: { percent: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  // Semi-circle arc length (180 degrees)
  const arcLength = Math.PI * radius;
  const fillLength = (percent / 100) * arcLength;
  // Needle angle: -90 (left) to 90 (right), 0 is top
  const needleAngle = -90 + (percent / 100) * 180;
  const needleLength = radius - 10;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size / 2 + 20 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="#22c55e"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${arcLength}`}
        />
        {/* Needle */}
        <line
          x1={size / 2}
          y1={size / 2}
          x2={size / 2 + needleLength * Math.sin((needleAngle * Math.PI) / 180)}
          y2={size / 2 - needleLength * Math.cos((needleAngle * Math.PI) / 180)}
          stroke="#374151"
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={size / 2} cy={size / 2} r={4} fill="#374151" />
      </svg>
    </div>
  );
}

interface Transaction {
  id: string;
  date: string;
  type: 'Buy' | 'Sell';
  usd: number;
  eth: number;
  usdc: number;
  price: number;
  maker: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '15s ago', type: 'Buy', usd: 2870.79, eth: 0.8914, usdc: 2870.79, price: 3221.25, maker: '46B325' },
  { id: '2', date: '39s ago', type: 'Buy', usd: 315.86, eth: 0.09811, usdc: 315.86, price: 3219.12, maker: '8c1906' },
  { id: '3', date: '51s ago', type: 'Sell', usd: 124.87, eth: 0.03879, usdc: 124.87, price: 3218.89, maker: '2CFc88' },
  { id: '4', date: '51s ago', type: 'Buy', usd: 157.27, eth: 0.04885, usdc: 157.27, price: 3218.98, maker: '689a82' },
  { id: '5', date: '51s ago', type: 'Buy', usd: 64.86, eth: 0.02015, usdc: 64.86, price: 3218.87, maker: 'C29E3B' },
  { id: '6', date: '1m ago', type: 'Sell', usd: 1250.00, eth: 0.3882, usdc: 1250.00, price: 3220.01, maker: 'A1B2C3' },
  { id: '7', date: '1m ago', type: 'Buy', usd: 500.00, eth: 0.1553, usdc: 500.00, price: 3219.50, maker: 'D4E5F6' },
  { id: '8', date: '2m ago', type: 'Buy', usd: 890.45, eth: 0.2765, usdc: 890.45, price: 3220.75, maker: '7G8H9I' },
];

interface TransactionsTableProps {
  coin?: string;
}

export default function TransactionsTable({ coin = 'ETH' }: TransactionsTableProps) {
  const [activeTab, setActiveTab] = useState('TOKEN INFO');
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>(DEFAULT_TOKEN_INFO);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHyperliquidData() {
      try {
        // Fetch meta info for all coins
        const metaResponse = await fetch(HYPERLIQUID_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        });
        const metaData = await metaResponse.json();
        console.log('Hyperliquid Meta:', metaData);

        // Find coin data (index 1 typically, but search to be safe)
        const assetCtxs = metaData[1] || [];
        const meta = metaData[0]?.universe || [];
        const coinIndex = meta.findIndex((m: { name: string }) => m.name === coin);
        const coinCtx = assetCtxs[coinIndex];

        if (coinCtx) {
          const volume24h = parseFloat(coinCtx.dayNtlVlm || '0');
          const openInterest = parseFloat(coinCtx.openInterest || '0');
          const markPx = parseFloat(coinCtx.markPx || '0');
          const prevDayPx = parseFloat(coinCtx.prevDayPx || '0');
          const funding = parseFloat(coinCtx.funding || '0') * 100;

          // Calculate price changes using candle data
          const now = Date.now();
          const intervals = [
            { label: '5M', ms: 5 * 60 * 1000 },
            { label: '1H', ms: 60 * 60 * 1000 },
            { label: '6H', ms: 6 * 60 * 60 * 1000 },
            { label: '24H', ms: 24 * 60 * 60 * 1000 },
          ];

          // Fetch candle data for price changes
          const candleResponse = await fetch(HYPERLIQUID_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'candleSnapshot',
              req: { coin: coin, interval: '1h', startTime: now - 25 * 60 * 60 * 1000, endTime: now },
            }),
          });
          const candles = await candleResponse.json();

          // Calculate changes from candle data
          const currentPrice = markPx;
          const priceChanges = intervals.map(({ label, ms }) => {
            const targetTime = now - ms;
            // Find the candle closest to (but not after) the target time
            let closestCandle = null;
            let minDiff = Infinity;
            for (const candle of candles) {
              if (candle.t <= targetTime) {
                const diff = targetTime - candle.t;
                if (diff < minDiff) {
                  minDiff = diff;
                  closestCandle = candle;
                }
              }
            }
            if (closestCandle) {
              const oldPrice = parseFloat(closestCandle.c);
              return { label, value: parseFloat((((currentPrice - oldPrice) / oldPrice) * 100).toFixed(2)) };
            }
            return { label, value: 0 };
          });

          // 24h price change
          const change24h = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;
          priceChanges[3] = { label: '24H', value: parseFloat(change24h.toFixed(2)) };

          // Estimate buy/sell from funding rate (positive = more longs, negative = more shorts)
          const buyRatio = funding >= 0 ? 0.52 : 0.48;
          const estimatedTrades = Math.round(volume24h / (markPx * 0.5)); // Rough trade count estimate
          const buys = Math.round(estimatedTrades * buyRatio);
          const sells = estimatedTrades - buys;

          // Calculate countdown to next funding (hourly funding on Hyperliquid)
          const nowUTC = Date.now();
          const currentDate = new Date(nowUTC);

          // Next funding is at the start of the next hour
          const targetDate = new Date(currentDate);
          targetDate.setUTCMinutes(0, 0, 0);
          targetDate.setUTCHours(targetDate.getUTCHours() + 1);

          // Calculate difference in milliseconds
          const diffMs = targetDate.getTime() - nowUTC;
          const totalSeconds = Math.floor(diffMs / 1000);
          const hoursUntil = Math.floor(totalSeconds / 3600);
          const minutesUntil = Math.floor((totalSeconds % 3600) / 60);
          const secondsUntil = totalSeconds % 60;
          const countdown = `${String(hoursUntil).padStart(2, '0')}:${String(minutesUntil).padStart(2, '0')}:${String(secondsUntil).padStart(2, '0')}`;

          setTokenInfo({
            transactions: estimatedTrades,
            totalChange: change24h,
            changes: priceChanges,
            stats: [
              {
                label: 'LONGS / SHORTS',
                leftLabel: 'LONGS',
                rightLabel: 'SHORTS',
                leftValue: buys,
                rightValue: sells,
                greenBars: generateBars(),
                redBars: generateBars(),
                formatType: 'number',
              },
              {
                label: 'LONG VOL / SHORT VOL',
                leftLabel: 'LONG VOL',
                rightLabel: 'SHORT VOL',
                leftValue: volume24h * buyRatio,
                rightValue: volume24h * (1 - buyRatio),
                greenBars: generateBars(),
                redBars: generateBars(),
                formatType: 'currency',
              },
              {
                label: 'OPEN INTEREST',
                leftLabel: 'OI',
                rightLabel: '',
                leftValue: openInterest * markPx,
                rightValue: 0,
                greenBars: generateBars(),
                redBars: generateBars(),
                formatType: 'currency',
              },
            ],
            liquidity: openInterest * markPx, // Use OI as proxy for liquidity
            volume: volume24h,
            funding: funding,
            countdown: countdown,
          });
        }
      } catch (error) {
        console.error('Failed to fetch Hyperliquid data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHyperliquidData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchHyperliquidData, 10000);
    return () => clearInterval(interval);
  }, [coin]);

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const nowUTC = Date.now();
      const currentDate = new Date(nowUTC);

      // Next funding is at the start of the next hour
      const targetDate = new Date(currentDate);
      targetDate.setUTCMinutes(0, 0, 0);
      targetDate.setUTCHours(targetDate.getUTCHours() + 1);

      // Calculate difference in milliseconds
      const diffMs = targetDate.getTime() - nowUTC;
      const totalSeconds = Math.floor(diffMs / 1000);
      const hoursUntil = Math.floor(totalSeconds / 3600);
      const minutesUntil = Math.floor((totalSeconds % 3600) / 60);
      const secondsUntil = totalSeconds % 60;
      const countdown = `${String(hoursUntil).padStart(2, '0')}:${String(minutesUntil).padStart(2, '0')}:${String(secondsUntil).padStart(2, '0')}`;

      setTokenInfo((prev) => ({ ...prev, countdown }));
    };

    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full flex flex-col bg-white text-gray-900 font-inter overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200 shrink-0">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 xl:px-5 py-2 xl:py-3 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap ${
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

      {/* Content */}
      <div
        className="flex-1 overflow-auto scrollbar-hide relative"
        style={activeTab === 'TOKEN INFO' ? {
          backgroundImage: 'url(/cit2.png)',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '70% auto',
        } : undefined}
      >
        {activeTab === 'TOKEN INFO' ? (
          <div className="p-3 xl:p-6 relative">
            {/* Rez Logo */}
            <div className="sticky bottom-2 left-full -ml-14 w-10 h-10 pointer-events-none z-10 float-right">
              <img
                src="/rez1.png"
                alt="Rez"
                className="w-10 opacity-60"
              />
            </div>
            <div className="flex gap-4 xl:gap-8">
              {/* Left Section - Stats */}
              <div className="shrink-0">
                {/* Top Section: Transaction Card */}
                <div className="mb-3 xl:mb-6">
                  <div className="text-gray-500 text-sm xl:text-base font-medium mb-1 xl:mb-2">Transactions</div>
                  <div className="flex items-center gap-2 xl:gap-4">
                    <span className="text-2xl xl:text-5xl font-bold text-gray-900">
                      {isLoading ? '...' : formatLargeNumber(tokenInfo.transactions)}
                    </span>
                    <span className={`px-2 py-1 xl:px-3 xl:py-1.5 rounded text-xs xl:text-base font-semibold ${
                      tokenInfo.totalChange >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {tokenInfo.totalChange >= 0 ? '↑' : '↓'} {Math.abs(tokenInfo.totalChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs xl:text-sm mt-1 xl:mt-2">Compare from last 24hrs</div>
                </div>

                {/* Stat Rows */}
                <div className="flex flex-col gap-3 xl:gap-6">
                  {tokenInfo.stats.map((stat) => (
                    <div key={stat.label} className="flex gap-3 xl:gap-4">
                      <div className="w-20 xl:w-24">
                        <div className="text-green-500 text-xs xl:text-sm font-medium">{stat.leftLabel}</div>
                        <div className="text-green-600 text-base xl:text-xl font-bold">
                          {stat.formatType === 'funding' ? formatCurrency(stat.leftValue) : formatValue(stat.leftValue, stat.formatType, false)}
                        </div>
                      </div>
                      {stat.rightLabel && (
                        <div className="w-20 xl:w-24">
                          <div className="text-red-500 text-xs xl:text-sm font-medium">{stat.rightLabel}</div>
                          <div className={`text-base xl:text-xl font-bold ${stat.rightLabel === 'FUNDING' ? (stat.rightValue >= 0 ? 'text-green-600' : 'text-red-600') : 'text-red-600'}`}>
                            {formatValue(stat.rightValue, stat.formatType, true)}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Section - Circles and Cards */}
              <div className="flex-1 flex flex-col">
                {/* Circular Progress Indicators */}
                <div className="flex items-center gap-4 xl:gap-10 mb-3 xl:mb-6">
                  {tokenInfo.changes.map((change) => (
                    <div key={change.label} className="flex flex-col items-center gap-1 xl:gap-2">
                      <div className="hidden xl:block">
                        <CircleProgress percent={change.value} size={80} strokeWidth={7} />
                      </div>
                      <div className="block xl:hidden">
                        <CircleProgress percent={change.value} size={50} strokeWidth={5} />
                      </div>
                      <span className="text-xs xl:text-sm text-gray-500 font-medium">{change.label}</span>
                    </div>
                  ))}
                </div>

                {/* Cards Row */}
                <div className="flex gap-4 xl:gap-8">
                  {/* Liquidity and Volume stacked */}
                  <div className="flex flex-col gap-3 xl:gap-6">
                    {/* Liquidity Card */}
                    <div className="flex flex-col">
                      <div className="text-gray-500 text-xs xl:text-sm font-medium mb-0.5 xl:mb-1">Liquidity</div>
                      <div className="text-xl xl:text-[2.75rem] font-bold text-gray-900">
                        {isLoading ? '...' : `$${formatLargeNumber(tokenInfo.liquidity)}`}
                      </div>
                    </div>

                    {/* Volume Card */}
                    <div className="flex flex-col">
                      <div className="text-gray-500 text-xs xl:text-sm font-medium mb-0.5 xl:mb-1">Volume</div>
                      <div className="text-xl xl:text-[2.75rem] font-bold text-gray-900">
                        {isLoading ? '...' : `$${formatLargeNumber(tokenInfo.volume)}`}
                      </div>
                    </div>
                  </div>

                  {/* Funding Card */}
                  <div className="flex flex-col">
                    <div className="text-gray-500 text-xs xl:text-sm font-medium mb-0.5 xl:mb-1">Funding</div>
                    <div className={`text-lg xl:text-[1.71875rem] font-bold ${tokenInfo.funding >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tokenInfo.funding.toFixed(4)}%
                    </div>
                    <div className="text-gray-900 text-xs xl:text-[0.9375rem] font-mono mt-0.5 xl:mt-1">
                      {tokenInfo.countdown}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <table className="w-full text-base">
          <thead className="sticky top-0 bg-white">
            <tr className="text-gray-500 border-b border-gray-200">
              <th className="text-left py-2 px-3 font-medium">
                <span className="flex items-center gap-1">
                  DATE <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-left py-2 px-3 font-medium">
                <span className="flex items-center gap-1">
                  TYPE <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">
                <span className="flex items-center justify-end gap-1">
                  USD <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">
                <span className="flex items-center justify-end gap-1">
                  ETH <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">
                <span className="flex items-center justify-end gap-1">
                  USDC <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">
                <span className="flex items-center justify-end gap-1">
                  PRICE <span className="text-xs">⊙</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">
                <span className="flex items-center justify-end gap-1">
                  MAKER <span className="text-xs">▽</span>
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium">TXN</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TRANSACTIONS.map((tx) => (
              <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-500">{tx.date}</td>
                <td className={`py-2 px-3 ${tx.type === 'Buy' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.type}
                </td>
                <td className={`py-2 px-3 text-right ${tx.type === 'Buy' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className={`py-2 px-3 text-right ${tx.type === 'Buy' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.eth.toFixed(5)}
                </td>
                <td className="py-2 px-3 text-right text-gray-700">
                  {tx.usdc.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right text-green-500">
                  ${tx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-2 px-3 text-right">
                  <span className="flex items-center justify-end gap-1">
                    <span className="text-gray-700">{tx.maker}</span>
                    <span className="text-gray-400">▽</span>
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <button className="text-gray-400 hover:text-gray-900">
                    ↗
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
