'use client';

import { Zap, TrendingUp, Target, Users, ArrowLeftRight, Calendar } from 'lucide-react';
import type { Signal } from './types';

interface SignalFeedProps {
  signals: Signal[];
}

const signalIcons: Record<string, React.ReactNode> = {
  high_prob_bond: <Target className="w-4 h-4 text-blue-400" />,
  info_asymmetry: <Zap className="w-4 h-4 text-purple-400" />,
  whale_activity: <Users className="w-4 h-4 text-green-400" />,
  cross_platform: <ArrowLeftRight className="w-4 h-4 text-orange-400" />,
  catalyst_event: <Calendar className="w-4 h-4 text-yellow-400" />,
  momentum: <TrendingUp className="w-4 h-4 text-cyan-400" />,
};

const strengthColors: Record<string, string> = {
  weak: 'text-gray-400 bg-gray-800',
  moderate: 'text-yellow-400 bg-yellow-900/30',
  strong: 'text-orange-400 bg-orange-900/30',
  very_strong: 'text-red-400 bg-red-900/30',
};

export function SignalFeed({ signals }: SignalFeedProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const truncateQuestion = (q: string, maxLen = 50) => {
    return q.length > maxLen ? q.slice(0, maxLen) + '...' : q;
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Signal Feed
        {signals.length > 0 && (
          <span className="ml-2 text-xs text-gray-600">({signals.length})</span>
        )}
      </h3>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {signals.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            Waiting for signals...
          </div>
        ) : (
          signals.map((signal) => (
            <div
              key={signal.id}
              className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {signalIcons[signal.type] || <Zap className="w-4 h-4 text-gray-400" />}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${strengthColors[signal.strength]}`}>
                    {signal.strength.toUpperCase()}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{formatTime(signal.timestamp)}</span>
              </div>
              
              <div className="mt-2">
                <div className="text-sm text-gray-300">
                  {truncateQuestion(signal.market.question)}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className={signal.direction === 'buy' ? 'text-green-400' : 'text-red-400'}>
                    {signal.direction.toUpperCase()}
                  </span>
                  <span className="text-gray-500">{signal.outcome}</span>
                  <span className="text-gray-500">@</span>
                  <span className="text-white">{(signal.entry_price * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>Edge: <span className="text-green-400">{signal.edge.toFixed(1)}%</span></span>
                  <span>Conf: {(signal.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
