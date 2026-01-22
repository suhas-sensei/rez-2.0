'use client';

import TradesDashboard from '@/components/TradesDashboard';
import type { Position, AgentMessage, Trade, AgentStats } from '@/components/TradesDashboard';
import LiveChart from '@/components/LiveChart';
import BalanceChart from '@/components/BalanceChart';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import PortfolioHeader from '@/components/PortfolioHeader';
import RiskProfileSelector from '@/components/RiskProfileSelector';
import type { RiskProfile } from '@/components/RiskProfileSelector';
import AgentController from '@/components/AgentController';
import AccountSettings from '@/components/AccountSettings';
import HomeHero from '@/components/HomeHero';
import Navbar from '@/components/Navbar';
import AggregateBar from '@/components/AggregateBar';
import { useState, useCallback, useEffect, useRef } from 'react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('PORTFOLIO');

  // Agent state
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<RiskProfile>('conservative');
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['BTC', 'ETH']);
  const [selectedInterval, setSelectedInterval] = useState('5m');

  // Data state (populated from API)
  const [positions, setPositions] = useState<Position[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<AgentStats | undefined>(undefined);
  const [isClosingPositions, setIsClosingPositions] = useState(false);
  const [accountState, setAccountState] = useState<{
    balance: number;
    unrealizedPnl: number;
    marginUsed: number;
    totalReturnPct?: number;
  } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const lastEntryTimestamp = useRef<string | null>(null);

  const isPortfolioView = selectedSymbol === 'PORTFOLIO';
  const [portfolioTab, setPortfolioTab] = useState<'config' | 'growth' | 'settings'>('config');

  const handleLogin = () => {
    setIsLoggedIn(true);
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

  // Fetch wallet address on mount
  useEffect(() => {
    const fetchWalletAddress = async () => {
      try {
        const response = await fetch('/api/wallet');
        const data = await response.json();
        if (data.address) {
          setWalletAddress(data.address);
        }
      } catch (error) {
        console.error('Failed to fetch wallet address:', error);
      }
    };
    fetchWalletAddress();
  }, []);

  // Poll logs when agent is running
  useEffect(() => {
    if (!isAgentRunning) return;

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/logs?limit=100');
        const data = await response.json();

        // Use enriched messages from API (includes market context, LLM reasoning, and conversational summaries)
        if (data.enrichedMessages && data.enrichedMessages.length > 0) {
          const newMessages: AgentMessage[] = data.enrichedMessages.map((msg: {
            id: string;
            type: 'market' | 'decision' | 'trade' | 'info' | 'reasoning';
            message: string;
            timestamp: string;
            asset?: string;
          }) => ({
            id: msg.id,
            // Map reasoning and market types to appropriate display types
            type: msg.type === 'reasoning' ? 'info' : msg.type === 'market' ? 'info' : msg.type,
            message: msg.message,
            timestamp: msg.timestamp,
            asset: msg.asset,
          }));

          // Check if we have new data
          const latestTimestamp = data.entries?.[0]?.timestamp;
          if (latestTimestamp !== lastEntryTimestamp.current) {
            lastEntryTimestamp.current = latestTimestamp;
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
        if (data.accountState) {
          setAccountState(data.accountState);
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    // Fetch immediately and then poll every 3 seconds for more responsive updates
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isAgentRunning]);

  const handleStartAgent = async () => {
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assets: selectedAssets,
          interval: selectedInterval,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAgentRunning(true);
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: `Agent started. Trading ${selectedAssets.join(', ')} on ${selectedInterval} interval.`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to start agent: ${data.error || 'Unknown error'}`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to start agent. Check console for details.',
        timestamp: new Date().toLocaleString(),
      }, ...prev]);
    }
  };

  const handleStopAgent = async () => {
    try {
      const response = await fetch('/api/agent', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setIsAgentRunning(false);
        setIsAgentPaused(false);
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: 'Agent stopped by user.',
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  const handlePauseAgent = async () => {
    try {
      const response = await fetch('/api/agent/pause', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setIsAgentPaused(true);
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: 'Agent paused. No new trades will be opened.',
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to pause agent: ${data.error || 'Unknown error'}`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to pause agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to pause agent. Check console for details.',
        timestamp: new Date().toLocaleString(),
      }, ...prev]);
    }
  };

  const handleResumeAgent = async () => {
    try {
      const response = await fetch('/api/agent/resume', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setIsAgentPaused(false);
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: 'Agent resumed. Trading is active again.',
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to resume agent: ${data.error || 'Unknown error'}`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to resume agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to resume agent. Check console for details.',
        timestamp: new Date().toLocaleString(),
      }, ...prev]);
    }
  };

  const handleCloseAllPositions = async () => {
    if (positions.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to close all ${positions.length} position(s)? This will market sell/buy to close.`
    );
    if (!confirmed) return;

    setIsClosingPositions(true);

    try {
      const response = await fetch('/api/positions/close-all', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: `Closed ${data.closed || 0} position(s).`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to close positions: ${data.error || 'Unknown error'}`,
          timestamp: new Date().toLocaleString(),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to close positions:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Network error while closing positions.',
        timestamp: new Date().toLocaleString(),
      }, ...prev]);
    } finally {
      setIsClosingPositions(false);
    }
  };

  // Show landing page if not logged in
  if (!isLoggedIn) {
    return <HomeHero onLogin={handleLogin} />;
  }

  // Show markets dashboard if logged in
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Navbar />
      <AggregateBar />
      <main className="flex-1 bg-white w-full flex flex-col lg:flex-row overflow-hidden">
        {/* Portfolio Sidebar - Hidden on mobile */}
        <div className="hidden lg:block shrink-0">
          <PortfolioSidebar
            selectedSymbol={selectedSymbol}
            onAssetSelect={setSelectedSymbol}
          />
        </div>

        {/* Main Content Section */}
        <div
          className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden w-full lg:w-auto flex flex-col"
          style={isDesktop ? { width: `calc(${leftWidth}% - 64px)` } : undefined}
        >
          {isPortfolioView ? (
            /* Portfolio View */
            <div className="flex-1 flex flex-col overflow-hidden">
              {portfolioTab === 'config' && (
                <div className="flex-1 overflow-auto">
                  <PortfolioHeader
                    accountState={accountState}
                    onAccountSettings={() => setPortfolioTab('settings')}
                    onViewGrowth={() => setPortfolioTab('growth')}
                    onCloseAllPositions={handleCloseAllPositions}
                    positionsCount={positions.length}
                    isClosingPositions={isClosingPositions}
                  />
                  <RiskProfileSelector
                    selectedProfile={selectedProfile}
                    onSelectProfile={setSelectedProfile}
                    disabled={isAgentRunning}
                  />
                  <AgentController
                    isRunning={isAgentRunning}
                    isPaused={isAgentPaused}
                    onStartAgent={handleStartAgent}
                    onStopAgent={handleStopAgent}
                    onPauseAgent={handlePauseAgent}
                    onResumeAgent={handleResumeAgent}
                    selectedProfile={selectedProfile}
                    selectedAssets={selectedAssets}
                    onAssetsChange={setSelectedAssets}
                    selectedInterval={selectedInterval}
                    onIntervalChange={setSelectedInterval}
                    positionsCount={positions.length}
                    onCloseAllPositions={handleCloseAllPositions}
                    isClosingPositions={isClosingPositions}
                    onViewGrowth={() => setPortfolioTab('growth')}
                  />
                </div>
              )}

              {portfolioTab === 'growth' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Back to Config button */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
                    <button
                      onClick={() => setPortfolioTab('config')}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Portfolio
                    </button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <BalanceChart currentBalance={accountState?.balance ?? null} />
                  </div>
                </div>
              )}

              {portfolioTab === 'settings' && (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Back to Config button */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
                    <button
                      onClick={() => setPortfolioTab('config')}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Portfolio
                    </button>
                  </div>
                  <AccountSettings walletAddress={walletAddress} />
                </div>
              )}
            </div>
          ) : (
            /* Asset Chart View */
            <div className="flex-1 min-h-0">
              <LiveChart symbol={selectedSymbol} />
            </div>
          )}
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
