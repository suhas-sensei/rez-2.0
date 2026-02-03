'use client';

import TradesDashboard from '@/components/TradesDashboard';
import type { Position, AgentMessage, Trade } from '@/components/TradesDashboard';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import Navbar from '@/components/Navbar';
import AggregateBar from '@/components/AggregateBar';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const ABOUT_TEXT = "Rez is building the next generation of decentralized finance by making advanced trading simple, accessible, and automated. We are a unified, non-custodial platform powered by autonomous AI agents that remove the complexity traditionally associated with DeFi. Our focus is on agentic trading for perpetual futures, where we consolidate fragmented markets into a single, intuitive experience Users deposit funds, define high-level risk preferences, and rely on intelligent agents to handle market analysis and execution on their behalf. By integrating modern technologies such as account abstraction and social logins, we eliminate friction around wallet management and gas fees, enabling a seamless \"set it and forget it\" experience. Rez is more than a trading platform but is an intelligent gateway designed to democratize sophisticated financial strategies, helping anyone participate in decentralized finance with confidence, efficiency, and security.";

export default function AboutPage() {
  const router = useRouter();
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('ABOUT');

  // Typewriter effect
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Agent state
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [isAgentPaused, setIsAgentPaused] = useState(false);

  // Data state (populated from API)
  const [positions, setPositions] = useState<Position[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const lastEntryTimestamp = useRef<string | null>(null);

  // Typewriter effect
  useEffect(() => {
    if (currentIndex < ABOUT_TEXT.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + ABOUT_TEXT[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 10); // Adjust speed here (lower = faster)

      return () => clearTimeout(timeout);
    }
  }, [currentIndex]);

  const handleAssetSelect = (symbol: string) => {
    router.push(`/?symbol=${symbol}`);
  };

  const handleClearMessages = () => {
    setMessages([]);
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

        // Update completed trades, positions, and stats
        if (data.completedTrades) {
          setTrades(data.completedTrades);
        }
        if (data.positions && Array.isArray(data.positions)) {
          setPositions(data.positions);
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

        {/* Main Content Section - About */}
        <div
          className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden w-full lg:w-auto flex flex-col"
          style={isDesktop ? { width: `calc(${leftWidth}% - 64px)` } : undefined}
        >
          <div className="flex-1 flex flex-col overflow-hidden bg-white font-inter">
            {/* Why Rez Section */}
            <div className="flex-1 overflow-auto scrollbar-hide px-6 py-8">
              <h2 className="text-6xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif' }}>
                Why Rez?
              </h2>
              <div className="p-6 min-h-[400px]">
                <p className="text-[21px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {displayedText}
                  {currentIndex < ABOUT_TEXT.length && (
                    <span className="inline-block w-0.5 h-8 bg-gray-900 ml-1 animate-pulse" />
                  )}
                </p>
              </div>
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
            isAgentRunning={isAgentRunning}
            onClearMessages={handleClearMessages}
          />
        </div>

        {/* Overlay to prevent selection while dragging */}
        {isDragging && <div className="fixed inset-0 cursor-col-resize z-50" />}
      </main>
    </div>
  );
}
