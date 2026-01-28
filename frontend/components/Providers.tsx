'use client';

import { CurrencyProvider } from '@/context/CurrencyContext';
import { TimezoneProvider } from '@/context/TimezoneContext';
import { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <CurrencyProvider>
      <TimezoneProvider>
        {children}
      </TimezoneProvider>
    </CurrencyProvider>
  );
}
