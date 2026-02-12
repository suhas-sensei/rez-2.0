'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, AreaSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, Time } from 'lightweight-charts';
import { useCurrency } from '@/context/CurrencyContext';

interface BalanceChartProps {
  currentBalance: number | null;
  className?: string;
}

interface BalanceDataPoint {
  time: number;
  value: number;
}

export default function BalanceChart({ currentBalance, className = '' }: BalanceChartProps) {
  const { symbol: currencySymbol, convertAmount, formatAmount } = useCurrency();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [markerPosition, setMarkerPosition] = useState<{ x: number; y: number } | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalanceDataPoint[]>([]);
  const [startBalance, setStartBalance] = useState<number | null>(null);
  const [pnlPercent, setPnlPercent] = useState<number>(0);
  const lastUpdateRef = useRef<number>(0);

  // Load balance history from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('balanceHistory');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as BalanceDataPoint[];
        setBalanceHistory(parsed);
      } catch {
        // Invalid data, start fresh
      }
    }
  }, []);

  // Add new balance point every second for live updates
  useEffect(() => {
    if (currentBalance === null || currentBalance <= 0) return;

    const addDataPoint = () => {
      const now = Math.floor(Date.now() / 1000);

      setBalanceHistory(prev => {
        // Only add if at least 1 second has passed
        if (now - lastUpdateRef.current < 1) return prev;
        lastUpdateRef.current = now;

        const newHistory = [...prev, { time: now, value: currentBalance }];
        // Keep only last 5000 points for more history
        const trimmed = newHistory.slice(-5000);
        localStorage.setItem('balanceHistory', JSON.stringify(trimmed));
        return trimmed;
      });
    };

    // Add point immediately
    addDataPoint();

    // Then add a point every second
    const interval = setInterval(addDataPoint, 1000);
    return () => clearInterval(interval);
  }, [currentBalance]);

  // Get all balance data
  const getFilteredData = useCallback(() => {
    // If no history but we have current balance, create synthetic data points
    if (balanceHistory.length === 0 && currentBalance !== null) {
      const now = Math.floor(Date.now() / 1000);
      return [
        { time: now - 60, value: currentBalance },
        { time: now, value: currentBalance },
      ];
    }

    // If only 1 point, add a synthetic starting point
    if (balanceHistory.length === 1) {
      const point = balanceHistory[0];
      return [
        { time: point.time - 60, value: point.value },
        point,
      ];
    }

    return balanceHistory;
  }, [balanceHistory, currentBalance]);

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#666',
        fontSize: 12,
        fontFamily: 'Inter, sans-serif',
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
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#e0e0e0',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 3,
      },
      crosshair: {
        mode: 1,
      },
      autoSize: true,
      localization: {
        priceFormatter: (price: number) => `${currencySymbol}${convertAmount(price).toFixed(2)}`,
      },
    });

    chartRef.current = chart;

    // Use area series for better visual
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#f97316',
      topColor: 'rgba(249, 115, 22, 0.4)',
      bottomColor: 'rgba(249, 115, 22, 0.0)',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    seriesRef.current = areaSeries;

    // Set data
    const filteredData = getFilteredData();
    if (filteredData.length > 0) {
      const chartData: LineData<Time>[] = filteredData.map(point => ({
        time: point.time as Time,
        value: point.value,
      }));
      areaSeries.setData(chartData);
      chart.timeScale().fitContent();

      // Calculate marker position for latest point (head of the line)
      setTimeout(() => {
        if (chartRef.current && seriesRef.current) {
          const lastPoint = filteredData[filteredData.length - 1];
          const x = chartRef.current.timeScale().timeToCoordinate(lastPoint.time as Time);
          const y = seriesRef.current.priceToCoordinate(lastPoint.value);
          if (x !== null && y !== null && x >= 0) {
            setMarkerPosition({ x, y });
          }
        }
      }, 100);

      // Calculate PnL
      const first = filteredData[0].value;
      const last = filteredData[filteredData.length - 1].value;
      setStartBalance(first);
      setPnlPercent(((last - first) / first) * 100);
    }

    const updateMarkerPosition = () => {
      const data = getFilteredData();
      if (data.length > 0 && chartRef.current && seriesRef.current) {
        const lastPoint = data[data.length - 1];
        const x = chartRef.current.timeScale().timeToCoordinate(lastPoint.time as Time);
        const y = seriesRef.current.priceToCoordinate(lastPoint.value);
        if (x !== null && y !== null && x >= 0) {
          setMarkerPosition({ x, y });
        } else {
          setMarkerPosition(null);
        }
      }
    };

    const handleResize = () => {
      if (container && chartRef.current) {
        const newWidth = container.clientWidth || 800;
        const newHeight = container.clientHeight || 400;
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
        chartRef.current.timeScale().fitContent();
        // Update marker position after resize
        setTimeout(updateMarkerPosition, 50);
      }
    };

    // Subscribe to time scale changes to update marker position
    chart.timeScale().subscribeVisibleTimeRangeChange(updateMarkerPosition);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleTimeRangeChange(updateMarkerPosition);
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [balanceHistory, getFilteredData]);

  // Update chart data when balance history changes
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const filteredData = getFilteredData();
    if (filteredData.length > 0) {
      const chartData: LineData<Time>[] = filteredData.map(point => ({
        time: point.time as Time,
        value: point.value,
      }));
      seriesRef.current.setData(chartData);

      // Fit content to show all data
      chartRef.current.timeScale().fitContent();

      // Update marker position for latest point (head of the line)
      const lastPoint = filteredData[filteredData.length - 1];
      const x = chartRef.current.timeScale().timeToCoordinate(lastPoint.time as Time);
      const y = seriesRef.current.priceToCoordinate(lastPoint.value);
      if (x !== null && y !== null && x >= 0) {
        setMarkerPosition({ x, y });
      }

      // Calculate PnL
      const first = filteredData[0].value;
      const last = filteredData[filteredData.length - 1].value;
      setStartBalance(first);
      setPnlPercent(((last - first) / first) * 100);
    }
  }, [balanceHistory, getFilteredData]);

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden font-inter ${className}`}>
      {/* Balance display */}
      <div className="flex items-center gap-1 min-[255px]:gap-1.5 min-[362px]:gap-3 px-2 min-[255px]:px-3 min-[362px]:px-4 py-2 xl:py-3 bg-white">
        <span className="text-[10px] min-[255px]:text-sm min-[362px]:text-xl xl:text-2xl 2xl:text-3xl font-medium text-gray-900">Portfolio Value :</span>
        {currentBalance !== null && (
          <>
            <span className="text-[10px] min-[255px]:text-sm min-[362px]:text-xl xl:text-2xl 2xl:text-3xl font-bold text-gray-900">
              {formatAmount(currentBalance)}
            </span>
            {balanceHistory.length > 1 && (
              <span className={`text-[8px] min-[255px]:text-xs min-[362px]:text-base xl:text-lg ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
              </span>
            )}
          </>
        )}
      </div>

      {/* Chart container */}
      <div className="flex-1 min-h-0">
        {balanceHistory.length === 0 && currentBalance === null ? (
          <div className="w-full h-full flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <p className="text-lg font-medium">Waiting for balance data...</p>
              <p className="text-sm mt-1">Start the agent to begin tracking portfolio growth</p>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <div ref={chartContainerRef} className="w-full h-full bg-white" />
            {/* Blinking circle marker at head */}
            {markerPosition && (
              <div
                className="absolute pointer-events-none z-50"
                style={{
                  left: markerPosition.x - 8,
                  top: markerPosition.y - 8,
                }}
              >
                <div className="relative w-4 h-4">
                  <div className="absolute inset-0 bg-orange-500 rounded-full" />
                  <div className="absolute inset-0 bg-orange-400 rounded-full animate-ping" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
