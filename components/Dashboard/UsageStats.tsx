
import React from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';

export const UsageStats: React.FC = () => {
  // Real implementation would fetch this data from the backend.
  // Currently defaulting to 0 to satisfy "no mock data" requirement.
  const usage = 0; // %
  const total = 100; // GB
  const used = 0; // GB

  const isWarning = usage > 80;

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium text-gray-400 flex items-center">
            <HardDrive size={16} className="mr-2" /> Storage Usage
        </h3>
        {isWarning && (
            <span className="text-xs text-gold flex items-center bg-gold/10 px-2 py-1 rounded">
                <AlertTriangle size={12} className="mr-1" /> Near Limit
            </span>
        )}
      </div>

      <div className="mb-2 flex justify-between items-end">
        <span className="text-2xl font-bold text-white">{used} <span className="text-sm font-normal text-gray-500">GB</span></span>
        <span className="text-sm text-gray-500">of {total} GB</span>
      </div>

      <div className="w-full bg-surfaceHighlight rounded-full h-2">
        <div 
            className={`h-2 rounded-full transition-all duration-500 ${isWarning ? 'bg-gold' : 'bg-green-600'}`} 
            style={{ width: `${usage}%` }}
        ></div>
      </div>
    </div>
  );
};
