'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, LineData, CandlestickData, Time } from 'lightweight-charts';

const TIME_INTERVALS = [
  { label: '1s', value: '1s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: 'D', value: '1d' },
];

interface LiveChartProps {
  symbol?: string;
}

export default function LiveChart({ symbol = 'ETHUSDT' }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | ISeriesApi<'Candlestick'> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [selectedInterval, setSelectedInterval] = useState('1m');
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');
  const [priceMode, setPriceMode] = useState<'Price' | 'MCap'>('Price');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchHistoricalData = useCallback(async (interval: string, type: 'line' | 'candle') => {
    try {
      const response = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=500`
      );
      const data = await response.json();

      if (type === 'line') {
        const chartData: LineData<Time>[] = data.map((item: (string | number)[]) => ({
          time: (Number(item[0]) / 1000) as Time,
          value: parseFloat(item[4] as string),
        }));

        if (seriesRef.current && chartData.length > 0) {
          seriesRef.current.setData(chartData);
          const lastPrice = chartData[chartData.length - 1].value;
          const firstPrice = chartData[0].value;
          setCurrentPrice(lastPrice);
          setPriceChange(((lastPrice - firstPrice) / firstPrice) * 100);
          chartRef.current?.timeScale().fitContent();
        }
      } else {
        const chartData: CandlestickData<Time>[] = data.map((item: (string | number)[]) => ({
          time: (Number(item[0]) / 1000) as Time,
          open: parseFloat(item[1] as string),
          high: parseFloat(item[2] as string),
          low: parseFloat(item[3] as string),
          close: parseFloat(item[4] as string),
        }));

        if (seriesRef.current && chartData.length > 0) {
          seriesRef.current.setData(chartData);
          const lastPrice = chartData[chartData.length - 1].close;
          const firstPrice = chartData[0].open;
          setCurrentPrice(lastPrice);
          setPriceChange(((lastPrice - firstPrice) / firstPrice) * 100);
          chartRef.current?.timeScale().fitContent();
        }
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error);
    }
  }, [symbol]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;

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
      fetchHistoricalData(selectedInterval, chartType);
    }, 0);

    // WebSocket for real-time updates
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const price = parseFloat(data.p);
      const time = Math.floor(data.T / 1000) as Time;

      if (seriesRef.current) {
        if (chartType === 'line') {
          seriesRef.current.update({
            time,
            value: price,
          });
        } else {
          seriesRef.current.update({
            time,
            open: price,
            high: price,
            low: price,
            close: price,
          });
        }
        setCurrentPrice(price);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [symbol, fetchHistoricalData, selectedInterval, chartType]);

  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval);
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

  return (
    <div ref={containerRef} className={`w-full h-full flex flex-col overflow-hidden ${isFullscreen ? 'bg-white' : ''}`}>
      {/* Chart Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 border-b border-gray-200 font-inter">
        {/* Left: Time intervals */}
        <div className="flex items-center gap-0.5">
          {TIME_INTERVALS.map((interval) => (
            <button
              key={interval.value}
              onClick={() => handleIntervalChange(interval.value)}
              className={`px-3 py-1.5 text-base xl:text-lg rounded transition-colors ${
                selectedInterval === interval.value
                  ? 'bg-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {interval.label}
            </button>
          ))}

          {/* Separator */}
          <div className="w-px h-4 bg-gray-300 mx-2" />

          {/* Chart controls */}
          <button
            onClick={() => setChartType('line')}
            className={`p-2 rounded transition-colors ${
              chartType === 'line'
                ? 'bg-gray-200'
                : 'hover:bg-gray-100 opacity-50 hover:opacity-100'
            }`}
          >
            <Image src="/graph.png" alt="Line chart" width={20} height={20} />
          </button>
          <button
            onClick={() => setChartType('candle')}
            className={`p-2 rounded transition-colors ${
              chartType === 'candle'
                ? 'bg-gray-200'
                : 'hover:bg-gray-100 opacity-50 hover:opacity-100'
            }`}
          >
            <Image src="/bar-chart.png" alt="Candlestick chart" width={20} height={20} />
          </button>
        </div>

        {/* Right: Feature toggles */}
        <div className="flex items-center gap-1">
          {/* Price / MCap toggle */}
          <div className="flex items-center bg-gray-100 rounded">
            <button
              onClick={() => setPriceMode('Price')}
              className={`px-2 py-1 text-sm xl:text-base rounded-l transition-colors ${
                priceMode === 'Price' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Price
            </button>
            <button
              onClick={() => setPriceMode('MCap')}
              className={`px-2 py-1 text-sm xl:text-base rounded-r transition-colors ${
                priceMode === 'MCap' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              MCap
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-gray-300 mx-1" />

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center gap-1 px-2 py-1 text-sm xl:text-base rounded transition-colors ${
              isFullscreen ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              )}
            </svg>
            <span>{isFullscreen ? 'Exit' : 'Full'}</span>
          </button>
        </div>
      </div>

      {/* Price display */}
      <div className="flex items-center gap-3 px-4 py-2 xl:py-3 font-inter bg-white">
        <span className="text-xl xl:text-2xl 2xl:text-3xl font-medium text-gray-900">{symbol.replace('USDT', '/USDT')}</span>
        {currentPrice !== null && (
          <>
            <span className="text-xl xl:text-2xl 2xl:text-3xl font-bold text-gray-900">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        className="flex-1 w-full bg-white overflow-hidden"
      />
    </div>
  );
}
