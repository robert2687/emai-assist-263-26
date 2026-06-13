import React from 'react';

const TEMPLATE_OPTIONS = [
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'meeting', label: 'Meeting Request' },
  { key: 'grant_update', label: 'Grant Update' },
];

interface TemplatesProps {
  onInsertTemplate: (templateKey: string) => void;
}

const Templates: React.FC<TemplatesProps> = ({ onInsertTemplate }) => {
  return (
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
  );
};

export default Templates;
