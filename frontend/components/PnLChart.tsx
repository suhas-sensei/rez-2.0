'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, LineSeries, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts';

interface PnLDataPoint {
  time: number;
  value: number;
}

interface PnLChartProps {
  isAgentRunning: boolean;
  initialBalance?: number;
}

export default function PnLChart({ isAgentRunning, initialBalance = 10000 }: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const dataRef = useRef<PnLDataPoint[]>([]);
  const [currentPnL, setCurrentPnL] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [pnlPercent, setPnlPercent] = useState(0);

  // Simulate PnL updates when agent is running (replace with real API calls)
  useEffect(() => {
    if (!isAgentRunning) return;

    // Generate initial data point
    const now = Math.floor(Date.now() / 1000);
    if (dataRef.current.length === 0) {
      dataRef.current = [{ time: now, value: 0 }];
    }

    const interval = setInterval(() => {
      // Simulate PnL change (replace with actual Hyperliquid API call)
      const lastValue = dataRef.current[dataRef.current.length - 1]?.value || 0;
      const change = (Math.random() - 0.48) * 50; // Slight positive bias
      const newValue = lastValue + change;
      const newTime = Math.floor(Date.now() / 1000);

      const newPoint = { time: newTime, value: newValue };
      dataRef.current.push(newPoint);

      // Keep only last 500 points
      if (dataRef.current.length > 500) {
        dataRef.current = dataRef.current.slice(-500);
      }

      if (seriesRef.current) {
        seriesRef.current.update({
          time: newTime as Time,
          value: newValue,
        });
      }

      setCurrentPnL(newValue);
      setCurrentBalance(initialBalance + newValue);
      setPnlPercent((newValue / initialBalance) * 100);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAgentRunning, initialBalance]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 300;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#666',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      width,
      height,
      rightPriceScale: {
        borderColor: '#e0e0e0',
        scaleMargins: {
          top: 0.2,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: '#e0e0e0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
      crosshair: {
        mode: 1,
      },
      autoSize: true,
    });

    chartRef.current = chart;

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: currentPnL >= 0 ? '#22c55e' : '#ef4444',
      topColor: currentPnL >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      bottomColor: currentPnL >= 0 ? 'rgba(34, 197, 94, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    seriesRef.current = areaSeries;

    // Set initial data if agent is running
    if (isAgentRunning && dataRef.current.length > 0) {
      const chartData = dataRef.current.map(d => ({
        time: d.time as Time,
        value: d.value,
      }));
      areaSeries.setData(chartData);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (container && chartRef.current) {
        const newWidth = container.clientWidth || 800;
        const newHeight = container.clientHeight || 300;
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [isAgentRunning, currentPnL]);

  // Update series colors based on PnL
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.applyOptions({
        lineColor: currentPnL >= 0 ? '#22c55e' : '#ef4444',
        topColor: currentPnL >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        bottomColor: currentPnL >= 0 ? 'rgba(34, 197, 94, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      });
    }
  }, [currentPnL]);

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 xl:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg xl:text-xl font-semibold text-gray-900 font-inter">Portfolio P&L</h2>
            {isAgentRunning && (
              <span className="flex items-center gap-1.5 text-xs xl:text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Agent Running
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 font-inter">
            <div className="text-right">
              <p className="text-xs xl:text-sm text-gray-500">Current Balance</p>
              <p className="text-lg xl:text-xl font-bold text-gray-900">
                ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs xl:text-sm text-gray-500">Total P&L</p>
              <p className={`text-lg xl:text-xl font-bold ${currentPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currentPnL >= 0 ? '+' : ''}{currentPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-sm xl:text-base ml-1">
                  ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1 w-full min-h-0">
        {!isAgentRunning && (
          <div className="w-full h-full flex items-center justify-center text-gray-400 font-inter">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg">Start the agent to see P&L chart</p>
              <p className="text-sm text-gray-400">Select a risk profile and click &quot;Start Agent&quot;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
