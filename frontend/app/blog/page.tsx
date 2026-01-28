'use client';

import TradesDashboard from '@/components/TradesDashboard';
import type { Position, AgentMessage, Trade } from '@/components/TradesDashboard';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import Navbar from '@/components/Navbar';
import AggregateBar from '@/components/AggregateBar';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function BlogPage() {
  const router = useRouter();
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BLOG');

  // Agent state
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  // Data state (populated from API)
  const [positions, setPositions] = useState<Position[]>([]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const lastEntryTimestamp = useRef<string | null>(null);

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

        {/* Main Content Section - Blog */}
        <div
          className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden w-full lg:w-auto flex flex-col"
          style={isDesktop ? { width: `calc(${leftWidth}% - 64px)` } : undefined}
        >
          <div className="flex-1 flex flex-col overflow-hidden bg-white font-inter items-center justify-center">
            <h1 className="text-6xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-instrument-serif), "Instrument Serif", serif' }}>
              Coming Soon
            </h1>
           
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
