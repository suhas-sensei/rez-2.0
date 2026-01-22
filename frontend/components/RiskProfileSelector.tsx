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
    color: 'green',
    description: 'Careful, high-quality setups only.',
    stats: {
      allocation: '20-40%',
      leverage: '3-5x',
      takeProfit: '2-4%',
    },
  },
  {
    id: 'moderate' as RiskProfile,
    name: 'Moderate',
    label: 'MEDIUM',
    color: 'orange',
    description: 'Balanced risk/reward approach.',
    stats: {
      allocation: '40-60%',
      leverage: '5-10x',
      takeProfit: '5-10%',
    },
  },
  {
    id: 'high' as RiskProfile,
    name: 'Aggressive',
    label: 'RISKY',
    color: 'red',
    description: 'Frequent trading, maximum returns.',
    stats: {
      allocation: '60-80%',
      leverage: '10-20x',
      takeProfit: '10-25%',
    },
  },
  {
    id: 'debug' as RiskProfile,
    name: 'Debug',
    label: 'TEST',
    color: 'purple',
    description: 'Random trades for UI testing.',
    stats: {
      allocation: '$12',
      leverage: '1x',
      cooldown: 'None',
    },
  },
];

export default function RiskProfileSelector({
  selectedProfile,
  onSelectProfile,
  disabled = false,
}: RiskProfileSelectorProps) {
  const colorStyles: Record<string, {
    labelBg: string;
    labelText: string;
    borderColor: string;
    selectedBorder: string;
    statValue: string;
    glow: string;
  }> = {
    green: {
      labelBg: 'bg-green-100',
      labelText: 'text-green-600',
      borderColor: 'border-green-200',
      selectedBorder: 'border-green-500',
      statValue: 'text-green-600',
      glow: '0 4px 20px -2px rgba(34, 197, 94, 0.2)',
    },
    orange: {
      labelBg: 'bg-orange-100',
      labelText: 'text-orange-600',
      borderColor: 'border-orange-200',
      selectedBorder: 'border-orange-500',
      statValue: 'text-orange-600',
      glow: '0 4px 20px -2px rgba(249, 115, 22, 0.2)',
    },
    red: {
      labelBg: 'bg-red-100',
      labelText: 'text-red-600',
      borderColor: 'border-red-200',
      selectedBorder: 'border-red-500',
      statValue: 'text-red-600',
      glow: '0 4px 20px -2px rgba(239, 68, 68, 0.2)',
    },
    purple: {
      labelBg: 'bg-purple-100',
      labelText: 'text-purple-600',
      borderColor: 'border-purple-200',
      selectedBorder: 'border-purple-500',
      statValue: 'text-purple-600',
      glow: '0 4px 20px -2px rgba(168, 85, 247, 0.2)',
    },
  };

  return (
    <div className="bg-white px-8 py-4 xl:py-5 font-inter">
      <h3 className="text-base xl:text-lg font-semibold text-gray-900 mb-4">Risk Profile</h3>
      <div className="grid grid-cols-4 gap-3 xl:gap-4">
        {RISK_PROFILES.map((profile) => {
          const isSelected = selectedProfile === profile.id;
          const styles = colorStyles[profile.color];

          return (
            <button
              key={profile.id}
              onClick={() => !disabled && onSelectProfile(profile.id)}
              disabled={disabled}
              className={`relative p-4 rounded-xl bg-white text-left transition-all ${
                isSelected
                  ? `border-2 ${styles.selectedBorder} border-dashed`
                  : `border border-gray-100`
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{ boxShadow: styles.glow }}
            >
              {/* Title Row with Label Badge */}
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm xl:text-base font-semibold text-gray-900">
                  {profile.name}
                </h4>
                <div className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${styles.labelBg} ${styles.labelText}`}>
                  {profile.label}
                </div>
              </div>

              {/* Description */}
              <p className="text-[10px] xl:text-xs text-gray-500 mb-3 leading-relaxed">
                {profile.description}
              </p>

              {/* Stats */}
              <div className="space-y-1">
                {Object.entries(profile.stats).map(([key, value]) => (
                  <div key={key} className="flex text-[10px] xl:text-xs">
                    <span className="text-gray-400 capitalize w-20 shrink-0">
                      {key === 'takeProfit' ? 'Take Profit' : key === 'stopLoss' ? 'Stop Loss' : key}:
                    </span>
                    <span className={`font-medium ${styles.statValue} text-right flex-1`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
