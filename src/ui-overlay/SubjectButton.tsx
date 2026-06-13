import React from 'react';

interface SubjectButtonProps {
  onGenerateSubject: () => void;
}

const SubjectButton: React.FC<SubjectButtonProps> = ({ onGenerateSubject }) => {
  return (
    <button
      onClick={onGenerateSubject}
      className="px-3 py-2 text-xs rounded bg-blue-700 hover:bg-blue-600"
    >
      Generate Subject
    </button>
  );
};

export default SubjectButton;
