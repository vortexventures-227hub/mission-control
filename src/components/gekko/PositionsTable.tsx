'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Position } from './types';

interface PositionsTableProps {
  positions: Position[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const truncateQuestion = (q: string, maxLen = 40) => {
    return q.length > maxLen ? q.slice(0, maxLen) + '...' : q;
  };

  if (positions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Open Positions</h3>
        <div className="text-center text-gray-500 py-8">
          No open positions
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Open Positions ({positions.length})
      </h3>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left py-2 px-2">Market</th>
              <th className="text-left py-2 px-2">Outcome</th>
              <th className="text-right py-2 px-2">Entry</th>
              <th className="text-right py-2 px-2">Current</th>
              <th className="text-right py-2 px-2">Value</th>
              <th className="text-right py-2 px-2">P&L</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-2 text-gray-300">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      pos.side === 'long' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {truncateQuestion(pos.market_question)}
                  </div>
                </td>
                <td className="py-2 px-2 text-gray-400">{pos.outcome}</td>
                <td className="py-2 px-2 text-right text-gray-400">
                  {parseFloat(pos.entry_price).toFixed(2)}¢
                </td>
                <td className="py-2 px-2 text-right text-white">
                  {parseFloat(pos.current_price).toFixed(2)}¢
                </td>
                <td className="py-2 px-2 text-right text-gray-300">
                  {formatCurrency(pos.market_value)}
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {pos.is_profitable ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    )}
                    <span className={pos.is_profitable ? 'text-green-400' : 'text-red-400'}>
                      {formatPercent(pos.unrealized_pnl_pct)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
