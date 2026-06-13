import React from 'react';
import { ContextEngineOutput, ThreadData } from '../types';

interface ContextInsightsCardProps {
  providerName: string;
  composeMode: string;
  threadData: ThreadData | null;
  analysis: ContextEngineOutput | null;
  onRefresh: () => void;
}

const pills = (items: string[], fallback: string) => {
  if (!items?.length) {
    return <span className="text-xs text-gray-500">{fallback}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={`${item}-${i}`} className="px-2 py-1 text-xs rounded-full bg-gray-700 border border-gray-600 text-gray-200">
          {item}
        </span>
      ))}
    </div>
  );
};

const ContextInsightsCard: React.FC<ContextInsightsCardProps> = ({
  providerName,
  composeMode,
  threadData,
  analysis,
  onRefresh,
}) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-sm">
      <div className="flex justify-between items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-blue-300">Context Engine v2</h3>
        <button
          onClick={onRefresh}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-gray-900/60 border border-gray-700 rounded p-2">
          <p className="text-gray-500">Provider</p>
          <p className="text-gray-200 font-medium">{providerName || 'unknown'}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-700 rounded p-2">
          <p className="text-gray-500">Compose Mode</p>
          <p className="text-gray-200 font-medium">{composeMode || 'unknown'}</p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs">Thread subject</p>
          <p className="text-gray-200">{threadData?.subject || 'No subject detected'}</p>
        </div>

        <div>
          <p className="text-gray-500 text-xs">Summary</p>
          <p className="text-gray-200">{analysis?.summary || 'Run analysis to generate summary'}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-900/60 border border-gray-700 rounded p-2">
            <p className="text-gray-500">Language</p>
            <p className="text-gray-200">{analysis?.language || 'unknown'}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-700 rounded p-2">
            <p className="text-gray-500">Sentiment</p>
            <p className="text-gray-200">{analysis?.sentiment || 'n/a'}</p>
          </div>
          <div className="bg-gray-900/60 border border-gray-700 rounded p-2">
            <p className="text-gray-500">Grant</p>
            <p className="text-gray-200">{analysis?.grantClassification || 'n/a'}</p>
          </div>
        </div>

        <div>
          <p className="text-gray-500 text-xs mb-1">Tasks</p>
          {pills(analysis?.tasks || [], 'No task candidates')}
        </div>

        <div>
          <p className="text-gray-500 text-xs mb-1">Deadlines</p>
          {pills(analysis?.deadlines || [], 'No deadline candidates')}
        </div>
      </div>
    </div>
  );
};

export default ContextInsightsCard;
