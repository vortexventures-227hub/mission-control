'use client';

import { ArrowUpRight, ArrowDownRight, Check, X, Clock } from 'lucide-react';
import type { Trade } from './types';

interface TradeLogProps {
  trades: Trade[];
}

export function TradeLog({ trades }: TradeLogProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const truncateQuestion = (q: string, maxLen = 35) => {
    return q.length > maxLen ? q.slice(0, maxLen) + '...' : q;
  };

  const statusIcons: Record<string, React.ReactNode> = {
    filled: <Check className="w-3 h-3 text-green-500" />,
    rejected: <X className="w-3 h-3 text-red-500" />,
    pending: <Clock className="w-3 h-3 text-yellow-500" />,
    cancelled: <X className="w-3 h-3 text-gray-500" />,
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">
        Trade Log
        {trades.length > 0 && (
          <span className="ml-2 text-xs text-gray-600">({trades.length})</span>
        )}
      </h3>
      
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        {trades.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No trades yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Market</th>
                <th className="text-right py-2 px-2">Size</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-center py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-2 text-gray-500 text-xs whitespace-nowrap">
                    {formatTime(trade.timestamp)}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      trade.signal_type === 'high_prob_bond' ? 'bg-blue-900/30 text-blue-400' :
                      trade.signal_type === 'info_asymmetry' ? 'bg-purple-900/30 text-purple-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {trade.signal_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-300">
                    <div className="flex items-center gap-1">
                      {trade.direction === 'buy' ? (
                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                      )}
                      {truncateQuestion(trade.market_question)}
                    </div>
                    <div className="text-xs text-gray-500">{trade.outcome}</div>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-300">
                    {formatCurrency(trade.size)}
                  </td>
                  <td className="py-2 px-2 text-right text-white">
                    {parseFloat(trade.entry_price).toFixed(2)}¢
                  </td>
                  <td className="py-2 px-2 text-center">
                    {statusIcons[trade.status] || trade.status}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {trade.pnl ? (
                      <span className={parseFloat(trade.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {formatCurrency(trade.pnl)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
