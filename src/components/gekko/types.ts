// GekkoEngine TypeScript Types

export interface Market {
  condition_id: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcome_prices: Record<string, number>;
  volume_24h: number;
  liquidity: number;
  end_date: string | null;
  status: 'active' | 'resolved' | 'paused';
  category: string;
  tags: string[];
  spread: number;
  hours_to_resolution: number | null;
}

export interface Signal {
  id: string;
  type: 'high_prob_bond' | 'info_asymmetry' | 'whale_activity' | 'cross_platform' | 'catalyst_event' | 'momentum';
  market: Market;
  outcome: string;
  direction: 'buy' | 'sell';
  entry_price: number;
  target_price: number;
  confidence: number;
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  edge: number;
  expected_return: number;
  reasoning: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface Position {
  id: string;
  condition_id: string;
  outcome: string;
  market_question: string;
  entry_price: string;
  current_price: string;
  size: string;
  cost_basis: string;
  market_value: string;
  side: 'long' | 'short';
  unrealized_pnl: string;
  unrealized_pnl_pct: number;
  is_profitable: boolean;
  opened_at: string;
  updated_at: string;
  stop_loss: string | null;
  take_profit: string | null;
  orders: string[];
}

export interface Trade {
  id: string;
  timestamp: string;
  signal_type: string;
  market_question: string;
  outcome: string;
  direction: string;
  size: string;
  entry_price: string;
  status: string;
  pnl: string | null;
}

export interface PortfolioMetrics {
  total_value: string;
  cash_balance: string;
  positions_value: string;
  total_pnl: string;
  total_pnl_pct: number;
  daily_pnl: string;
  daily_pnl_pct: number;
  win_rate: number;
  exposure: number;
  position_count: number;
}

export interface RiskAlert {
  id: string;
  level: 'low' | 'elevated' | 'high' | 'critical';
  message: string;
  timestamp: string;
  position_id: string | null;
  action_taken: string | null;
}

export interface EngineStatus {
  state: 'running' | 'paused' | 'killed';
  mode: 'paper' | 'live';
  risk_level: 'low' | 'elevated' | 'high' | 'critical';
  is_trading_allowed: boolean;
  portfolio: PortfolioMetrics;
  strategies: Record<string, boolean>;
  config: {
    min_signal_strength: string;
    auto_execute: boolean;
  };
}

export interface WebSocketMessage {
  type: 'signal' | 'trade' | 'position' | 'alert' | 'status' | 'portfolio' | 'positions' | 'signals' | 'trades' | 'control' | 'error';
  data?: unknown;
  action?: string;
  error?: string;
}
