'use client';

import TradesDashboard from '@/components/TradesDashboard';
import type { Position, AgentMessage, Trade, AgentStats, OpenOrder } from '@/components/TradesDashboard';
import LiveChart from '@/components/LiveChart';
import BalanceChart from '@/components/BalanceChart';
import AgentStatsCircles from '@/components/AgentStatsCircles';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import PortfolioHeader from '@/components/PortfolioHeader';
import RiskProfileSelector from '@/components/RiskProfileSelector';
import type { RiskProfile } from '@/components/RiskProfileSelector';
import AgentController from '@/components/AgentController';
import AccountSettings from '@/components/AccountSettings';
import MarketingLanding from '@/components/MarketingLanding';
import Navbar from '@/components/Navbar';
import AggregateBar from '@/components/AggregateBar';
import Loading from '@/components/Loading';
import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTimezone } from '@/context/TimezoneContext';

function HomeContent() {
  const searchParams = useSearchParams();
  const symbolParam = searchParams.get('symbol');
  const { formatDateTime } = useTimezone();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(symbolParam || 'PORTFOLIO');

  // Check localStorage for login state AND verify session exists on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('isLoggedIn');
      if (stored === 'true') {
        // Verify session is still valid by checking wallet endpoint
        fetch('/api/wallet')
          .then(res => res.json())
          .then(data => {
            if (data.address) {
              setIsLoggedIn(true);
              setWalletAddress(data.address);
            } else {
              // Session expired, clear localStorage
              localStorage.removeItem('isLoggedIn');
              setIsLoggedIn(false);
            }
          })
          .catch(() => {
            // Session check failed, clear localStorage
            localStorage.removeItem('isLoggedIn');
            setIsLoggedIn(false);
          });
      }
    }
  }, []);

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
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [stats, setStats] = useState<AgentStats | undefined>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('rez_cached_stats');
      if (cached) try { return JSON.parse(cached); } catch { /* ignore */ }
    }
    return undefined;
  });
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

  // Update selectedSymbol when URL parameter changes
  useEffect(() => {
    if (symbolParam) {
      setSelectedSymbol(symbolParam);
    }
  }, [symbolParam]);

  const handleLogin = () => {
    setIsLoggedIn(true);
    localStorage.setItem('isLoggedIn', 'true');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setWalletAddress('');
    setAccountState(null);
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

  // Check agent status on mount and poll every 5 seconds
  useEffect(() => {
    const checkAgentStatus = async () => {
      try {
        const response = await fetch('/api/agent');
        const data = await response.json();
        setIsAgentRunning(data.running);
        setIsAgentPaused(data.paused ?? false);

        // Restore last used config from backend (source of truth)
        if (data.assets && data.assets.length > 0) {
          setSelectedAssets(data.assets);
        }
        if (data.interval) {
          setSelectedInterval(data.interval);
        }
        if (data.riskProfile) {
          setSelectedProfile(data.riskProfile as RiskProfile);
        }
      } catch (error) {
        console.error('Failed to check agent status:', error);
      }
    };
    checkAgentStatus();

    // Poll every 5 seconds to keep status in sync across browsers
    const intervalId = setInterval(checkAgentStatus, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Fetch wallet address and initial account state when logged in
  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchWalletData = async () => {
      try {
        const response = await fetch('/api/wallet');
        const data = await response.json();
        if (data.address) {
          setWalletAddress(data.address);
        }
        if (data.accountState) {
          const unrealizedPnl = data.accountState.unrealizedPnl ?? 0;
          const marginUsed = data.accountState.marginUsed ?? 0;
          const pnlPct = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0;
          setAccountState({
            balance: data.accountState.balance ?? 0,
            unrealizedPnl,
            marginUsed,
            totalReturnPct: pnlPct,
          });
        }
      } catch (error) {
        console.error('Failed to fetch wallet data:', error);
      }
    };
    fetchWalletData();
  }, [isLoggedIn]);

  // Fetch completed trades and positions always (even when agent stopped)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/logs?limit=100');
        const data = await response.json();

        // Update completed trades always
        if (data.completedTrades) {
          setTrades(data.completedTrades);
        }
        // Update positions always (from Hyperliquid)
        if (data.positions && Array.isArray(data.positions)) {
          setPositions(data.positions);
        }
        // Update open orders
        if (data.openOrders && Array.isArray(data.openOrders)) {
          setOpenOrders(data.openOrders);
        }
        if (data.stats) {
          setStats(prev => {
            // If new totalPnl is 0 but we had a real value, preserve the old totalPnl
            if (data.stats.totalPnl === 0 && prev?.totalPnl && prev.totalPnl !== 0) {
              const merged = { ...data.stats, totalPnl: prev.totalPnl };
              localStorage.setItem('rez_cached_stats', JSON.stringify(merged));
              return merged;
            }
            localStorage.setItem('rez_cached_stats', JSON.stringify(data.stats));
            return data.stats;
          });
        }
        if (data.accountState) {
          const unrealizedPnl = data.accountState.unrealizedPnl ?? 0;
          const marginUsed = data.accountState.marginUsed ?? 0;
          const pnlPct = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0;
          setAccountState({
            ...data.accountState,
            totalReturnPct: pnlPct,
          });
        }

        // Only update messages when agent is running
        if (isAgentRunning && data.enrichedMessages && data.enrichedMessages.length > 0) {
          const newMessages: AgentMessage[] = data.enrichedMessages.map((msg: {
            id: string;
            type: 'market' | 'decision' | 'trade' | 'info' | 'reasoning';
            message: string;
            timestamp: string;
            asset?: string;
          }) => ({
            id: msg.id,
            type: msg.type,
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
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    // Fetch immediately and poll every 5 seconds
    fetchData();
    const interval = setInterval(fetchData, 5000);
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
          riskProfile: selectedProfile,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAgentRunning(true);
        setMessages(prev => [{
          id: Date.now(),
          type: 'info',
          message: `Agent started. Trading ${selectedAssets.join(', ')} on ${selectedInterval} interval.`,
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      } else {
        // Show actual error message
        const errorMsg = data.error || 'Failed to start agent';
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: errorMsg,
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to start agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Network error: Could not connect to backend server.',
        timestamp: formatDateTime(new Date()),
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
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  // Refresh positions after closing
  const handlePositionsClosed = async () => {
    try {
      // Fetch fresh wallet and position data
      const response = await fetch('/api/wallet');
      const data = await response.json();

      if (data.accountState) {
        const unrealizedPnl = data.accountState.unrealizedPnl ?? 0;
        const marginUsed = data.accountState.marginUsed ?? 0;
        const pnlPct = marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0;
        setAccountState({
          balance: data.accountState.balance ?? 0,
          unrealizedPnl,
          marginUsed,
          totalReturnPct: pnlPct,
        });
      }

      // Also fetch logs to get updated positions list
      const logsResponse = await fetch('/api/logs?limit=100');
      const logsData = await logsResponse.json();

      if (logsData.positions && Array.isArray(logsData.positions)) {
        setPositions(logsData.positions);
      }
    } catch (error) {
      console.error('Failed to refresh positions:', error);
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
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to pause agent: ${data.error || 'Unknown error'}`,
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to pause agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to pause agent. Check console for details.',
        timestamp: formatDateTime(new Date()),
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
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to resume agent: ${data.error || 'Unknown error'}`,
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to resume agent:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Failed to resume agent. Check console for details.',
        timestamp: formatDateTime(new Date()),
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
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      } else {
        setMessages(prev => [{
          id: Date.now(),
          type: 'error',
          message: `Failed to close positions: ${data.error || 'Unknown error'}`,
          timestamp: formatDateTime(new Date()),
        }, ...prev]);
      }
    } catch (error) {
      console.error('Failed to close positions:', error);
      setMessages(prev => [{
        id: Date.now(),
        type: 'error',
        message: 'Network error while closing positions.',
        timestamp: formatDateTime(new Date()),
      }, ...prev]);
    } finally {
      setIsClosingPositions(false);
    }
  };

  // Show marketing landing page if not logged in
  if (!isLoggedIn) {
    return <MarketingLanding onLogin={handleLogin} />;
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
                    walletAddress={walletAddress}
                    onAccountSettings={() => setPortfolioTab('settings')}
                    onViewGrowth={() => setPortfolioTab('growth')}
                    onLogout={handleLogout}
                    onCloseAllPositions={handleCloseAllPositions}
                    positionsCount={positions.length}
                    isClosingPositions={isClosingPositions}
                    isAgentRunning={isAgentRunning}
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
                <div className="flex-1 min-h-0 flex flex-col overflow-auto">
                  {/* Back to Config button */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0">
                    <button
                      onClick={() => setPortfolioTab('config')}
                      className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
               
                    </button>
                  </div>
                  <div className="flex-1 min-h-0" style={{ minHeight: '300px' }}>
                    <BalanceChart currentBalance={accountState?.balance ?? null} />
                  </div>
                  {/* Agent Stats with Circle Graphs */}
                  <AgentStatsCircles
                    stats={stats}
                    trades={trades}
                  />
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
            openOrders={openOrders}
            messages={messages}
            trades={trades}
            isAgentRunning={isAgentRunning}
            onClearMessages={handleClearMessages}
            onPositionsClosed={handlePositionsClosed}
          />
        </div>

        {/* Overlay to prevent selection while dragging */}
        {isDragging && <div className="fixed inset-0 cursor-col-resize z-50" />}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}
