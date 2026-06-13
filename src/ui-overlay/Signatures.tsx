import React from 'react';

interface SignaturesProps {
  signature: string;
  includeSignature: boolean;
  onSignatureChange: (value: string) => void;
  onToggleInclude: () => void;
}

const Signatures: React.FC<SignaturesProps> = ({
  signature,
  includeSignature,
  onSignatureChange,
  onToggleInclude,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">Email Signature</p>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="mr-2"
            checked={includeSignature}
            onChange={onToggleInclude}
          />
          <span className="text-xs text-gray-400 font-medium">Include</span>
        </label>
      </div>
      <textarea
        value={signature}
        onChange={(e) => onSignatureChange(e.target.value)}
        placeholder="John Doe&#10;Software Engineer&#10;+1 234 567 890"
        disabled={!includeSignature}
        className="w-full h-20 p-2 text-xs rounded bg-gray-900 border border-gray-600 resize-none disabled:opacity-50"
      />
    </div>
  );
};

export default Signatures;
