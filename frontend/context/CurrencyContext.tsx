'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  symbol: string;
  convertAmount: (amountInUSD: number) => number;
  formatAmount: (amountInUSD: number) => string;
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3',
  JPY: '\u00A5',
  AUD: 'A$',
  CAD: 'C$',
};

// Exchange rates relative to USD (1 USD = X currency)
const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  AUD: 1.53,
  CAD: 1.36,
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('USD');

  const symbol = CURRENCY_SYMBOLS[currency];
  const rate = EXCHANGE_RATES[currency];

  const convertAmount = (amountInUSD: number): number => {
    return amountInUSD * rate;
  };

  const formatAmount = (amountInUSD: number): string => {
    const converted = convertAmount(amountInUSD);
    // JPY doesn't use decimal places
    const decimals = currency === 'JPY' ? 0 : 2;
    return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, symbol, convertAmount, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
