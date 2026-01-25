'use client';

import TradesDashboard from '@/components/TradesDashboard';
import type { Position, AgentMessage, Trade, AgentStats } from '@/components/TradesDashboard';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import Navbar from '@/components/Navbar';
import AggregateBar from '@/components/AggregateBar';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface LeaderboardEntry {
  rank: number;
  address: string;
  transactions: number;
  profit: number;
  profitPercent: number;
  volume: number;
  winRate: number;
  avgTrade: number;
}

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, address: '0x8A2F...4B9C', transactions: 1247, profit: 125400.50, profitPercent: 45.2, volume: 2850000, winRate: 68.5, avgTrade: 2285.72 },
  { rank: 2, address: '0x3C1E...7D8F', transactions: 982, profit: 98250.75, profitPercent: 38.7, volume: 2340000, winRate: 65.2, avgTrade: 2383.01 },
  { rank: 3, address: '0x5B7A...2E9D', transactions: 856, profit: 87900.25, profitPercent: 35.4, volume: 1980000, winRate: 63.8, avgTrade: 2313.08 },
  { rank: 4, address: '0x9E4C...1A6B', transactions: 743, profit: 72100.00, profitPercent: 32.1, volume: 1750000, winRate: 61.5, avgTrade: 2355.99 },
  { rank: 5, address: '0x2D8F...5C3E', transactions: 698, profit: 65800.90, profitPercent: 29.8, volume: 1620000, winRate: 59.7, avgTrade: 2321.20 },
  { rank: 6, address: '0x7A1B...8F4D', transactions: 624, profit: 58900.50, profitPercent: 27.5, volume: 1450000, winRate: 58.3, avgTrade: 2324.52 },
  { rank: 7, address: '0x4E9C...3B2A', transactions: 587, profit: 52400.75, profitPercent: 25.3, volume: 1320000, winRate: 56.9, avgTrade: 2248.89 },
  { rank: 8, address: '0x6F2D...9E1C', transactions: 543, profit: 48200.25, profitPercent: 23.1, volume: 1180000, winRate: 55.2, avgTrade: 2173.11 },
  { rank: 9, address: '0x1C8A...4F7B', transactions: 512, profit: 42800.00, profitPercent: 20.9, volume: 1050000, winRate: 54.1, avgTrade: 2050.78 },
  { rank: 10, address: '0xB3E7...6D2C', transactions: 478, profit: 38900.50, profitPercent: 18.7, volume: 980000, winRate: 52.5, avgTrade: 2050.21 },
  { rank: 11, address: '0xD9A4...1B8E', transactions: 445, profit: 34500.75, profitPercent: 16.5, volume: 890000, winRate: 51.2, avgTrade: 2000.00 },
  { rank: 12, address: '0xF5C2...7A9D', transactions: 412, profit: 30200.25, profitPercent: 14.3, volume: 820000, winRate: 49.8, avgTrade: 1990.29 },
  { rank: 13, address: '0xA8E1...3C6F', transactions: 387, profit: 26800.00, profitPercent: 12.1, volume: 750000, winRate: 48.3, avgTrade: 1937.98 },
  { rank: 14, address: '0x3B9D...2F4A', transactions: 356, profit: 23400.50, profitPercent: 9.9, volume: 680000, winRate: 46.9, avgTrade: 1910.11 },
  { rank: 15, address: '0x7D4E...8C1B', transactions: 328, profit: 20100.75, profitPercent: 7.7, volume: 610000, winRate: 45.1, avgTrade: 1859.76 },
  { rank: 16, address: '0xE2A9...5F8C', transactions: 301, profit: 17800.25, profitPercent: 5.9, volume: 550000, winRate: 43.5, avgTrade: 1827.24 },
  { rank: 17, address: '0x9C4B...1D7A', transactions: 276, profit: 15200.50, profitPercent: 4.2, volume: 490000, winRate: 42.1, avgTrade: 1775.36 },
  { rank: 18, address: '0x6D8F...3E2B', transactions: 254, profit: 13100.75, profitPercent: 2.8, volume: 440000, winRate: 40.6, avgTrade: 1732.28 },
  { rank: 19, address: '0x4A7C...9B1D', transactions: 229, profit: 10900.00, profitPercent: 1.5, volume: 390000, winRate: 39.3, avgTrade: 1703.06 },
  { rank: 20, address: '0x1F5E...8A6C', transactions: 207, profit: 8850.50, profitPercent: 0.8, volume: 350000, winRate: 38.2, avgTrade: 1690.82 },
];

function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('LEADERBOARD');

  // Agent state
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState(false);

  // Data state (populated from API)
  const [positions, setPositions] = useState<Position[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<AgentStats | undefined>(undefined);
  const lastEntryTimestamp = useRef<string | null>(null);

  const handleAssetSelect = (symbol: string) => {
    router.push(`/?symbol=${symbol}`);
  };

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth >= 20 && newWidth <= 80) {
        setLeftWidth(newWidth);
      }
    },
    [isDragging]
  );

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Check agent status on mount
  useEffect(() => {
    const checkAgentStatus = async () => {
      try {
        const response = await fetch('/api/agent');
        const data = await response.json();
        setIsAgentRunning(data.running);
        setIsAgentPaused(data.paused ?? false);
      } catch (error) {
        console.error('Failed to check agent status:', error);
      }
    };
    checkAgentStatus();
  }, []);

  // Poll logs when agent is running
  useEffect(() => {
    if (!isAgentRunning) return;

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs?limit=100');
        const data = await response.json();

        // Use enriched messages from API
        if (data.enrichedMessages && data.enrichedMessages.length > 0) {
          const newMessages: AgentMessage[] = data.enrichedMessages.map((msg: {
            id: string;
            type: 'market' | 'decision' | 'trade' | 'info' | 'reasoning';
            message: string;
            timestamp: string;
            asset?: string;
          }) => ({
            id: msg.id,
            type: msg.type === 'reasoning' ? 'info' : msg.type === 'market' ? 'info' : msg.type,
            message: msg.message,
            timestamp: msg.timestamp,
            asset: msg.asset,
          }));

          const messageKey = `${newMessages.length}-${newMessages[0]?.id || ''}`;
          if (messageKey !== lastEntryTimestamp.current) {
            lastEntryTimestamp.current = messageKey;
            setMessages(newMessages);
          }
        }

        // Update completed trades, positions, and stats
        if (data.completedTrades) {
          setTrades(data.completedTrades);
        }
        if (data.positions && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isAgentRunning]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Navbar />
      <AggregateBar />
      <main className="flex-1 bg-white w-full flex flex-col lg:flex-row overflow-hidden">
        {/* Portfolio Sidebar - Hidden on mobile */}
        <div className="hidden lg:block shrink-0">
          <PortfolioSidebar
            selectedSymbol={selectedSymbol}
            onAssetSelect={handleAssetSelect}
          />
        </div>

        {/* Main Content Section - Leaderboard */}
        <div
          className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden w-full lg:w-auto flex flex-col"
          style={isDesktop ? { width: `calc(${leftWidth}% - 64px)` } : undefined}
        >
          <div className="flex-1 flex flex-col overflow-hidden bg-white font-inter">
            {/* Header */}
            <div className="border-b border-gray-200 px-6 py-4 shrink-0">
              <h1 className="text-2xl font-bold text-gray-900">Top Traders Leaderboard</h1>
              <p className="text-sm text-gray-500 mt-1">Rankings based on 30-day performance</p>
            </div>

            {/* Leaderboard Table */}
            <div className="flex-1 overflow-auto scrollbar-hide">
              <table className="w-full text-base font-inter">
                <thead className="sticky top-0 bg-white border-b border-gray-200">
                  <tr className="text-gray-500">
                    <th className="text-left py-3 px-4 font-medium">
                      <span className="flex items-center gap-1">
                        RANK
                      </span>
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      <span className="flex items-center gap-1">
                        ADDRESS
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        TXNS
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        PROFIT
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        PROFIT %
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        VOLUME
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        WIN RATE
                      </span>
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      <span className="flex items-center justify-end gap-1">
                        AVG TRADE
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_LEADERBOARD.map((entry) => (
                    <tr key={entry.rank} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {entry.rank <= 3 ? (
                            <span className="text-2xl">
                              {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                            </span>
                          ) : (
                            <span className="text-gray-600 font-semibold text-lg w-8 text-center">
                              {entry.rank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-gray-900 font-medium">{entry.address}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 font-medium">
                        {entry.transactions.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        entry.profit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        ${entry.profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${
                        entry.profitPercent >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        +{entry.profitPercent.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 font-medium">
                        ${formatLargeNumber(entry.volume)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 font-medium">
                        {entry.winRate.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-right text-gray-700 font-medium">
                        ${entry.avgTrade.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resizable Divider - Hidden on mobile */}
        <div
          className={`hidden lg:block w-1 shrink-0 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
          onMouseDown={handleMouseDown}
        />

        {/* Right Dashboard */}
        <div
          className="overflow-auto scrollbar-hide w-full lg:w-auto flex-1"
          style={isDesktop ? { width: `${100 - leftWidth}%` } : undefined}
        >
          <TradesDashboard
            positions={positions}
            messages={messages}
            trades={trades}
            stats={stats}
            isAgentRunning={isAgentRunning}
          />
        </div>

        {/* Overlay to prevent selection while dragging */}
        {isDragging && <div className="fixed inset-0 cursor-col-resize z-50" />}
      </main>
    </div>
  );
}
