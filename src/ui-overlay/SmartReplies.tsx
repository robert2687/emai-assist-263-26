import React from 'react';

interface SmartRepliesProps {
  smartReplies: string[];
  onUseSmartReply: (reply: string) => void;
}

const SmartReplies: React.FC<SmartRepliesProps> = ({ smartReplies, onUseSmartReply }) => {
  return (
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
  );
};

export default SmartReplies;
