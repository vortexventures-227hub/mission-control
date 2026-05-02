'use client';

import { CheckCircle, Circle, AlertCircle, XCircle } from 'lucide-react';
import type { EngineStatus } from './types';

interface PipelineViewProps {
  status: EngineStatus | null;
}

const stages = [
  { id: 'intel', name: 'Intel', description: 'Market scanning' },
  { id: 'signal', name: 'Signal', description: 'Pattern detection' },
  { id: 'validate', name: 'Validate', description: 'Risk check' },
  { id: 'execute', name: 'Execute', description: 'Order placement' },
  { id: 'manage', name: 'Manage', description: 'Position tracking' },
];

export function PipelineView({ status }: PipelineViewProps) {
  const getStageStatus = (stageId: string) => {
    if (!status) return 'inactive';
    if (status.state === 'killed') return 'killed';
    if (status.state === 'paused') return 'paused';
    return 'active';
  };

  const getStageIcon = (stageStatus: string) => {
    switch (stageStatus) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'paused':
        return <Circle className="w-5 h-5 text-yellow-500" />;
      case 'killed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Trading Pipeline</h3>
      
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center">
              {getStageIcon(getStageStatus(stage.id))}
              <span className="text-xs text-gray-400 mt-1">{stage.name}</span>
              <span className="text-[10px] text-gray-600">{stage.description}</span>
            </div>
            
            {index < stages.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${
                status?.state === 'running' ? 'bg-green-500/50' :
                status?.state === 'paused' ? 'bg-yellow-500/50' :
                'bg-gray-700'
              }`} />
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">State:</span>
          <span className={`font-medium ${
            status?.state === 'running' ? 'text-green-400' :
            status?.state === 'paused' ? 'text-yellow-400' :
            status?.state === 'killed' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {status?.state?.toUpperCase() || 'OFFLINE'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Mode:</span>
          <span className={`font-medium ${
            status?.mode === 'live' ? 'text-orange-400' : 'text-blue-400'
          }`}>
            {status?.mode?.toUpperCase() || 'PAPER'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Risk:</span>
          <span className={`font-medium ${
            status?.risk_level === 'low' ? 'text-green-400' :
            status?.risk_level === 'elevated' ? 'text-yellow-400' :
            status?.risk_level === 'high' ? 'text-orange-400' :
            status?.risk_level === 'critical' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {status?.risk_level?.toUpperCase() || 'UNKNOWN'}
          </span>
        </div>
      </div>
    </div>
  );
}
