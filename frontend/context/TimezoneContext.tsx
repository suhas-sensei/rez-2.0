'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type Timezone = 'UTC+00:00' | 'UTC-05:00' | 'UTC-08:00' | 'UTC+01:00' | 'UTC+08:00' | 'UTC+09:00';

interface TimezoneContextType {
  timezone: Timezone;
  setTimezone: (timezone: Timezone) => void;
  formatTime: (date: Date | string | number) => string;
  formatDate: (date: Date | string | number) => string;
  formatDateTime: (date: Date | string | number) => string;
  getTimezoneLabel: () => string;
}

const TIMEZONE_OFFSETS: Record<Timezone, number> = {
  'UTC+00:00': 0,
  'UTC-05:00': -5,
  'UTC-08:00': -8,
  'UTC+01:00': 1,
  'UTC+08:00': 8,
  'UTC+09:00': 9,
};

const TIMEZONE_LABELS: Record<Timezone, string> = {
  'UTC+00:00': 'UTC',
  'UTC-05:00': 'EST',
  'UTC-08:00': 'PST',
  'UTC+01:00': 'CET',
  'UTC+08:00': 'SGT',
  'UTC+09:00': 'JST',
};

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezone] = useState<Timezone>('UTC+00:00');

  const offsetHours = TIMEZONE_OFFSETS[timezone];

  const applyOffset = (date: Date | string | number): Date => {
    const d = new Date(date);
    // Get UTC time and apply offset
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utcTime + (offsetHours * 3600000));
  };

  const formatTime = (date: Date | string | number): string => {
    const adjusted = applyOffset(date);
    const hours = adjusted.getHours().toString().padStart(2, '0');
    const minutes = adjusted.getMinutes().toString().padStart(2, '0');
    const seconds = adjusted.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date | string | number): string => {
    const adjusted = applyOffset(date);
    const month = (adjusted.getMonth() + 1).toString().padStart(2, '0');
    const day = adjusted.getDate().toString().padStart(2, '0');
    const year = adjusted.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatDateTime = (date: Date | string | number): string => {
    const adjusted = applyOffset(date);
    const month = (adjusted.getMonth() + 1).toString().padStart(2, '0');
    const day = adjusted.getDate().toString().padStart(2, '0');
    const year = adjusted.getFullYear();
    const hours = adjusted.getHours().toString().padStart(2, '0');
    const minutes = adjusted.getMinutes().toString().padStart(2, '0');
    const seconds = adjusted.getSeconds().toString().padStart(2, '0');
    return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds}`;
  };

  const getTimezoneLabel = (): string => {
    return TIMEZONE_LABELS[timezone];
  };

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatTime, formatDate, formatDateTime, getTimezoneLabel }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const context = useContext(TimezoneContext);
  if (context === undefined) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
}
