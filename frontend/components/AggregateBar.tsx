'use client';

import { useState, useEffect, useRef } from 'react';

const SYMBOLS = ['BTC', 'SOL', 'ETH', 'AVAX', 'DOGE', 'STRK'];

interface TickerData {
  symbol: string;
  price: number;
  prevPrice: number;
  up: boolean;
  changed: boolean;
}

function AnimatedPrice({ price, up, changed }: { price: number; up: boolean; changed: boolean }) {
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

  const formattedPrice = displayPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span className="text-xs xl:text-sm 2xl:text-base font-medium text-black relative overflow-hidden inline-flex h-4 xl:h-5 2xl:h-6">
      <span
        key={price}
        className={`${isAnimating ? (up ? 'animate-slide-up' : 'animate-slide-down') : ''}`}
      >
        ${formattedPrice}
      </span>
    </span>
  );
}

export default function AggregateBar() {
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

  return (
    <div className="bg-white border-b border-gray-200 font-inter">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-2 sm:py-3 xl:py-4">
        <div className="flex items-center justify-start sm:justify-end gap-4 sm:gap-6 xl:gap-8 overflow-x-auto scrollbar-hide">
          {tickers.map((ticker) => (
            <div key={ticker.symbol} className="flex items-center gap-1.5 xl:gap-2 flex-shrink-0">
              <span
                className={`text-xs xl:text-sm 2xl:text-base transition-all duration-300 ${
                  ticker.up ? 'text-green-500' : 'text-red-500'
                } ${ticker.changed ? (ticker.up ? 'animate-bounce-up' : 'animate-bounce-down') : ''}`}
              >
                {ticker.up ? '↑' : '↓'}
              </span>
              <span className="text-xs xl:text-sm 2xl:text-base text-gray-500">{ticker.symbol}</span>
              <AnimatedPrice price={ticker.price} up={ticker.up} changed={ticker.changed} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
