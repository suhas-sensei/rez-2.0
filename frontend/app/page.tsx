'use client';

import TradesDashboard from '@/components/TradesDashboard';
import LiveChart from '@/components/LiveChart';
import PortfolioSidebar from '@/components/PortfolioSidebar';
import { useState, useCallback, useEffect } from 'react';

export default function Home() {
  const [leftWidth, setLeftWidth] = useState(75);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('ETHUSDT');

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

  return (
    <main className="h-full bg-white w-full flex flex-col lg:flex-row overflow-hidden">
      {/* Portfolio Sidebar - Hidden on mobile */}
      <div className="hidden lg:block shrink-0">
        <PortfolioSidebar
          selectedSymbol={selectedSymbol}
          onAssetSelect={setSelectedSymbol}
        />
      </div>

      {/* Chart Section */}
      <div
        className="border-b lg:border-b-0 lg:border-r border-gray-200 overflow-hidden w-full lg:w-auto flex flex-col"
        style={isDesktop ? { width: `calc(${leftWidth}% - 64px)` } : undefined}
      >
        {/* Live Chart */}
        <div className="w-full h-full">
          <LiveChart symbol={selectedSymbol} />
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
        <TradesDashboard />
      </div>

      {/* Overlay to prevent selection while dragging */}
      {isDragging && <div className="fixed inset-0 cursor-col-resize z-50" />}
    </main>
  );
}
