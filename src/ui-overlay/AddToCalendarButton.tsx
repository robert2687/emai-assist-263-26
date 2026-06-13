import React from 'react';

interface AddToCalendarButtonProps {
  onAddToCalendar: () => void;
}

const AddToCalendarButton: React.FC<AddToCalendarButtonProps> = ({ onAddToCalendar }) => {
  return (
    <button
      onClick={onAddToCalendar}
      className="px-3 py-2 text-xs rounded bg-emerald-700 hover:bg-emerald-600"
    >
      Add to Calendar
    </button>
  );
};

export default AddToCalendarButton;
