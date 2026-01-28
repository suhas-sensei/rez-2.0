'use client';

import { useState, useEffect, useRef } from 'react';
import { useCurrency } from '@/context/CurrencyContext';

const SYMBOLS = ['BTC', 'SOL', 'ETH', 'AVAX', 'DOGE', 'STRK'];

interface TickerData {
  symbol: string;
  price: number;
  prevPrice: number;
  up: boolean;
  changed: boolean;
}

function AnimatedPrice({ price, up, changed, formatAmount }: { price: number; up: boolean; changed: boolean; formatAmount: (n: number) => string }) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayPrice, setDisplayPrice] = useState(price);
  const prevPriceRef = useRef(price);

  useEffect(() => {
    if (changed && price !== prevPriceRef.current) {
      setIsAnimating(true);
      setDisplayPrice(price);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 800);
      prevPriceRef.current = price;
      return () => clearTimeout(timer);
    } else {
      setDisplayPrice(price);
    }
  }, [price, changed]);

  return (
    <span className="text-xs font-medium text-black relative overflow-hidden inline-flex h-4">
      <span
        key={price}
        className={`${isAnimating ? (up ? 'animate-slide-up' : 'animate-slide-down') : ''}`}
      >
        {formatAmount(displayPrice)}
      </span>
    </span>
  );
}

function TickerItem({ ticker, formatAmount }: { ticker: TickerData; formatAmount: (n: number) => string }) {
  return (
    <div className="flex items-center gap-1 shrink-0 px-4">
      <span
        className={`text-xs transition-all duration-300 ${
          ticker.up ? 'text-green-500' : 'text-red-500'
        } ${ticker.changed ? (ticker.up ? 'animate-bounce-up' : 'animate-bounce-down') : ''}`}
      >
        {ticker.up ? '↑' : '↓'}
      </span>
      <span className="text-xs text-gray-500">{ticker.symbol}</span>
      <AnimatedPrice price={ticker.price} up={ticker.up} changed={ticker.changed} formatAmount={formatAmount} />
    </div>
  );
}

export default function AggregateBar() {
  const { formatAmount } = useCurrency();
  const [tickers, setTickers] = useState<TickerData[]>(
    SYMBOLS.map((symbol) => ({ symbol, price: 0, prevPrice: 0, up: true, changed: false }))
  );

  const fetchPrices = async () => {
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
      });
      const data = await response.json();

      setTickers((prev) =>
        SYMBOLS.map((symbol) => {
          const price = parseFloat(data[symbol] || '0');
          const prevTicker = prev.find((t) => t.symbol === symbol);
          const prevPrice = prevTicker?.price || price;
          const changed = prevPrice !== price && prevPrice !== 0;
          return {
            symbol,
            price,
            prevPrice,
            up: price >= prevPrice,
            changed,
          };
        })
      );
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  };

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate tickers for seamless loop (mobile only)
  const displayTickers = [...tickers, ...tickers, ...tickers];

  return (
    <div className="bg-white border-b border-gray-200 font-inter overflow-hidden">
      <div className="py-1">
        {/* Mobile: Scrolling marquee (below 620px) */}
        <div
          className="flex items-center sm:hidden"
          style={{
            animation: 'marquee 20s linear infinite',
          }}
        >
          {displayTickers.map((ticker, index) => (
            <TickerItem key={`${ticker.symbol}-${index}`} ticker={ticker} formatAmount={formatAmount} />
          ))}
        </div>

        {/* Desktop: Static layout (620px and above) */}
        <div className="hidden sm:flex items-center justify-end gap-1 sm:gap-2 xl:gap-3 px-4 sm:px-6 lg:px-8 xl:px-12">
          {tickers.map((ticker) => (
            <TickerItem key={ticker.symbol} ticker={ticker} formatAmount={formatAmount} />
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }
      `}</style>
    </div>
  );
}
