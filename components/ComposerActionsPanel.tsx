import React from 'react';
import { ContextEngineOutput } from '../types';

interface ComposerActionsPanelProps {
  smartReplies: string[];
  selectedRewriteMode: string;
  onRewriteModeChange: (value: string) => void;
  onInsertSummary: () => void;
  onGenerateSubject: () => void;
  onUseSmartReply: (reply: string) => void;
  onApplyRewrite: () => void;
  onInsertTemplate: (templateKey: string) => void;
  onScheduleSend: () => void;
  onAddToCalendar: () => void;
  onSendNow: () => void;
  scheduleAt: string;
  onScheduleAtChange: (value: string) => void;
  analysis: ContextEngineOutput | null;
}

const TEMPLATE_OPTIONS = [
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'meeting', label: 'Meeting Request' },
  { key: 'grant_update', label: 'Grant Update' },
];

const REWRITE_MODES = ['formal', 'friendly', 'concise', 'grant-ready'];

const ComposerActionsPanel: React.FC<ComposerActionsPanelProps> = ({
  smartReplies,
  selectedRewriteMode,
  onRewriteModeChange,
  onInsertSummary,
  onGenerateSubject,
  onUseSmartReply,
  onApplyRewrite,
  onInsertTemplate,
  onScheduleSend,
  onAddToCalendar,
  onSendNow,
  scheduleAt,
  onScheduleAtChange,
  analysis,
}) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-purple-300">Universal Composer Actions</h3>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={onInsertSummary} className="px-3 py-2 text-xs rounded bg-blue-700 hover:bg-blue-600">Insert Summary</button>
        <button onClick={onGenerateSubject} className="px-3 py-2 text-xs rounded bg-blue-700 hover:bg-blue-600">Generate Subject</button>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Smart replies</p>
        <div className="flex flex-wrap gap-2">
          {smartReplies.map((reply, i) => (
            <button
              key={`${reply}-${i}`}
              onClick={() => onUseSmartReply(reply)}
              className="text-xs px-2 py-1 rounded-full border border-gray-600 bg-gray-700 hover:bg-gray-600"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-center">
        <select
          value={selectedRewriteMode}
          onChange={(e) => onRewriteModeChange(e.target.value)}
          className="w-full px-2 py-2 text-xs rounded bg-gray-900 border border-gray-600"
        >
          {REWRITE_MODES.map((mode) => (
            <option key={mode} value={mode}>{mode}</option>
          ))}
        </select>
        <button onClick={onApplyRewrite} className="px-3 py-2 text-xs rounded bg-purple-700 hover:bg-purple-600">Apply Rewrite</button>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Template library</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((template) => (
            <button
              key={template.key}
              onClick={() => onInsertTemplate(template.key)}
              className="text-xs px-2 py-1 rounded-full border border-gray-600 bg-gray-700 hover:bg-gray-600"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => onScheduleAtChange(e.target.value)}
          className="w-full px-2 py-2 text-xs rounded bg-gray-900 border border-gray-600"
        />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onScheduleSend} className="px-3 py-2 text-xs rounded bg-amber-700 hover:bg-amber-600">Schedule Send</button>
          <button onClick={onAddToCalendar} className="px-3 py-2 text-xs rounded bg-emerald-700 hover:bg-emerald-600">Add to Calendar</button>
        </div>
      </div>

      <button onClick={onSendNow} className="w-full px-3 py-2 text-xs rounded bg-red-700 hover:bg-red-600">Send Now</button>

      {analysis?.nextSteps?.length ? (
        <div className="text-xs text-gray-300 bg-gray-900/50 border border-gray-700 rounded p-2">
          <p className="text-gray-500 mb-1">Next Steps</p>
          <ul className="list-disc list-inside space-y-1">
            {analysis.nextSteps.map((step, i) => <li key={`${step}-${i}`}>{step}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default ComposerActionsPanel;
