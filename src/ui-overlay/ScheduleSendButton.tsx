import React from 'react';

interface ScheduleSendButtonProps {
  scheduleAt: string;
  onScheduleAtChange: (value: string) => void;
  onScheduleSend: () => void;
}

const ScheduleSendButton: React.FC<ScheduleSendButtonProps> = ({
  scheduleAt,
  onScheduleAtChange,
  onScheduleSend,
}) => {
  return (
    <div className="grid grid-cols-1 gap-2">
      <input
        type="datetime-local"
        value={scheduleAt}
        onChange={(e) => onScheduleAtChange(e.target.value)}
        className="w-full px-2 py-2 text-xs rounded bg-gray-900 border border-gray-600"
      />
      <button
        onClick={onScheduleSend}
        className="px-3 py-2 text-xs rounded bg-amber-700 hover:bg-amber-600"
      >
        Schedule Send
      </button>
    </div>
  );
};

export default ScheduleSendButton;
