'use client';

import { useState } from 'react';
import { Power, Pause, Play, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import type { EngineStatus } from './types';

interface ControlPanelProps {
  status: EngineStatus | null;
  onKillSwitch: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetStrategy: (strategy: string, enabled: boolean) => void;
  onSetMode: (mode: 'paper' | 'live') => void;
  onRefresh: () => void;
}

export function ControlPanel({
  status,
  onKillSwitch,
  onPause,
  onResume,
  onSetStrategy,
  onSetMode,
  onRefresh,
}: ControlPanelProps) {
  const [showConfirmKill, setShowConfirmKill] = useState(false);
  const [showModeConfirm, setShowModeConfirm] = useState(false);

  const strategies = [
    { id: 'high_prob_bonds', name: 'High Prob Bonds', desc: '95-99% outcomes' },
    { id: 'info_asymmetry', name: 'Info Asymmetry', desc: 'AI vs Market' },
    { id: 'whale_mirroring', name: 'Whale Mirroring', desc: 'Track whales' },
    { id: 'cross_platform_arb', name: 'Cross-Platform', desc: 'Arb gaps' },
    { id: 'catalyst_events', name: 'Catalyst Events', desc: 'Event-driven' },
  ];

  const handleKillSwitch = () => {
    if (showConfirmKill) {
      onKillSwitch();
      setShowConfirmKill(false);
    } else {
      setShowConfirmKill(true);
      setTimeout(() => setShowConfirmKill(false), 5000);
    }
  };

  const handleModeSwitch = () => {
    if (status?.mode === 'paper') {
      if (showModeConfirm) {
        onSetMode('live');
        setShowModeConfirm(false);
      } else {
        setShowModeConfirm(true);
        setTimeout(() => setShowModeConfirm(false), 5000);
      }
    } else {
      onSetMode('paper');
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Control Panel</h3>
        <button
          onClick={onRefresh}
          className="p-1.5 hover:bg-gray-800 rounded transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Main Controls */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Kill Switch */}
        <button
          onClick={handleKillSwitch}
          className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
            showConfirmKill
              ? 'bg-red-600 hover:bg-red-700 animate-pulse'
              : 'bg-red-900/50 hover:bg-red-900/70'
          }`}
        >
          <Power className="w-5 h-5 text-red-400" />
          <span className="text-xs text-red-400 mt-1">
            {showConfirmKill ? 'CONFIRM' : 'KILL'}
          </span>
        </button>

        {/* Pause/Resume */}
        {status?.state === 'paused' ? (
          <button
            onClick={onResume}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-900/50 hover:bg-green-900/70 transition-colors"
          >
            <Play className="w-5 h-5 text-green-400" />
            <span className="text-xs text-green-400 mt-1">RESUME</span>
          </button>
        ) : (
          <button
            onClick={onPause}
            className="flex flex-col items-center justify-center p-3 rounded-lg bg-yellow-900/50 hover:bg-yellow-900/70 transition-colors"
            disabled={status?.state === 'killed'}
          >
            <Pause className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-yellow-400 mt-1">PAUSE</span>
          </button>
        )}

        {/* Mode Toggle */}
        <button
          onClick={handleModeSwitch}
          className={`flex flex-col items-center justify-center p-3 rounded-lg transition-colors ${
            showModeConfirm
              ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
              : status?.mode === 'live'
              ? 'bg-orange-900/50 hover:bg-orange-900/70'
              : 'bg-blue-900/50 hover:bg-blue-900/70'
          }`}
        >
          {status?.mode === 'live' ? (
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          ) : (
            <Settings className="w-5 h-5 text-blue-400" />
          )}
          <span className={`text-xs mt-1 ${
            showModeConfirm ? 'text-orange-400' :
            status?.mode === 'live' ? 'text-orange-400' : 'text-blue-400'
          }`}>
            {showModeConfirm ? 'GO LIVE?' : status?.mode?.toUpperCase() || 'PAPER'}
          </span>
        </button>
      </div>

      {/* Strategy Toggles */}
      <div className="border-t border-gray-800 pt-4">
        <h4 className="text-xs font-medium text-gray-500 mb-3">Strategies</h4>
        <div className="space-y-2">
          {strategies.map((strategy) => {
            const isEnabled = status?.strategies?.[strategy.id] ?? false;
            return (
              <div
                key={strategy.id}
                className="flex items-center justify-between p-2 bg-gray-800/30 rounded"
              >
                <div>
                  <div className="text-sm text-gray-300">{strategy.name}</div>
                  <div className="text-xs text-gray-500">{strategy.desc}</div>
                </div>
                <button
                  onClick={() => onSetStrategy(strategy.id, !isEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isEnabled ? 'bg-green-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
