'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, CandlestickData, Time } from 'lightweight-charts';
import TransactionsTable from './TransactionsTable';

const TIME_INTERVALS = [
  { label: '1s', value: '1s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: 'D', value: '1d' },
];

// Circulating supply for market cap calculation (approximate values)
const CIRCULATING_SUPPLY: Record<string, number> = {
  ETHUSDT: 120_000_000,
  BTCUSDT: 19_600_000,
  SOLUSDT: 440_000_000,
  BNBUSDT: 153_000_000,
  XRPUSDT: 54_000_000_000,
  ADAUSDT: 35_000_000_000,
  DOGEUSDT: 143_000_000_000,
  AVAXUSDT: 410_000_000,
};

// Map display symbols to Hyperliquid coin names
const SYMBOL_TO_COIN: Record<string, string> = {
  ETHUSDT: 'ETH',
  BTCUSDT: 'BTC',
  SOLUSDT: 'SOL',
  BNBUSDT: 'BNB',
  XRPUSDT: 'XRP',
  ADAUSDT: 'ADA',
  DOGEUSDT: 'DOGE',
  AVAXUSDT: 'AVAX',
};

// Map Hyperliquid intervals to API format
const INTERVAL_MAP: Record<string, string> = {
  '1s': '1m', // Hyperliquid doesn't support 1s, fallback to 1m
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '4h': '4h',
  '1d': '1d',
};

interface LiveChartProps {
  symbol?: string;
}

export default function LiveChart({ symbol = 'ETHUSDT' }: LiveChartProps) {
  const coin = SYMBOL_TO_COIN[symbol] || 'ETH';
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentCandleRef = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [priceMode, setPriceMode] = useState<'Price' | 'MCap'>('Price');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartHeight, setChartHeight] = useState(65); // percentage
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Get interval duration in seconds
  const getIntervalSeconds = (interval: string): number => {
    const map: Record<string, number> = {
      '1s': 1,
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    return map[interval] || 60;
  };

  const fetchHistoricalData = useCallback(async (interval: string, type: 'line' | 'candle', mode: 'Price' | 'MCap') => {
    try {
      const hlInterval = INTERVAL_MAP[interval] || '1m';
      const endTime = Date.now();
      const startTime = endTime - (500 * getIntervalSeconds(interval) * 1000);

      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: {
            coin: coin,
            interval: hlInterval,
            startTime: startTime,
            endTime: endTime,
          },
        }),
      });
      const data = await response.json();
      const multiplier = mode === 'MCap' ? (CIRCULATING_SUPPLY[symbol] || 1) : 1;

      if (!Array.isArray(data) || data.length === 0) {
        console.error('No data received from Hyperliquid');
        return;
      }

      if (type === 'line') {
        const chartData: LineData<Time>[] = data.map((item: { t: number; c: string }) => ({
          time: Math.floor(item.t / 1000) as Time,
          value: parseFloat(item.c) * multiplier,
        }));

        if (seriesRef.current && chartData.length > 0) {
          seriesRef.current.setData(chartData);
          const lastValue = chartData[chartData.length - 1].value;
          const firstValue = chartData[0].value;
          setCurrentPrice(lastValue);
          setPriceChange(((lastValue - firstValue) / firstValue) * 100);
          chartRef.current?.timeScale().fitContent();
        }
      } else {
        const chartData: CandlestickData<Time>[] = data.map((item: { t: number; o: string; h: string; l: string; c: string }) => ({
          time: Math.floor(item.t / 1000) as Time,
          open: parseFloat(item.o) * multiplier,
          high: parseFloat(item.h) * multiplier,
          low: parseFloat(item.l) * multiplier,
          close: parseFloat(item.c) * multiplier,
        }));

        if (seriesRef.current && chartData.length > 0) {
          seriesRef.current.setData(chartData);
          const lastValue = chartData[chartData.length - 1].close;
          const firstValue = chartData[0].open;
          setCurrentPrice(lastValue);
          setPriceChange(((lastValue - firstValue) / firstValue) * 100);
          chartRef.current?.timeScale().fitContent();
        }
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    }
  }, [symbol, coin]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;

    // Price formatter for large numbers (MCap mode)
    const formatPrice = (price: number): string => {
      if (priceMode === 'MCap') {
        if (price >= 1_000_000_000_000) {
          return `${(price / 1_000_000_000_000).toFixed(2)}T`;
        } else if (price >= 1_000_000_000) {
          return `${(price / 1_000_000_000).toFixed(2)}B`;
        } else if (price >= 1_000_000) {
          return `${(price / 1_000_000).toFixed(2)}M`;
        }
      }
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#666',
        fontSize: 21,
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
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 6,
      },
      crosshair: {
        mode: 1,
      },
      autoSize: true,
      localization: {
        priceFormatter: formatPrice,
      },
    });

    chartRef.current = chart;

    if (chartType === 'line') {
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#f97316',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      seriesRef.current = lineSeries;
    } else {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceLineVisible: true,
        lastValueVisible: true,
      });
      seriesRef.current = candleSeries;
    }

    const handleResize = () => {
      if (container && chartRef.current) {
        const newWidth = container.clientWidth || 800;
        const newHeight = container.clientHeight || 400;
        chartRef.current.applyOptions({
          width: newWidth,
          height: newHeight,
        });
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);

    // Fetch data after chart is initialized
    setTimeout(() => {
      fetchHistoricalData(selectedInterval, chartType, priceMode);
    }, 0);

    // WebSocket for real-time updates (Hyperliquid)
    const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');
    wsRef.current = ws;

    const intervalSeconds = getIntervalSeconds(selectedInterval);
    const multiplier = priceMode === 'MCap' ? (CIRCULATING_SUPPLY[symbol] || 1) : 1;

    ws.onopen = () => {
      // Subscribe to trades for this coin
      ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: {
          type: 'trades',
          coin: coin,
        },
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      // Handle trade data from Hyperliquid
      if (message.channel === 'trades' && message.data) {
        const trades = message.data;
        if (!Array.isArray(trades) || trades.length === 0) return;

        // Process the most recent trade
        const trade = trades[trades.length - 1];
        const rawPrice = parseFloat(trade.px);
        const price = rawPrice * multiplier;
        const tradeTime = Math.floor(trade.time / 1000);
        // Round down to the start of the current interval
        const intervalTime = Math.floor(tradeTime / intervalSeconds) * intervalSeconds;

        if (seriesRef.current) {
          const currentCandle = currentCandleRef.current;

          if (chartType === 'line') {
            // For line chart, just update the current interval's value
            if (currentCandle && currentCandle.time === intervalTime) {
              // Same interval - update the value
              currentCandleRef.current = { ...currentCandle, close: price };
            } else {
              // New interval - create new point
              currentCandleRef.current = {
                time: intervalTime,
                open: price,
                high: price,
                low: price,
                close: price,
              };
            }
            seriesRef.current.update({
              time: intervalTime as Time,
              value: price,
            });
          } else {
            // For candlestick chart, properly update OHLC
            if (currentCandle && currentCandle.time === intervalTime) {
              // Same interval - update the candle
              currentCandleRef.current = {
                ...currentCandle,
                high: Math.max(currentCandle.high, price),
                low: Math.min(currentCandle.low, price),
                close: price,
              };
              seriesRef.current.update({
                time: intervalTime as Time,
                open: currentCandle.open,
                high: Math.max(currentCandle.high, price),
                low: Math.min(currentCandle.low, price),
                close: price,
              });
            } else {
              // New interval - create new candle
              currentCandleRef.current = {
                time: intervalTime,
                open: price,
                high: price,
                low: price,
                close: price,
              };
              seriesRef.current.update({
                time: intervalTime as Time,
                open: price,
                high: price,
                low: price,
                close: price,
              });
            }
          }
          setCurrentPrice(price);
        }
      }
    };

    ws.onerror = () => {
      // WebSocket errors don't contain useful info, connection will auto-retry on close
    };

    ws.onclose = () => {
      // WebSocket closed - will reconnect on next render cycle
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, coin, fetchHistoricalData, selectedInterval, chartType, priceMode]);

  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval);
    currentCandleRef.current = null; // Reset current candle when interval changes
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle vertical divider drag
  const handleDividerMouseDown = useCallback(() => {
    setIsDraggingDivider(true);
  }, []);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - rect.top) / rect.height) * 100;
      if (newHeight >= 30 && newHeight <= 85) {
        setChartHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingDivider(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col overflow-hidden ${isFullscreen ? 'bg-white' : ''}`}>
      {/* Chart Toolbar */}
      <div className="border-b border-gray-200 font-inter">
        <div className="flex items-center justify-between">
          {/* Left: Time intervals and chart controls */}
          <div className="flex items-center">
            {TIME_INTERVALS.map((interval) => (
              <button
                key={interval.value}
                onClick={() => handleIntervalChange(interval.value)}
                className={`px-3 xl:px-5 py-2 xl:py-3 text-sm xl:text-base font-medium transition-colors whitespace-nowrap ${
                  selectedInterval === interval.value
                    ? 'bg-gray-100 text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-black hover:bg-gray-50'
                }`}
              >
                {interval.label.toUpperCase()}
              </button>
            ))}

            {/* Chart type controls */}
            <button
              onClick={() => setChartType('line')}
              className={`px-3 xl:px-4 py-2 xl:py-3 transition-colors ${
                chartType === 'line'
                  ? 'bg-gray-100 border-b-2 border-black'
                  : 'hover:bg-gray-50 opacity-50 hover:opacity-100'
              }`}
            >
              <Image src="/graph.png" alt="Line chart" width={20} height={20} />
            </button>
            <button
              onClick={() => setChartType('candle')}
              className={`px-3 xl:px-4 py-2 xl:py-3 transition-colors ${
                chartType === 'candle'
                  ? 'bg-gray-100 border-b-2 border-black'
                  : 'hover:bg-gray-50 opacity-50 hover:opacity-100'
              }`}
            >
              <Image src="/bar-chart.png" alt="Candlestick chart" width={20} height={20} />
            </button>
          </div>

          {/* Right: Feature toggles */}
          <div className="flex items-center">
            {/* Price / MCap toggle */}
            <button
              onClick={() => setPriceMode('Price')}
              className={`px-3 xl:px-5 py-2 xl:py-3 text-sm xl:text-base font-medium transition-colors whitespace-nowrap ${
                priceMode === 'Price'
                  ? 'bg-gray-100 text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              PRICE
            </button>
            <button
              onClick={() => setPriceMode('MCap')}
              className={`px-3 xl:px-5 py-2 xl:py-3 text-sm xl:text-base font-medium transition-colors whitespace-nowrap ${
                priceMode === 'MCap'
                  ? 'bg-gray-100 text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
              MCAP
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className={`flex items-center gap-1 px-3 xl:px-5 py-2 xl:py-3 text-sm xl:text-base font-medium transition-colors whitespace-nowrap ${
                isFullscreen
                  ? 'bg-gray-100 text-black border-b-2 border-black'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
            >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
            <span>{isFullscreen ? 'EXIT' : 'FULL'}</span>
          </button>
          </div>
        </div>
      </div>

      {/* Price display */}
      <div className="flex items-center gap-3 px-4 py-2 xl:py-3 font-inter bg-white">
        <span className="text-xl xl:text-2xl 2xl:text-3xl font-medium text-gray-900">{symbol.replace('USDT', '/USDT')}</span>
        {currentPrice !== null && (
          <>
            <span className="text-xl xl:text-2xl 2xl:text-3xl font-bold text-gray-900">
              {priceMode === 'MCap' ? (
                currentPrice >= 1_000_000_000_000
                  ? `$${(currentPrice / 1_000_000_000_000).toFixed(2)}T`
                  : `$${(currentPrice / 1_000_000_000).toFixed(2)}B`
              ) : (
                `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              )}
            </span>
            <span className={`text-base xl:text-lg ${priceChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </>
        )}
      </div>

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="w-full bg-white overflow-hidden"
        style={{ height: `${chartHeight}%` }}
      />

      {/* Horizontal Resizable Divider */}
      <div
        className={`h-1 w-full cursor-row-resize transition-colors shrink-0 ${
          isDraggingDivider ? 'bg-blue-500' : 'bg-gray-300 hover:bg-blue-400'
        }`}
        onMouseDown={handleDividerMouseDown}
      />

      {/* Transactions Table */}
      <div
        className="w-full overflow-hidden"
        style={{ height: `${100 - chartHeight}%` }}
      >
        <TransactionsTable coin={coin} />
      </div>

      {/* Overlay to prevent selection while dragging */}
      {isDraggingDivider && <div className="fixed inset-0 cursor-row-resize z-50" />}
    </div>
  );
}
