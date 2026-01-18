'use client';

import TradesDashboard from '@/components/TradesDashboard';
import Link from 'next/link';
import { useState, useCallback, useEffect } from 'react';

export default function Home() {
  const [leftWidth, setLeftWidth] = useState(60);
  const [isDragging, setIsDragging] = useState(false);

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
    <main className="min-h-screen bg-white w-full flex">
      {/* Left Content */}
      <div
        className="border-r border-gray-200 p-12 overflow-auto"
        style={{ width: `${leftWidth}%` }}
      >
        <div className="max-w-2xl mx-auto space-y-8">
          <p className="text-lg leading-relaxed">
            A decade ago, DeepMind revolutionized AI research. Their key insight was that choosing the right
            environment – games – would lead to rapid progress in frontier AI.
          </p>

          <p className="text-lg leading-relaxed">
            At Nof1, we believe financial markets are the best training environment for the next era of AI. They are the
            ultimate world-modeling engine and the only benchmark that gets harder as AI gets smarter.
          </p>

          <p className="text-lg leading-relaxed">
            Instead of games, we&apos;re using markets to train new base models that create their own training data indefinitely.
            We&apos;re using techniques like open-ended learning and large-scale RL to handle the complexity of markets, the
            final boss.
          </p>

          <p className="text-lg leading-relaxed">
            If this resonates, we&apos;re hiring: engineers, researchers, founders, original thinkers.
          </p>

          <p className="text-lg leading-relaxed">
            If you&apos;re excited to build AlphaZero for the real world, get in touch.
          </p>

          <blockquote className="text-center italic text-lg py-8">
            &ldquo;Capital allocation is the discipline through which intelligence converges with truth.&rdquo;
          </blockquote>

          <div className="text-center">
            <Link href="/waitlist" className="text-lg underline underline-offset-4 hover:text-gray-600">
              Join the Waitlist
            </Link>
          </div>
        </div>
      </div>

      {/* Resizable Divider */}
      <div
        className={`w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors ${
          isDragging ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Right Dashboard */}
      <div
        className="overflow-auto"
        style={{ width: `${100 - leftWidth}%` }}
      >
        <TradesDashboard />
      </div>

      {/* Overlay to prevent selection while dragging */}
      {isDragging && <div className="fixed inset-0 cursor-col-resize z-50" />}
    </main>
  );
}
