'use client';

const ASSETS = [
  { symbol: 'PORTFOLIO', binanceSymbol: 'PORTFOLIO', isPortfolio: true },
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT', isPortfolio: false },
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT', isPortfolio: false },
  { symbol: 'SOL', binanceSymbol: 'SOLUSDT', isPortfolio: false },
  { symbol: 'AVAX', binanceSymbol: 'AVAXUSDT', isPortfolio: false },
];

interface PortfolioSidebarProps {
  selectedSymbol: string;
  onAssetSelect: (binanceSymbol: string) => void;
}

export default function PortfolioSidebar({ selectedSymbol, onAssetSelect }: PortfolioSidebarProps) {
  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col w-14 xl:w-16 2xl:w-20 font-inter">
      {/* Assets List */}
      <div className="flex-1 flex flex-col">
        {ASSETS.map((asset, index) => (
          <button
            key={asset.symbol}
            onClick={() => onAssetSelect(asset.binanceSymbol)}
            className={`relative py-6 xl:py-8 2xl:py-10 flex items-center justify-center transition-colors ${
              index < ASSETS.length - 1 ? 'border-b border-gray-200' : ''
            } ${
              selectedSymbol === asset.binanceSymbol ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            {/* Selection indicator line */}
            {selectedSymbol === asset.binanceSymbol && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
            )}

            {/* Asset label */}
            <span
              className={`text-xs xl:text-sm 2xl:text-base font-semibold ${
                selectedSymbol === asset.binanceSymbol ? 'text-orange-500' : 'text-gray-700'
              }`}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              {asset.symbol}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
