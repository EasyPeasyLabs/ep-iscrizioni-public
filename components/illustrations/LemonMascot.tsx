import React from 'react';
import { MASCOT_IMAGES } from '../../assets/mascots';

interface LemonMascotProps {
  step: number;
  className?: string;
}

export const LemonMascot: React.FC<LemonMascotProps> = ({ step, className = '' }) => {
  // Retrieve the Base64 string for the current step.
  const imgSrc = MASCOT_IMAGES[step] || MASCOT_IMAGES[0];

  return (
    <div className={`relative flex items-center justify-center w-full h-full ${className}`}>
      {/* 
        Display the Lemon Mascot SVG directly. 
        It scales to fit the container while preserving aspect ratio.
      */}
      <div className="w-48 h-48 md:w-72 md:h-72 flex items-center justify-center transition-all duration-500">
        <img
          key={step} 
          src={imgSrc}
          alt={`Mascotte Step ${step}`}
          className="w-full h-full object-contain animate-in fade-in zoom-in duration-500 drop-shadow-xl"
        />
      </div>
    </div>
  );
};
