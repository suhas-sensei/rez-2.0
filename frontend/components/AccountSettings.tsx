'use client';

import { useState, useEffect } from 'react';
import { useCurrency, Currency } from '@/context/CurrencyContext';
import { useTimezone, Timezone } from '@/context/TimezoneContext';

interface AccountSettingsProps {
  walletAddress?: string;
  linkedEmail?: string;
  onSave?: (settings: SettingsState) => void;
  onDiscard?: () => void;
}

interface SettingsState {
  displayCurrency: string;
  timezone: string;
  tradeExecutionNotifications: boolean;
  marketVolatilityAlerts: boolean;
}

const CURRENCIES = [
  { value: 'USD', label: 'USD - United States Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
];

const TIMEZONES = [
  { value: 'UTC+00:00', label: 'UTC (GMT+00:00)' },
  { value: 'UTC-05:00', label: 'EST (GMT-05:00)' },
  { value: 'UTC-08:00', label: 'PST (GMT-08:00)' },
  { value: 'UTC+01:00', label: 'CET (GMT+01:00)' },
  { value: 'UTC+08:00', label: 'SGT (GMT+08:00)' },
  { value: 'UTC+09:00', label: 'JST (GMT+09:00)' },
];

export default function AccountSettings({
  walletAddress = '',
  linkedEmail = 'user.alpha@rez.trade',
  onSave,
  onDiscard,
}: AccountSettingsProps) {
  const displayAddress = walletAddress || 'Not connected';
  const { currency, setCurrency } = useCurrency();
  const { timezone, setTimezone } = useTimezone();

  const [settings, setSettings] = useState<SettingsState>({
    displayCurrency: currency,
    timezone: timezone,
    tradeExecutionNotifications: true,
    marketVolatilityAlerts: false,
  });

  const [initialSettings, setInitialSettings] = useState<SettingsState>({
    displayCurrency: currency,
    timezone: timezone,
    tradeExecutionNotifications: true,
    marketVolatilityAlerts: false,
  });

  // Sync settings with global currency and timezone on mount
  useEffect(() => {
    setSettings(prev => ({ ...prev, displayCurrency: currency, timezone: timezone }));
    setInitialSettings(prev => ({ ...prev, displayCurrency: currency, timezone: timezone }));
  }, [currency, timezone]);

  // Check if settings have changed
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSave = () => {
    setCurrency(settings.displayCurrency as Currency);
    setTimezone(settings.timezone as Timezone);
    setInitialSettings(settings);
    onSave?.(settings);
  };

  const handleDiscard = () => {
    setSettings(initialSettings);
    onDiscard?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 xl:p-6 space-y-6">
        {/* Page Title */}
        <h2 className="text-xl xl:text-2xl font-bold text-gray-900">Account Settings</h2>

        {/* General Information */}
        <section className="font-inter">
          <h3 className="text-sm xl:text-base font-semibold text-gray-900 mb-4">General Information</h3>
          <div className="bg-gray-50 rounded-xl p-4 xl:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Wallet Address */}
              <div>
                <label className="block text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Wallet Address
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs xl:text-sm text-gray-700 font-mono truncate">
                    {displayAddress}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy address"
                  >
                    {copied ? (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Linked Email */}
              <div>
                <label className="block text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Linked Email
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs xl:text-sm text-gray-700">
                    {linkedEmail}
                  </div>
                  <button className="text-[10px] xl:text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap">
                    Social Login
                  </button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Interface Preferences */}
        <section className="font-inter">
          <h3 className="text-sm xl:text-base font-semibold text-gray-900 mb-4">Interface Preferences</h3>
          <div className="bg-gray-50 rounded-xl p-4 xl:p-5 space-y-5">
            {/* Currency and Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Display Currency */}
              <div>
                <label className="block text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Display Currency
                </label>
                <select
                  value={settings.displayCurrency}
                  onChange={(e) => setSettings({ ...settings, displayCurrency: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs xl:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs xl:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h4 className="text-xs xl:text-sm font-medium text-gray-900 mb-3">Notifications</h4>
              <div className="space-y-3">
                {/* Trade Executions */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div>
                    <p className="text-xs xl:text-sm font-medium text-gray-900">Trade Executions</p>
                    <p className="text-[10px] xl:text-xs text-gray-500">Push notifications when your agent opens or closes a position</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, tradeExecutionNotifications: !settings.tradeExecutionNotifications })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      settings.tradeExecutionNotifications ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.tradeExecutionNotifications ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Market Volatility Alerts */}
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div>
                    <p className="text-xs xl:text-sm font-medium text-gray-900">Market Volatility Alerts</p>
                    <p className="text-[10px] xl:text-xs text-gray-500">Instant alerts when asset price volatility exceeds 5%</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, marketVolatilityAlerts: !settings.marketVolatilityAlerts })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      settings.marketVolatilityAlerts ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        settings.marketVolatilityAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 xl:px-6 py-3 xl:py-4 flex items-center justify-end gap-3 font-inter">
        <button
          onClick={handleDiscard}
          disabled={!hasChanges}
          className={`px-4 py-2 text-xs xl:text-sm font-medium rounded-lg transition-colors ${
            hasChanges
              ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          Discard Changes
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`px-4 py-2 text-xs xl:text-sm font-medium rounded-lg transition-colors ${
            hasChanges
              ? 'text-white bg-blue-600 hover:bg-blue-700'
              : 'text-gray-400 bg-gray-200 cursor-not-allowed'
          }`}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
