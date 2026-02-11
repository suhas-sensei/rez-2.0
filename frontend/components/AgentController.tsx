'use client';

import { useState, useEffect } from 'react';
import type { RiskProfile } from './RiskProfileSelector';

interface AgentControllerProps {
  isRunning: boolean;
  isPaused?: boolean;
  onStartAgent: () => void;
  onStopAgent: () => void;
  onPauseAgent?: () => void;
  onResumeAgent?: () => void;
  selectedProfile: RiskProfile;
  selectedAssets: string[];
  onAssetsChange: (assets: string[]) => void;
  selectedInterval: string;
  onIntervalChange: (interval: string) => void;
  positionsCount?: number;
  onCloseAllPositions?: () => void;
  isClosingPositions?: boolean;
  onViewGrowth?: () => void;
}

const AVAILABLE_ASSETS = [
  { symbol: 'BTC', color: 'bg-orange-500', hoverColor: 'hover:bg-orange-100', textColor: 'text-orange-600', borderColor: 'border-orange-300' },
  { symbol: 'ETH', color: 'bg-indigo-500', hoverColor: 'hover:bg-indigo-100', textColor: 'text-indigo-600', borderColor: 'border-indigo-300' },
  { symbol: 'SOL', color: 'bg-purple-500', hoverColor: 'hover:bg-purple-100', textColor: 'text-purple-600', borderColor: 'border-purple-300' },
  { symbol: 'AVAX', color: 'bg-red-500', hoverColor: 'hover:bg-red-100', textColor: 'text-red-600', borderColor: 'border-red-300' },
  { symbol: 'DOGE', color: 'bg-amber-500', hoverColor: 'hover:bg-amber-100', textColor: 'text-amber-600', borderColor: 'border-amber-300' },
  { symbol: 'STRK', color: 'bg-pink-500', hoverColor: 'hover:bg-pink-100', textColor: 'text-pink-600', borderColor: 'border-pink-300' },
];
const INTERVALS = [
  { value: '5m', number: '5', unit: 'min' },
  { value: '15m', number: '15', unit: 'min' },
  { value: '1h', number: '1', unit: 'hour' },
  { value: '4h', number: '4', unit: 'hours' },
  { value: '1d', number: '1', unit: 'day' },
];

const PROFILE_NAMES: Record<RiskProfile, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  high: 'Aggressive',
  debug: 'Debug',
};

const PROFILE_COLORS: Record<RiskProfile, string> = {
  conservative: 'text-green-600',
  moderate: 'text-orange-600',
  high: 'text-red-600',
  debug: 'text-purple-600',
};

export default function AgentController({
  isRunning,
  isPaused = false,
  onStartAgent,
  onStopAgent,
  onPauseAgent,
  onResumeAgent,
  selectedProfile,
  selectedAssets,
  onAssetsChange,
  selectedInterval,
  onIntervalChange,
  positionsCount = 0,
  onCloseAllPositions,
  isClosingPositions = false,
}: AgentControllerProps) {

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Reset states when agent status changes
  useEffect(() => {
    if (isRunning) {
      setIsStarting(false);
      setIsResuming(false);
    }
    if (!isRunning) {
      setIsStopping(false);
    }
  }, [isRunning]);

  useEffect(() => {
    if (isPaused) setIsPausing(false);
    if (!isPaused) setIsResuming(false);
  }, [isPaused]);

  const handleStart = () => {
    setIsStarting(true);
    onStartAgent();
  };

  const handleStop = () => {
    setIsStopping(true);
    onStopAgent();
  };

  const handlePause = () => {
    setIsPausing(true);
    onPauseAgent?.();
  };

  const handleResume = () => {
    setIsResuming(true);
    onResumeAgent?.();
  };

  const toggleAsset = (symbol: string) => {
    if (isRunning) return;
    if (selectedAssets.includes(symbol)) {
      if (selectedAssets.length > 1) {
        onAssetsChange(selectedAssets.filter(a => a !== symbol));
      }
    } else {
      onAssetsChange([...selectedAssets, symbol]);
    }
  };

  const getIntervalLabel = (value: string) => {
    const interval = INTERVALS.find(i => i.value === value);
    return interval ? `${interval.number} ${interval.unit}` : value;
  };

  return (
    <div className="bg-white px-8 py-4 xl:py-5 font-inter">
      {/* Card with shadow */}
      <div className="bg-gray-50/80 rounded-2xl border border-gray-100 p-5 xl:p-6 shadow-sm">
        {/* Two column layout */}
        <div className="flex gap-8 xl:gap-12">
          {/* Left column - Trading Assets */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trading Assets</span>
            </div>
            <div className="inline-flex flex-wrap gap-2 bg-gray-50/80 rounded-2xl p-3 shadow-sm border border-gray-100">
              {AVAILABLE_ASSETS.map((asset) => {
                const isSelected = selectedAssets.includes(asset.symbol);
                return (
                  <button
                    key={asset.symbol}
                    onClick={() => toggleAsset(asset.symbol)}
                    disabled={isRunning}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                      isSelected
                        ? `${asset.color} text-white shadow-md`
                        : `bg-white ${asset.textColor} ${asset.hoverColor} border ${asset.borderColor} shadow-sm`
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {asset.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-gray-100 self-stretch" />

          {/* Right column - Trading Interval */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trading Interval</span>
            </div>
            <div className="inline-flex bg-gray-50/80 rounded-2xl p-2 shadow-sm border border-gray-100">
              {INTERVALS.map((interval) => {
                const isSelected = selectedInterval === interval.value;
                return (
                  <button
                    key={interval.value}
                    onClick={() => !isRunning && onIntervalChange(interval.value)}
                    disabled={isRunning}
                    className={`px-4 py-2.5 flex flex-col items-center min-w-[56px] rounded-lg transition-all ${
                      isSelected
                        ? 'bg-white shadow-sm border border-gray-200'
                        : 'hover:bg-gray-100'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`text-base font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-400'}`}>
                      {interval.number}
                    </span>
                    <span className={`text-xs ${isSelected ? 'text-gray-500' : 'text-gray-400'}`}>
                      {interval.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary line */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Profile: <span className={`${PROFILE_COLORS[selectedProfile]} font-medium`}>{PROFILE_NAMES[selectedProfile]}</span>
            <span className="mx-2 text-gray-300">|</span>
            Assets: <span className="text-gray-600 font-medium">{selectedAssets.join(', ')}</span>
            <span className="mx-2 text-gray-300">|</span>
            Interval: <span className="text-gray-600 font-medium">{getIntervalLabel(selectedInterval)}</span>
          </p>

          {/* Close All Positions Button */}
          {onCloseAllPositions && (
            <button
              onClick={onCloseAllPositions}
              disabled={isClosingPositions || positionsCount === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${positionsCount > 0 ? 'text-orange-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className={`text-sm font-medium ${positionsCount > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                {isClosingPositions ? 'Closing...' : 'Close All Positions'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Start/Stop/Pause Buttons */}
      {isRunning ? (
        <div className="flex gap-3 mt-4">
          {/* Pause/Resume Button */}
          <button
            onClick={isPaused ? handleResume : handlePause}
            disabled={isPausing || isResuming}
            className={`flex-1 py-3 xl:py-4 rounded-xl font-semibold text-sm xl:text-base transition-all ${
              isPausing || isResuming
                ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed text-white'
                : isPaused
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isPausing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Pausing Agent...
                </>
              ) : isResuming ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Resuming Agent...
                </>
              ) : isPaused ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Resume Agent
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pause Agent
                </>
              )}
            </span>
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStop}
            disabled={isStopping}
            className={`flex-1 py-3 xl:py-4 rounded-xl font-semibold text-sm xl:text-base transition-all text-white ${
              isStopping
                ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isStopping ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Stopping Agent...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Agent
                </>
              )}
            </span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleStart}
          disabled={isStarting}
          className={`w-full mt-4 py-3 xl:py-4 rounded-xl font-semibold text-sm xl:text-base transition-all text-white shadow-lg hover:shadow-xl ${
            isStarting
              ? 'bg-gradient-to-r from-gray-400 to-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {isStarting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Starting Agent...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Agent
              </>
            )}
          </span>
        </button>
      )}
    </div>
  );
}
