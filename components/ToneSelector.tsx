
import React from 'react';
import { Tone } from '../types';

interface ToneSelectorProps {
  tones: Tone[];
  selectedTones: Set<Tone>;
  onToneToggle: (tone: Tone) => void;
}

const ToneSelector: React.FC<ToneSelectorProps> = ({ tones, selectedTones, onToneToggle }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 text-gray-300">Fine-Tune Tone</h3>
      <div className="flex flex-wrap gap-2">
        {tones.map(tone => (
          <button
            key={tone}
            onClick={() => onToneToggle(tone)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200 border-2 ${
              selectedTones.has(tone)
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-500'
            }`}
          >
            {tone}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ToneSelector;
