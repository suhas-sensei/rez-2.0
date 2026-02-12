'use client';

import { useState, useRef, useEffect } from 'react';

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

  const [activeIndex, setActiveIndex] = useState(1);
  const [enableTransition, setEnableTransition] = useState(true);
  const isAnimating = useRef(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 339px)');
    setIsNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const cardWidth = isNarrow ? 100 : 70;
  const cardOffset = isNarrow ? 0 : 15;

  // Clone last card at start + first card at end for seamless looping
  const extendedProfiles = [
    RISK_PROFILES[RISK_PROFILES.length - 1],
    ...RISK_PROFILES,
    RISK_PROFILES[0],
  ];

  const realIndex = ((activeIndex - 1) % RISK_PROFILES.length + RISK_PROFILES.length) % RISK_PROFILES.length;

  const goLeft = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setEnableTransition(true);
    setActiveIndex((i) => i - 1);
  };

  const goRight = () => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setEnableTransition(true);
    setActiveIndex((i) => i + 1);
  };

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target !== e.currentTarget) return;
    isAnimating.current = false;
    if (activeIndex === 0) {
      setEnableTransition(false);
      setActiveIndex(RISK_PROFILES.length);
    } else if (activeIndex === extendedProfiles.length - 1) {
      setEnableTransition(false);
      setActiveIndex(1);
    }
  };

  const renderCard = (profile: typeof RISK_PROFILES[0]) => {
    const isSelected = selectedProfile === profile.id;
    const styles = colorStyles[profile.color];

    return (
      <button
        key={profile.id}
        onClick={() => !disabled && onSelectProfile(profile.id)}
        disabled={disabled}
        className={`relative p-4 rounded-xl bg-white text-left transition-all w-full ${
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
  };

  return (
    <div className="bg-white px-3 min-[365px]:px-4 min-[570px]:px-4 min-[720px]:px-8 py-2 min-[365px]:py-2.5 min-[570px]:py-4 xl:py-5 font-inter">
      <h3 className="text-sm min-[365px]:text-base xl:text-lg font-semibold text-gray-900 mb-2 min-[365px]:mb-2.5 min-[570px]:mb-4">Risk Profile</h3>

      {/* Grid layout - 720px and above */}
      <div className="hidden min-[720px]:grid grid-cols-4 gap-3 xl:gap-4">
        {RISK_PROFILES.map((profile) => renderCard(profile))}
      </div>

      {/* Carousel layout - below 720px */}
      <div className="min-[720px]:hidden relative">
        <div className="overflow-hidden">
          <div
            className={`flex ${enableTransition ? 'transition-transform duration-300 ease-in-out' : ''}`}
            onTransitionEnd={handleTransitionEnd}
            style={{
              transform: `translateX(calc(-${activeIndex * cardWidth}% + ${cardOffset}%))`,
            }}
          >
            {extendedProfiles.map((profile, i) => (
              <div
                key={`${profile.id}-${i}`}
                className={`shrink-0 transition-opacity duration-300 ${isNarrow ? 'px-0' : 'px-1.5'}`}
                style={{
                  width: `${cardWidth}%`,
                  opacity: i === activeIndex ? 1 : 0.5,
                }}
                onClick={() => {
                  if (i !== activeIndex) {
                    setEnableTransition(true);
                    setActiveIndex(i);
                  }
                }}
              >
                {renderCard(profile)}
              </div>
            ))}
          </div>
        </div>

        {/* Left arrow */}
        <button
          onClick={goLeft}
          className={`absolute top-1/2 -translate-y-1/2 z-10 ${
            isNarrow
              ? '-left-1 p-1'
              : 'left-1 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 border border-gray-200 shadow-md hover:bg-gray-50 transition-colors'
          }`}
        >
          <svg className={`${isNarrow ? 'w-4 h-4 text-gray-400' : 'w-3.5 h-3.5 text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={goRight}
          className={`absolute top-1/2 -translate-y-1/2 z-10 ${
            isNarrow
              ? '-right-1 p-1'
              : 'right-1 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 border border-gray-200 shadow-md hover:bg-gray-50 transition-colors'
          }`}
        >
          <svg className={`${isNarrow ? 'w-4 h-4 text-gray-400' : 'w-3.5 h-3.5 text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dot indicators - below 720px */}
      <div className="min-[720px]:hidden flex justify-center gap-1.5 mt-3">
        {RISK_PROFILES.map((profile, i) => (
          <button
            key={profile.id}
            onClick={() => {
              setEnableTransition(true);
              setActiveIndex(i + 1);
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              realIndex === i ? 'bg-gray-700 w-4' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}