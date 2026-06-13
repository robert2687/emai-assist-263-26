import React from 'react';

const REWRITE_MODES = ['formal', 'friendly', 'concise', 'grant-ready'];

interface RewriteModesProps {
  selectedRewriteMode: string;
  onRewriteModeChange: (value: string) => void;
  onApplyRewrite: () => void;
}

const RewriteModes: React.FC<RewriteModesProps> = ({
  selectedRewriteMode,
  onRewriteModeChange,
  onApplyRewrite,
}) => {
  return (
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
      <button
        onClick={onApplyRewrite}
        className="px-3 py-2 text-xs rounded bg-purple-700 hover:bg-purple-600"
      >
        Apply Rewrite
      </button>
    </div>
  );
};

export default RewriteModes;
