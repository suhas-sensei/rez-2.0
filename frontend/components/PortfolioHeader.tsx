'use client';

import { useCurrency } from '@/context/CurrencyContext';

interface AccountState {
  balance: number;
  unrealizedPnl: number;
  marginUsed: number;
  totalReturnPct?: number;
}

interface PortfolioHeaderProps {
  accountState: AccountState | null;
  onAccountSettings?: () => void;
  onViewGrowth?: () => void;
  onCloseAllPositions?: () => void;
  positionsCount?: number;
  isClosingPositions?: boolean;
}

export default function PortfolioHeader({
  accountState,
  onAccountSettings,
  onViewGrowth,
  onCloseAllPositions,
  positionsCount = 0,
  isClosingPositions = false,
}: PortfolioHeaderProps) {
  const isLoading = !accountState;
  const { symbol: currencySymbol } = useCurrency();

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const pnlPercent = accountState?.totalReturnPct ?? 0;

  return (
    <div className="bg-white px-8 py-4 xl:py-5 font-inter border-b border-gray-100">
      <div className="flex items-center justify-between">
        {/* Left side - Title */}
        <div>
          <h2 className="text-lg xl:text-xl font-semibold text-gray-900">Portfolio Overview</h2>
          
        </div>

        {/* Right side - Stats in a box */}
        <div className="flex items-center gap-3">
          {/* Account Settings Tab */}
          {onAccountSettings && (
            <button
              onClick={onAccountSettings}
              className="flex items-center justify-center gap-2 px-5 py-3 xl:py-4 bg-gray-50/80 hover:bg-gray-100 rounded-2xl border border-gray-100 shadow-sm transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm xl:text-base font-medium text-gray-700">Account</span>
            </button>
          )}

          {/* Growth Tab */}
          {onViewGrowth && (
            <button
              onClick={onViewGrowth}
              className="flex items-center justify-center gap-2 px-5 py-3 xl:py-4 bg-gray-50/80 hover:bg-gray-100 rounded-2xl border border-gray-100 shadow-sm transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="text-sm xl:text-base font-medium text-gray-700">Growth</span>
            </button>
          )}

          <div className="flex bg-gray-50/80 rounded-2xl py-3 xl:py-4 shadow-sm border border-gray-100 ml-6">
          {/* Balance */}
          <div className="text-center px-4 xl:px-5 flex flex-col justify-center">
            <p className="text-[10px] xl:text-xs text-gray-400 uppercase tracking-wider mb-1">Balance</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <p className="text-base xl:text-lg font-semibold text-gray-900">
                {currencySymbol}{formatCurrency(accountState?.balance ?? 0)}
              </p>
            )}
          </div>

          {/* Unrealized PNL */}
          <div className="text-center px-4 xl:px-5 border-l border-gray-200 flex flex-col justify-center">
            <p className="text-[10px] xl:text-xs text-gray-400 uppercase tracking-wider mb-1">Unrealized P&L</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <p className="flex items-baseline justify-center gap-1">
                <span className={`text-base xl:text-lg font-semibold ${
                  (accountState?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {(accountState?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}{currencySymbol}{formatCurrency(accountState?.unrealizedPnl ?? 0)}
                </span>
                <span className={`text-[10px] xl:text-xs ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                </span>
              </p>
            )}
          </div>

          {/* Margin Used */}
          <div className="text-center px-4 xl:px-5 border-l border-gray-200 flex flex-col justify-center">
            <p className="text-[10px] xl:text-xs text-gray-400 uppercase tracking-wider mb-1">Margin Used</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <p className="text-base xl:text-lg font-semibold text-gray-900">
                {currencySymbol}{formatCurrency(accountState?.marginUsed ?? 0)}
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
