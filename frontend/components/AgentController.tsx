'use client';

import { useState } from 'react';
import type { RiskProfile } from './RiskProfileSelector';

interface AgentControllerProps {
  isRunning: boolean;
  onStartAgent: () => void;
  onStopAgent: () => void;
  selectedProfile: RiskProfile;
  selectedAssets: string[];
  onAssetsChange: (assets: string[]) => void;
  selectedInterval: string;
  onIntervalChange: (interval: string) => void;
  positionsCount?: number;
  onCloseAllPositions?: () => void;
  isClosingPositions?: boolean;
}

const AVAILABLE_ASSETS = ['BTC', 'ETH', 'SOL', 'AVAX', 'DOGE', 'STRK'];
const INTERVALS = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '1d', label: '1 day' },
];

export default function AgentController({
  isRunning,
  onStartAgent,
  onStopAgent,
  selectedProfile,
  selectedAssets,
  onAssetsChange,
  selectedInterval,
  onIntervalChange,
  positionsCount = 0,
  onCloseAllPositions,
  isClosingPositions = false,
}: AgentControllerProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleAsset = (asset: string) => {
    if (isRunning) return;
    if (selectedAssets.includes(asset)) {
      if (selectedAssets.length > 1) {
        onAssetsChange(selectedAssets.filter(a => a !== asset));
      }
    } else {
      onAssetsChange([...selectedAssets, asset]);
    }
  };

  const profileColors = {
    conservative: 'text-green-600',
    moderate: 'text-orange-600',
    high: 'text-red-600',
    debug: 'text-purple-600',
  };

  const profileLabels = {
    conservative: 'Conservative',
    moderate: 'Moderate',
    high: 'Aggressive',
    debug: 'Debug',
  };

  return (
    <div className="bg-white border-t border-gray-200 font-inter">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm xl:text-base font-semibold text-gray-900">Agent Configuration</h3>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Assets Selection */}
          <div>
            <label className="text-xs xl:text-sm font-medium text-gray-600 mb-2 block">Trading Assets</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ASSETS.map((asset) => {
                const isSelected = selectedAssets.includes(asset);
                return (
                  <button
                    key={asset}
                    onClick={() => toggleAsset(asset)}
                    disabled={isRunning}
                    className={`px-3 py-1.5 text-xs xl:text-sm font-medium rounded-full border transition-all ${
                      isSelected
                        ? 'bg-orange-500 text-white border-orange-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {asset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interval Selection */}
          <div>
            <label className="text-xs xl:text-sm font-medium text-gray-600 mb-2 block">Trading Interval</label>
            <div className="flex flex-wrap gap-2">
              {INTERVALS.map((interval) => {
                const isSelected = selectedInterval === interval.value;
                return (
                  <button
                    key={interval.value}
                    onClick={() => !isRunning && onIntervalChange(interval.value)}
                    disabled={isRunning}
                    className={`px-3 py-1.5 text-xs xl:text-sm font-medium rounded-full border transition-all ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                    } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {interval.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Config Summary */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs xl:text-sm text-gray-600">
              <span className="font-medium">Profile:</span>{' '}
              <span className={profileColors[selectedProfile]}>{profileLabels[selectedProfile]}</span>
              {' | '}
              <span className="font-medium">Assets:</span>{' '}
              {selectedAssets.join(', ')}
              {' | '}
              <span className="font-medium">Interval:</span>{' '}
              {INTERVALS.find(i => i.value === selectedInterval)?.label}
            </p>
          </div>

          {/* Close All Positions Button */}
          {onCloseAllPositions && (
            <button
              onClick={onCloseAllPositions}
              disabled={isClosingPositions || positionsCount === 0}
              className="w-full py-3 xl:py-4 rounded-lg font-semibold text-sm xl:text-base transition-all bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {isClosingPositions ? 'Closing Positions...' : `Close All Positions${positionsCount > 0 ? ` (${positionsCount})` : ''}`}
              </span>
            </button>
          )}

          {/* Start/Stop Button */}
          <button
            onClick={isRunning ? onStopAgent : onStartAgent}
            className={`w-full py-3 xl:py-4 rounded-lg font-semibold text-sm xl:text-base transition-all ${
              isRunning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop Agent
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Agent
              </span>
            )}
          </button>

         
        </div>
      )}
    </div>
  );
}
