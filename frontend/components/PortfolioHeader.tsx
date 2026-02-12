'use client';

import { useState, useRef, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';

interface AccountState {
  balance: number;
  unrealizedPnl: number;
  marginUsed: number;
  totalReturnPct?: number;
}

interface PortfolioHeaderProps {
  accountState: AccountState | null;
  walletAddress?: string;
  onAccountSettings?: () => void;
  onViewGrowth?: () => void;
  onLogout?: () => void;
  onCloseAllPositions?: () => void;
  positionsCount?: number;
  isClosingPositions?: boolean;
  isAgentRunning?: boolean;
}

export default function PortfolioHeader({
  accountState,
  walletAddress,
  onAccountSettings,
  onViewGrowth,
  onLogout,
  onCloseAllPositions,
  positionsCount = 0,
  isClosingPositions = false,
  isAgentRunning = false,
}: PortfolioHeaderProps) {
  const isLoading = !accountState;
  const { formatAmount } = useCurrency();
  const [copied, setCopied] = useState(false);
  const [showWalletPopup, setShowWalletPopup] = useState(false);
  const walletPopupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (walletPopupRef.current && !walletPopupRef.current.contains(e.target as Node)) {
        setShowWalletPopup(false);
      }
    };
    if (showWalletPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletPopup]);

  const copyToClipboard = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const pnlPercent = accountState?.totalReturnPct ?? 0;

  return (
    <div className="bg-white px-2.5 min-[330px]:px-4 min-[1386px]:px-8 py-2 min-[365px]:py-2.5 min-[570px]:py-4 min-[1386px]:py-5 font-inter border-b border-gray-100">
      <div className="flex items-center justify-between">
        {/* Left side - Title */}
        <div className="shrink-0">
          <h2 className="text-[13px] min-[330px]:text-base min-[1386px]:text-xl font-semibold text-gray-900">
            <span className="min-[730px]:hidden">Portfolio</span>
            <span className="hidden min-[730px]:inline">Portfolio Overview</span>
          </h2>
          {walletAddress && (
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 min-[330px]:gap-2 mt-0.5 min-[330px]:mt-1 cursor-pointer hover:bg-gray-100 rounded px-1 -ml-1 transition-colors"
              title={copied ? 'Copied!' : 'Click to copy address'}
            >
              <span className="text-[11px] min-[330px]:text-xs min-[1386px]:text-sm text-gray-500 font-mono">
                {walletAddress.slice(0, 4)}..{walletAddress.slice(-5)}
              </span>
              {copied ? (
                <svg className="w-3 h-3 min-[330px]:w-3.5 min-[330px]:h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 min-[330px]:w-3.5 min-[330px]:h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Right side - Stats in a box */}
        <div className="flex items-center gap-1.5 min-[330px]:gap-1.5 min-[1386px]:gap-3">
          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center justify-center px-2 min-[330px]:px-2.5 min-[730px]:px-3 min-[1386px]:px-5 py-2 min-[330px]:py-2.5 min-[1386px]:py-4 bg-red-500/80 hover:bg-red-600/90 rounded-xl min-[330px]:rounded-2xl shadow-sm transition-colors"
              title="Logout"
            >
              <svg className="w-3.5 h-3.5 min-[330px]:w-4 min-[330px]:h-4 min-[730px]:hidden text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden min-[730px]:inline text-xs min-[1386px]:text-base font-medium text-white">Logout</span>
            </button>
          )}

          {/* Account Settings Tab */}
          {onAccountSettings && (
            <button
              onClick={onAccountSettings}
              className="flex items-center justify-center gap-1.5 min-[1386px]:gap-2 px-2 min-[330px]:px-2.5 min-[730px]:px-3 min-[1386px]:px-5 py-2 min-[330px]:py-2.5 min-[1386px]:py-4 bg-gray-50/80 hover:bg-gray-100 rounded-xl min-[330px]:rounded-2xl border border-gray-100 shadow-sm transition-colors"
              title="Account"
            >
              <svg className="w-3.5 h-3.5 min-[330px]:w-4 min-[330px]:h-4 min-[1386px]:w-5 min-[1386px]:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden min-[730px]:inline text-xs min-[1386px]:text-base font-medium text-gray-700">Account</span>
            </button>
          )}

          {/* Growth Tab */}
          {onViewGrowth && (
            <button
              onClick={onViewGrowth}
              className="flex items-center justify-center gap-1.5 min-[1386px]:gap-2 px-2 min-[330px]:px-2.5 min-[730px]:px-3 min-[1386px]:px-5 py-2 min-[330px]:py-2.5 min-[1386px]:py-4 bg-gray-50/80 hover:bg-gray-100 rounded-xl min-[330px]:rounded-2xl border border-gray-100 shadow-sm transition-colors"
              title="Growth"
            >
              <svg className="w-3.5 h-3.5 min-[330px]:w-4 min-[330px]:h-4 min-[1386px]:w-5 min-[1386px]:h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="hidden min-[730px]:inline text-xs min-[1386px]:text-base font-medium text-gray-700">Growth</span>
            </button>
          )}

          {/* Wallet Icon - visible below 590px */}
          <div className="relative min-[590px]:hidden" ref={walletPopupRef}>
            <button
              onClick={() => setShowWalletPopup(!showWalletPopup)}
              className="flex items-center justify-center px-2 min-[330px]:px-2.5 py-2 min-[330px]:py-2.5 bg-gray-50/80 hover:bg-gray-100 rounded-xl min-[330px]:rounded-2xl border border-gray-100 shadow-sm transition-colors ml-1.5 min-[330px]:ml-2"
              title="Wallet Stats"
            >
              <svg className="w-3.5 h-3.5 min-[330px]:w-4 min-[330px]:h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </button>

            {showWalletPopup && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 z-50 min-w-[220px]">
                {/* Balance */}
                <div className="mb-3">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Balance</p>
                  {isLoading ? (
                    <div className="h-5 w-20 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(accountState?.balance ?? 0)}
                    </p>
                  )}
                </div>

                {/* Unrealized PNL */}
                <div className="mb-3 pt-3 border-t border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Unrealized P&L</p>
                  {isLoading ? (
                    <div className="h-5 w-20 bg-gray-200 animate-pulse rounded" />
                  ) : !isAgentRunning ? (
                    <p className="text-sm font-semibold text-gray-400">--</p>
                  ) : (
                    <p className="flex items-baseline gap-1">
                      <span className={`text-sm font-semibold ${
                        (accountState?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                      }`}>
                        {(accountState?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}{formatAmount(accountState?.unrealizedPnl ?? 0)}
                      </span>
                      <span className={`text-[9px] ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                      </span>
                    </p>
                  )}
                </div>

                {/* Margin Used */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Margin Used</p>
                  {isLoading ? (
                    <div className="h-5 w-20 bg-gray-200 animate-pulse rounded" />
                  ) : !isAgentRunning ? (
                    <p className="text-sm font-semibold text-gray-400">--</p>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">
                      {formatAmount(accountState?.marginUsed ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stats Box - hidden below 590px */}
          <div className="hidden min-[590px]:flex bg-gray-50/80 rounded-2xl py-2.5 min-[1386px]:py-4 shadow-sm border border-gray-100 ml-2 min-[1386px]:ml-6">
          {/* Balance */}
          <div className="text-center px-2.5 min-[1386px]:px-5 flex flex-col justify-center">
            <p className="text-[9px] min-[1386px]:text-xs text-gray-400 uppercase tracking-wider mb-1">Balance</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : (
              <p className="text-sm min-[1386px]:text-lg font-semibold text-gray-900">
                {formatAmount(accountState?.balance ?? 0)}
              </p>
            )}
          </div>

          {/* Unrealized PNL */}
          <div className="text-center px-2.5 min-[1386px]:px-5 border-l border-gray-200 flex flex-col justify-center">
            <p className="text-[9px] min-[1386px]:text-xs text-gray-400 uppercase tracking-wider mb-1">Unrealized P&L</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : !isAgentRunning ? (
              <p className="text-sm min-[1386px]:text-lg font-semibold text-gray-400">--</p>
            ) : (
              <p className="flex items-baseline justify-center gap-1">
                <span className={`text-sm min-[1386px]:text-lg font-semibold ${
                  (accountState?.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {(accountState?.unrealizedPnl ?? 0) >= 0 ? '+' : ''}{formatAmount(accountState?.unrealizedPnl ?? 0)}
                </span>
                <span className={`text-[9px] min-[1386px]:text-xs ${pnlPercent >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
                </span>
              </p>
            )}
          </div>

          {/* Margin Used */}
          <div className="text-center px-2.5 min-[1386px]:px-5 border-l border-gray-200 flex flex-col justify-center">
            <p className="text-[9px] min-[1386px]:text-xs text-gray-400 uppercase tracking-wider mb-1">Margin Used</p>
            {isLoading ? (
              <div className="h-6 w-16 bg-gray-200 animate-pulse rounded mx-auto" />
            ) : !isAgentRunning ? (
              <p className="text-sm min-[1386px]:text-lg font-semibold text-gray-400">--</p>
            ) : (
              <p className="text-sm min-[1386px]:text-lg font-semibold text-gray-900">
                {formatAmount(accountState?.marginUsed ?? 0)}
              </p>
            )}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
