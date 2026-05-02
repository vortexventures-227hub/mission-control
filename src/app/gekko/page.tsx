'use client';

import {
  useGekkoSocket,
  PipelineView,
  PortfolioPanel,
  PositionsTable,
  SignalFeed,
  TradeLog,
  ControlPanel,
} from '@/components/gekko';
import { Wifi, WifiOff } from 'lucide-react';

export default function GekkoPage() {
  const {
    connected,
    status,
    positions,
    signals,
    trades,
    portfolio,
    killSwitch,
    pause,
    resume,
    setStrategy,
    setMode,
    refresh,
  } = useGekkoSocket();

  return (
    <div className="min-h-screen bg-black text-white p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-green-400">🦎</span> GekkoEngine
          </h1>
          <p className="text-sm text-gray-500">Polymarket Trading Operations</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            connected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            {connected ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            {connected ? 'Connected' : 'Disconnected'}
          </div>
          
          {status?.mode === 'live' && (
            <div className="px-3 py-1.5 rounded-full bg-orange-900/30 text-orange-400 text-sm font-medium animate-pulse">
              LIVE TRADING
            </div>
          )}
        </div>
      </div>

      {/* Pipeline */}
      <div className="mb-6">
        <PipelineView status={status} />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Portfolio & Positions */}
        <div className="lg:col-span-2 space-y-6">
          <PortfolioPanel portfolio={portfolio} />
          <PositionsTable positions={positions} />
          <TradeLog trades={trades} />
        </div>

        {/* Right Column - Signals & Controls */}
        <div className="space-y-6">
          <ControlPanel
            status={status}
            onKillSwitch={killSwitch}
            onPause={pause}
            onResume={resume}
            onSetStrategy={setStrategy}
            onSetMode={setMode}
            onRefresh={refresh}
          />
          <SignalFeed signals={signals} />
        </div>
      </div>

      {/* Risk Alert Banner */}
      {status?.risk_level === 'critical' && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white py-3 px-4 flex items-center justify-center gap-3">
          <span className="font-bold">⚠️ CRITICAL RISK LEVEL</span>
          <span className="text-sm">Trading may be automatically halted</span>
        </div>
      )}
    </div>
  );
}
