'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { EngineStatus, Position, Signal, Trade, RiskAlert, PortfolioMetrics, WebSocketMessage } from './types';

const WS_URL = process.env.NEXT_PUBLIC_GEKKO_WS_URL || 'ws://localhost:8765';

interface GekkoState {
  connected: boolean;
  status: EngineStatus | null;
  positions: Position[];
  signals: Signal[];
  trades: Trade[];
  alerts: RiskAlert[];
  portfolio: PortfolioMetrics | null;
}

export function useGekkoSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [state, setState] = useState<GekkoState>({
    connected: false,
    status: null,
    positions: [],
    signals: [],
    trades: [],
    alerts: [],
    portfolio: null,
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log('[Gekko] Connected');
        setState(s => ({ ...s, connected: true }));
        
        // Request initial state
        ws.send(JSON.stringify({ command: 'status' }));
        ws.send(JSON.stringify({ command: 'portfolio' }));
        ws.send(JSON.stringify({ command: 'positions' }));
        ws.send(JSON.stringify({ command: 'trades' }));
      };
      
      ws.onclose = () => {
        console.log('[Gekko] Disconnected');
        setState(s => ({ ...s, connected: false }));
        
        // Reconnect after delay
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('[Gekko] WebSocket error:', error);
      };
      
      ws.onmessage = (event) => {
        try {
          const msg: WebSocketMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[Gekko] Failed to parse message:', e);
        }
      };
      
      wsRef.current = ws;
    } catch (e) {
      console.error('[Gekko] Connection failed:', e);
    }
  }, []);

  const handleMessage = (msg: WebSocketMessage) => {
    switch (msg.type) {
      case 'status':
        setState(s => ({ ...s, status: msg.data as EngineStatus }));
        break;
        
      case 'portfolio':
        setState(s => ({ ...s, portfolio: msg.data as PortfolioMetrics }));
        break;
        
      case 'positions':
        setState(s => ({ ...s, positions: msg.data as Position[] }));
        break;
        
      case 'position':
        setState(s => {
          const pos = msg.data as Position;
          const existing = s.positions.findIndex(p => p.id === pos.id);
          const newPositions = [...s.positions];
          if (existing >= 0) {
            newPositions[existing] = pos;
          } else {
            newPositions.push(pos);
          }
          return { ...s, positions: newPositions };
        });
        break;
        
      case 'signals':
        setState(s => ({ ...s, signals: msg.data as Signal[] }));
        break;
        
      case 'signal':
        setState(s => ({
          ...s,
          signals: [msg.data as Signal, ...s.signals].slice(0, 50),
        }));
        break;
        
      case 'trades':
        setState(s => ({ ...s, trades: msg.data as Trade[] }));
        break;
        
      case 'trade':
        setState(s => ({
          ...s,
          trades: [msg.data as Trade, ...s.trades].slice(0, 100),
        }));
        break;
        
      case 'alert':
        setState(s => ({
          ...s,
          alerts: [msg.data as RiskAlert, ...s.alerts].slice(0, 50),
        }));
        break;
        
      case 'control':
        // Refresh status after control action
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ command: 'status' }));
        }
        break;
    }
  };

  const sendCommand = useCallback((command: string, params?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, ...params }));
    }
  }, []);

  // Control functions
  const killSwitch = useCallback(() => sendCommand('kill'), [sendCommand]);
  const pause = useCallback(() => sendCommand('pause'), [sendCommand]);
  const resume = useCallback(() => sendCommand('resume'), [sendCommand]);
  const setStrategy = useCallback((strategy: string, enabled: boolean) => 
    sendCommand('strategy', { strategy, enabled }), [sendCommand]);
  const setMode = useCallback((mode: 'paper' | 'live') => 
    sendCommand('mode', { mode }), [sendCommand]);
  const refresh = useCallback(() => {
    sendCommand('status');
    sendCommand('portfolio');
    sendCommand('positions');
    sendCommand('trades');
  }, [sendCommand]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    ...state,
    killSwitch,
    pause,
    resume,
    setStrategy,
    setMode,
    refresh,
  };
}
