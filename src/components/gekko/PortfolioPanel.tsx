'use client';

import { TrendingUp, TrendingDown, DollarSign, Percent, Activity } from 'lucide-react';
import type { PortfolioMetrics } from './types';

interface PortfolioPanelProps {
  portfolio: PortfolioMetrics | null;
}

export function PortfolioPanel({ portfolio }: PortfolioPanelProps) {
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

  const totalPnlPct = portfolio?.total_pnl_pct ?? 0;
  const dailyPnlPct = portfolio?.daily_pnl_pct ?? 0;

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Portfolio Overview</h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Total Value */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <DollarSign className="w-3 h-3" />
            Total Value
          </div>
          <div className="text-xl font-bold text-white">
            {portfolio ? formatCurrency(portfolio.total_value) : '--'}
          </div>
        </div>

        {/* Total P&L */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            {totalPnlPct >= 0 ? (
              <TrendingUp className="w-3 h-3 text-green-500" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-500" />
            )}
            Total P&L
          </div>
          <div className={`text-xl font-bold ${totalPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {portfolio ? formatPercent(totalPnlPct) : '--'}
          </div>
          <div className="text-xs text-gray-500">
            {portfolio ? formatCurrency(portfolio.total_pnl) : ''}
          </div>
        </div>

        {/* Daily P&L */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Activity className="w-3 h-3" />
            Daily P&L
          </div>
          <div className={`text-lg font-bold ${dailyPnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {portfolio ? formatPercent(dailyPnlPct) : '--'}
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Percent className="w-3 h-3" />
            Win Rate
          </div>
          <div className="text-lg font-bold text-white">
            {portfolio ? `${(portfolio.win_rate * 100).toFixed(1)}%` : '--'}
          </div>
        </div>
      </div>

      {/* Exposure Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Exposure</span>
          <span>{portfolio?.exposure.toFixed(1) ?? 0}%</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all ${
              (portfolio?.exposure ?? 0) > 60 ? 'bg-orange-500' :
              (portfolio?.exposure ?? 0) > 40 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${Math.min(portfolio?.exposure ?? 0, 100)}%` }}
          />
        </div>
      </div>

      {/* Position Count */}
      <div className="mt-3 flex justify-between text-xs">
        <span className="text-gray-500">Open Positions</span>
        <span className="text-white font-medium">{portfolio?.position_count ?? 0}</span>
      </div>
    </div>
  );
}
