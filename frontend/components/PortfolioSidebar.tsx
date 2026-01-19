'use client';

const ASSETS = [
  { symbol: 'ETH', binanceSymbol: 'ETHUSDT' },
  { symbol: 'BTC', binanceSymbol: 'BTCUSDT' },
  { symbol: 'SOL', binanceSymbol: 'SOLUSDT' },
  { symbol: 'AVAX', binanceSymbol: 'AVAXUSDT' },
];

interface PortfolioSidebarProps {
  selectedSymbol: string;
  onAssetSelect: (binanceSymbol: string) => void;
}

export default function PortfolioSidebar({ selectedSymbol, onAssetSelect }: PortfolioSidebarProps) {
  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col w-14 xl:w-16 2xl:w-20 font-inter">
      {/* Portfolio Header */}
      <div className="py-6 xl:py-8 flex justify-center border-b border-gray-200">
        <span
          className="text-xs xl:text-sm 2xl:text-base font-semibold text-gray-500 tracking-wider"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          PORTFOLIO
        </span>
      </div>

      {/* Assets List */}
      <div className="flex-1 flex flex-col">
        {ASSETS.map((asset) => (
          <button
            key={asset.symbol}
            onClick={() => onAssetSelect(asset.binanceSymbol)}
            className={`relative py-8 xl:py-10 2xl:py-12 flex items-center justify-center border-b border-gray-200 transition-colors ${
              selectedSymbol === asset.binanceSymbol ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
          >
            {/* Selection indicator line */}
            {selectedSymbol === asset.binanceSymbol && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500" />
            )}

            {/* Asset label */}
            <span
              className={`text-sm xl:text-base 2xl:text-lg font-semibold ${
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
