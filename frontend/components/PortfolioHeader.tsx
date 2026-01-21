'use client';

interface AccountState {
  balance: number;
  unrealizedPnl: number;
  marginUsed: number;
  totalReturnPct?: number;
}

interface PortfolioHeaderProps {
  accountState: AccountState | null;
}

export default function PortfolioHeader({ accountState }: PortfolioHeaderProps) {
  const isLoading = !accountState;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-4 xl:py-5 font-inter">
      <div className="flex items-center justify-between">
        <h2 className="text-lg xl:text-xl font-semibold text-gray-900">Portfolio</h2>

        <div className="flex items-center gap-6 xl:gap-8">
          {isLoading && !accountState ? (
            <div className="flex items-center gap-6">
              <div className="w-24 h-6 bg-gray-200 animate-pulse rounded" />
              <div className="w-24 h-6 bg-gray-200 animate-pulse rounded" />
              <div className="w-24 h-6 bg-gray-200 animate-pulse rounded" />
            </div>
          ) : accountState ? (
            <>
              <div className="text-right">
                <p className="text-[10px] xl:text-xs text-gray-500 uppercase tracking-wider">Balance</p>
                <p className="text-sm xl:text-lg font-bold text-gray-900">
                  ${formatCurrency(accountState.balance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] xl:text-xs text-gray-500 uppercase tracking-wider">Unrealized P&L</p>
                <p className={`text-sm xl:text-lg font-bold ${
                  accountState.unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {accountState.unrealizedPnl >= 0 ? '+' : ''}${formatCurrency(accountState.unrealizedPnl)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] xl:text-xs text-gray-500 uppercase tracking-wider">Margin Used</p>
                <p className="text-sm xl:text-lg font-bold text-gray-900">
                  ${formatCurrency(accountState.marginUsed)}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">Unable to load account</p>
          )}
        </div>
      </div>
    </div>
  );
}
