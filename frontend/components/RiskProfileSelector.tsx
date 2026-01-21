'use client';

export type RiskProfile = 'conservative' | 'moderate' | 'high' | 'debug';

interface RiskProfileSelectorProps {
  selectedProfile: RiskProfile;
  onSelectProfile: (profile: RiskProfile) => void;
  disabled?: boolean;
}

const RISK_PROFILES = [
  {
    id: 'conservative' as RiskProfile,
    name: 'Conservative',
    label: 'SAFE',
    description: 'Careful, high-quality setups only',
    color: 'green',
    specs: {
      allocation: '20-40%',
      leverage: '3-5x',
      stopLoss: '1-2%',
      takeProfit: '2-4%',
      cooldown: '15 min',
    },
  },
  {
    id: 'moderate' as RiskProfile,
    name: 'Moderate',
    label: 'MEDIUM',
    description: 'Balanced risk/reward approach',
    color: 'orange',
    specs: {
      allocation: '40-60%',
      leverage: '5-10x',
      stopLoss: '0.5-1%',
      takeProfit: '1-2%',
      cooldown: '10 min',
    },
  },
  {
    id: 'high' as RiskProfile,
    name: 'Aggressive',
    label: 'RISKY',
    description: 'Frequent trading, maximum returns',
    color: 'red',
    specs: {
      allocation: '60-80%',
      leverage: '10-20x',
      stopLoss: '0.3-0.5%',
      takeProfit: '0.5-1%',
      cooldown: '5 min',
    },
  },
  {
    id: 'debug' as RiskProfile,
    name: 'Debug',
    label: 'TEST',
    description: 'Random trades for UI testing',
    color: 'purple',
    specs: {
      allocation: '$12',
      leverage: '1x',
      stopLoss: '1%',
      takeProfit: '0.5%',
      cooldown: 'None',
    },
  },
];

export default function RiskProfileSelector({
  selectedProfile,
  onSelectProfile,
  disabled = false,
}: RiskProfileSelectorProps) {
  return (
    <div className="bg-white px-4 py-4 xl:py-5 font-inter">
      <h3 className="text-sm xl:text-base font-semibold text-gray-900 mb-3 xl:mb-4">Risk Profile</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:gap-4">
        {RISK_PROFILES.map((profile) => {
          const isSelected = selectedProfile === profile.id;
          const colorMap: Record<string, { border: string; label: string; dot: string }> = {
            green: {
              border: isSelected ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200 hover:border-green-300',
              label: 'bg-green-100 text-green-700',
              dot: 'bg-green-500',
            },
            orange: {
              border: isSelected ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300',
              label: 'bg-orange-100 text-orange-700',
              dot: 'bg-orange-500',
            },
            red: {
              border: isSelected ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-200 hover:border-red-300',
              label: 'bg-red-100 text-red-700',
              dot: 'bg-red-500',
            },
            purple: {
              border: isSelected ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200 hover:border-purple-300',
              label: 'bg-purple-100 text-purple-700',
              dot: 'bg-purple-500',
            },
          };
          const colorClasses = colorMap[profile.color];

          return (
            <button
              key={profile.id}
              onClick={() => !disabled && onSelectProfile(profile.id)}
              disabled={disabled}
              className={`relative p-3 xl:p-4 rounded-lg border-2 transition-all text-left ${colorClasses.border} ${
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {/* Selected indicator */}
              {isSelected && (
                <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${colorClasses.dot}`} />
              )}

              {/* Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] xl:text-xs font-bold px-2 py-0.5 rounded ${colorClasses.label}`}>
                  {profile.label}
                </span>
              </div>

              <h4 className="text-sm xl:text-base font-semibold text-gray-900 mb-1">{profile.name}</h4>
              <p className="text-xs xl:text-sm text-gray-500 mb-3">{profile.description}</p>

              {/* Specs */}
              <div className="space-y-1 text-[10px] xl:text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Allocation:</span>
                  <span className="font-medium">{profile.specs.allocation}</span>
                </div>
                <div className="flex justify-between">
                  <span>Leverage:</span>
                  <span className="font-medium">{profile.specs.leverage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stop Loss:</span>
                  <span className="font-medium">{profile.specs.stopLoss}</span>
                </div>
                <div className="flex justify-between">
                  <span>Take Profit:</span>
                  <span className="font-medium">{profile.specs.takeProfit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cooldown:</span>
                  <span className="font-medium">{profile.specs.cooldown}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
