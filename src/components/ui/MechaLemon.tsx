import React from 'react';

interface MechaLemonProps {
  className?: string;
  completionStep?: number;
}

export const MechaLemon: React.FC<MechaLemonProps> = ({ 
  className = '', 
  completionStep = 0
}) => {
  // Ensure frame is between 0 and 6
  const frame = Math.max(0, Math.min(6, completionStep));

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <img 
        src={`/${frame}.png`} 
        alt={`MechaLemon Mascot Frame ${frame}`} 
        className="w-full h-full object-contain mix-blend-multiply scale-[1.4] transition-all duration-300"
      />
    </div>
  );
};
