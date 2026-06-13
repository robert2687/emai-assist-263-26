import React from 'react';
import { ContextEngineOutput } from '../../types';
import SmartReplies from './SmartReplies';
import RewriteModes from './RewriteModes';
import Templates from './Templates';
import Signatures from './Signatures';
import SummaryButton from './SummaryButton';
import SubjectButton from './SubjectButton';
import ScheduleSendButton from './ScheduleSendButton';
import AddToCalendarButton from './AddToCalendarButton';

interface UIOverlayProps {
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
  signature: string;
  includeSignature: boolean;
  onSignatureChange: (value: string) => void;
  onToggleInclude: () => void;
  analysis: ContextEngineOutput | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({
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
  signature,
  includeSignature,
  onSignatureChange,
  onToggleInclude,
  analysis,
}) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-purple-300">Universal Composer Actions</h3>

      <div className="grid grid-cols-2 gap-2">
        <SummaryButton onInsertSummary={onInsertSummary} />
        <SubjectButton onGenerateSubject={onGenerateSubject} />
      </div>

      <SmartReplies smartReplies={smartReplies} onUseSmartReply={onUseSmartReply} />

      <RewriteModes
        selectedRewriteMode={selectedRewriteMode}
        onRewriteModeChange={onRewriteModeChange}
        onApplyRewrite={onApplyRewrite}
      />

      <Templates onInsertTemplate={onInsertTemplate} />

      <Signatures
        signature={signature}
        includeSignature={includeSignature}
        onSignatureChange={onSignatureChange}
        onToggleInclude={onToggleInclude}
      />

      <div className="grid grid-cols-2 gap-2 items-end">
        <ScheduleSendButton
          scheduleAt={scheduleAt}
          onScheduleAtChange={onScheduleAtChange}
          onScheduleSend={onScheduleSend}
        />
        <AddToCalendarButton onAddToCalendar={onAddToCalendar} />
      </div>

      <button
        onClick={onSendNow}
        className="w-full px-3 py-2 text-xs rounded bg-red-700 hover:bg-red-600"
      >
        Send Now
      </button>

      {analysis?.nextSteps?.length ? (
        <div className="text-xs text-gray-300 bg-gray-900/50 border border-gray-700 rounded p-2">
          <p className="text-gray-500 mb-1">Next Steps</p>
          <ul className="list-disc list-inside space-y-1">
            {analysis.nextSteps.map((step, i) => (
              <li key={`${step}-${i}`}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default UIOverlay;
