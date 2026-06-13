import React from 'react';

interface SummaryButtonProps {
  onInsertSummary: () => void;
}

const SummaryButton: React.FC<SummaryButtonProps> = ({ onInsertSummary }) => {
  return (
    <button
      onClick={onInsertSummary}
      className="px-3 py-2 text-xs rounded bg-blue-700 hover:bg-blue-600"
    >
      Insert Summary
    </button>
  );
};

export default SummaryButton;
