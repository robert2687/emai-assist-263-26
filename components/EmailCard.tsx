
import React, { useState, useCallback } from 'react';
import { EmailDraft } from '../types';
import { CopyIcon, CheckIcon } from './icons';

interface EmailCardProps {
  draft: EmailDraft;
  index: number;
}

const EmailCard: React.FC<EmailCardProps> = ({ draft, index }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const emailContent = `Subject: ${draft.subject}\n\n${draft.body}${draft.signature ? `\n\n${draft.signature}` : ''}`;
    navigator.clipboard.writeText(emailContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [draft]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-lg p-6 transition-all duration-300 hover:border-blue-500 hover:shadow-blue-500/10">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            Option {index + 1}
          </h3>
          {draft.sentiment && (
            <span className="px-2 py-1 bg-gray-700 text-xs text-gray-300 rounded-full border border-gray-600">
              {draft.sentiment}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors duration-200"
        >
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-gray-400 mb-1">Subject:</p>
          <p className="bg-gray-700/50 p-2 rounded-md">{draft.subject}</p>
          {draft.alternatives?.subject_lines && draft.alternatives.subject_lines.length > 0 && (
            <div className="mt-2 text-sm">
              <p className="text-gray-500 mb-1">Alternative Subjects:</p>
              <ul className="list-disc list-inside text-gray-400 space-y-1">
                {draft.alternatives.subject_lines.map((alt, i) => (
                  <li key={i}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-400 mb-1">Body:</p>
          <p className="bg-gray-700/50 p-3 rounded-md whitespace-pre-wrap text-gray-300 leading-relaxed">
            {draft.body}
            {draft.signature && (
              <>
                <br /><br />
                {draft.signature}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailCard;
