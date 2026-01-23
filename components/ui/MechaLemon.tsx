
import React from 'react';

interface MechaLemonProps extends React.SVGProps<SVGSVGElement> {
  completionStep: number; // 0 to totalSteps
  totalSteps?: number;
}

export const MechaLemon: React.FC<MechaLemonProps> = ({ 
  completionStep, 
  totalSteps = 5, 
  className = '', 
  ...props 
}) => {
  const isFinished = completionStep >= totalSteps; // Step 8
  const isSuperFinished = completionStep > totalSteps; // Step 9 (Success)

  // CLOCKWISE ROTATION from Outer Edge Shoulder
  // Pivot Point: (70, 280) - Left outer edge of body
  // 0 fields = 80deg (Arm hanging vertically down along the body side)
  // Max fields = 320deg (Arm up at hat brim)
  const startAngle = 80;
  const endAngle = 320; 
  
  // Ensure progress doesn't exceed 1 (unless super finished)
  const progress = Math.min(Math.max(completionStep / totalSteps, 0), 1);
  
  const currentRotation = startAngle + (progress * (endAngle - startAngle));

  // Hand rotation adjusts to keep palm relative to the brim
  // Counter-rotation to keep hand vertical-ish + slight outward tilt (-20)
  const handRotation = -currentRotation - 20;

  // Hat Animation Logic
  const hatBaseX = 105;
  const hatBaseY = 85; // Low position to fit head
  const hatBaseRot = -5;

  // Animated offsets
  let hatOffsetX = 0;
  let hatOffsetY = 0;
  let hatOffsetRot = 0;
  
  // Hand follow logic for Step 6/9 (Success)
  let handFollowX = 0;
  let handFollowY = 0;

  if (isSuperFinished) {
    // Grand Finale: Move hat left and rotate to reveal secret
    hatOffsetX = -100; 
    hatOffsetY = 15; 
    hatOffsetRot = -55; 
    
    // Hand follows hat
    handFollowX = -70; 
    handFollowY = -25;

  } else if (isFinished) {
    // Ready state: Privacy Check
    hatOffsetX = -20;
    hatOffsetY = 15; 
    hatOffsetRot = -25; 
  }

  return (
    <svg 
      viewBox="0 0 420 520" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`drop-shadow-2xl transition-transform duration-300 overflow-visible ${className}`}
      {...props}
    >
      <defs>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
          <feOffset dx="0" dy="5" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="offsetblur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <filter id="blushBlur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>

        <radialGradient id="lemonBodyGrad" cx="40%" cy="35%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stopColor="#FFE55C" />
          <stop offset="80%" stopColor="#F7DA25" />
          <stop offset="100%" stopColor="#EAC006" />
        </radialGradient>

        <linearGradient id="hatBlueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#053085" />
          <stop offset="50%" stopColor="#012169" />
          <stop offset="100%" stopColor="#001545" />
        </linearGradient>
        
        <linearGradient id="hatBrimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
           <stop offset="0%" stopColor="#053085" />
           <stop offset="50%" stopColor="#012169" />
           <stop offset="100%" stopColor="#001545" />
        </linearGradient>

        <linearGradient id="limbGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F7DA25" />
          <stop offset="100%" stopColor="#EAC006" />
        </linearGradient>
      </defs>

      {/* Left Leg (Static) */}
      <g transform="translate(130, 460)">
         <path d="M10,0 Q5,25 10,50" stroke="url(#limbGrad)" strokeWidth="14" strokeLinecap="round" fill="none" />
         <g filter="url(#softShadow)">
            <path d="M-18,55 C-18,45 40,45 40,65 C40,85 -5,85 -18,85 C-28,85 -28,65 -18,55 Z" fill="#5D9B9B" stroke="#2F6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M-15,82 L35,82" stroke="white" strokeWidth="6" opacity="0.4" strokeLinecap="round" />
            <circle cx="-5" cy="65" r="4" fill="white" opacity="0.8"/>
            <path d="M-5,65 L15,65 M5,65 L20,55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
         </g>
      </g>

      {/* Right Leg (Static) */}
      <g transform="translate(230, 460)">
         <path d="M10,0 Q15,25 10,50" stroke="url(#limbGrad)" strokeWidth="14" strokeLinecap="round" fill="none" />
         <g filter="url(#softShadow)">
            <path d="M-18,55 C-18,45 40,45 40,65 C40,85 -5,85 -18,85 C-28,85 -28,65 -18,55 Z" fill="#5D9B9B" stroke="#2F6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M-15,82 L35,82" stroke="white" strokeWidth="6" opacity="0.4" strokeLinecap="round" />
            <circle cx="-5" cy="65" r="4" fill="white" opacity="0.8"/>
            <path d="M-5,65 L15,65 M5,65 L20,55" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
         </g>
      </g>

      {/* Left Arm (Static) */}
      <g transform="translate(290, 280) rotate(-20)">
        <path d="M0,0 Q30,30 25,60" stroke="url(#limbGrad)" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <g transform="translate(20, 60) rotate(10)" filter="url(#softShadow)">
            <path d="M0,-5 C-15,0 -15,35 5,40 C25,45 40,30 35,10 C32,-5 10,-10 0,-5 Z" fill="white" stroke="#E0E0E0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        </g>
      </g>

      {/* Body (Lemon) */}
      <g filter="url(#softShadow)" transform="translate(0, 80)">
          <path d="M183,65 C100,65 63,150 63,220 C63,310 110,375 183,375 C256,375 303,310 303,220 C303,150 266,65 183,65 Z" fill="url(#lemonBodyGrad)"/>
          <ellipse cx="130" cy="130" rx="40" ry="25" transform="rotate(-45, 130, 130)" fill="white" opacity="0.4" filter="url(#blushBlur)" />
          <g fill="#FFF" opacity="0.4">
            <circle cx="150" cy="150" r="1.5" />
            <circle cx="220" cy="180" r="1.5" />
            <circle cx="120" cy="250" r="1.5" />
            <circle cx="250" cy="220" r="1.5" />
             <circle cx="190" cy="320" r="1.5" />
             <circle cx="90" cy="200" r="1.5" />
          </g>
          <path d="M163,373 Q183,395 203,373" fill="#EAC006" stroke="#D4B815" strokeWidth="3" strokeLinecap="round"/>
      </g>

      {/* Face */}
      <g transform="translate(183, 300)">
        <g transform="translate(-45, -20)">
            <ellipse cx="0" cy="0" rx="18" ry="24" fill="#1A1A1A" />
            <circle cx="6" cy="-8" r="8" fill="white" /> 
            <circle cx="-6" cy="10" r="4" fill="white" opacity="0.6"/>
        </g>
        <g transform="translate(45, -20)">
            <ellipse cx="0" cy="0" rx="18" ry="24" fill="#1A1A1A" />
            <circle cx="6" cy="-8" r="8" fill="white" /> 
            <circle cx="-6" cy="10" r="4" fill="white" opacity="0.6"/>
        </g>
        <circle cx="-70" cy="15" r="16" fill="#FF8888" opacity="0.5" filter="url(#blushBlur)" />
        <circle cx="70" cy="15" r="16" fill="#FF8888" opacity="0.5" filter="url(#blushBlur)" />
        <path d="M-25,30 Q0,55 25,30" fill="#5A1A1A" stroke="#5A1A1A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-12,42 Q0,48 12,42" fill="none" stroke="#D14A4A" strokeWidth="4" strokeLinecap="round" /> 
      </g>

      {/* SECRET: Stem and Leaf (Adjusted for high visibility) */}
      <g 
        transform={`translate(183, 152) scale(${isSuperFinished ? 1 : 0})`}
        style={{ transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      > 
        {/* Stem: Significantly taller and thicker base */}
        <path d="M-7,0 L-5,-65 Q0,-72 5,-65 L7,0 Q0,8 -7,0 Z" fill="#33691E" stroke="#1B3810" strokeWidth="1" />
        
        {/* Leaf: Enlarged (scale 1.3) and rotated for visibility */}
        <g transform="translate(0, -60) rotate(-45) scale(1.3)">
             {/* Leaf Shape - Scaled up */}
             <path d="M0,0 Q45,-55 95,0 Q45,55 0,0 Z" fill="#76FF03" stroke="#33691E" strokeWidth="2" />
             <path d="M0,0 Q47,0 90,0" stroke="#33691E" strokeWidth="1" fill="none" opacity="0.5" />
        </g>
      </g>

      {/* Top Hat */}
      <g 
        transform={`translate(${hatBaseX + hatOffsetX}, ${hatBaseY + hatOffsetY}) rotate(${hatBaseRot + hatOffsetRot}, 75, 85)`}
        style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
         <ellipse cx="75" cy="85" rx="135" ry="35" fill="url(#hatBrimGrad)" />
         <path d="M-10,85 L-10,-35 Q-10,-50 75,-50 Q160,-50 160,-35 L160,85 Q160,100 75,100 Q-10,100 -10,85" fill="url(#hatBlueGrad)" />
         <mask id="hatMask">
            <path d="M-9,85 L-9,-35 Q-9,-49 75,-49 Q159,-49 159,-35 L159,85 Q159,99 75,99 Q-9,99 -9,85" fill="white"/>
         </mask>
         <g mask="url(#hatMask)" opacity="0.95">
            <path d="M-10,-35 Q75,25 160,85" stroke="white" strokeWidth="16" strokeLinecap="round" fill="none"/>
            <path d="M160,-35 Q75,25 -10,85" stroke="white" strokeWidth="16" strokeLinecap="round" fill="none"/>
            <path d="M-10,-35 Q75,25 160,85" stroke="#C8102E" strokeWidth="7" strokeLinecap="round" fill="none"/>
            <path d="M160,-35 Q75,25 -10,85" stroke="#C8102E" strokeWidth="7" strokeLinecap="round" fill="none"/>
            <path d="M-20,25 Q75,40 170,25" stroke="white" strokeWidth="24" strokeLinecap="round" fill="none"/>
            <path d="M-20,25 Q75,40 170,25" stroke="#C8102E" strokeWidth="14" strokeLinecap="round" fill="none"/>
            <path d="M75,-55 L75,110" stroke="white" strokeWidth="24" strokeLinecap="round"/>
            <path d="M75,-55 L75,110" stroke="#C8102E" strokeWidth="14" strokeLinecap="round"/>
         </g>
         <path d="M-10,85 L-10,-35 Q-10,-50 75,-50 Q160,-50 160,-35 L160,85 Q160,100 75,100 Q-10,100 -10,85" fill="url(#hatBlueGrad)" opacity="0.2" style={{mixBlendMode: 'multiply'}}/>
         <path d="M0,80 L0,-30 Q0,-40 20,-40 L20,80 Q20,90 0,80" fill="white" opacity="0.1" />
      </g>

      {/* Right Arm (Animated) */}
      <g 
        transform={`translate(70, 280) rotate(${currentRotation})`} 
        style={{ transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <path d="M0,0 Q40,10 90,0" stroke="url(#limbGrad)" strokeWidth="18" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <g 
            transform={`translate(${90 + handFollowX}, ${0 + handFollowY}) rotate(${handRotation})`} 
            style={{ transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            filter="url(#softShadow)"
        >
             <g transform="scale(-1, 1)">
                 <path 
                    d="M-10,0 C-22,0 -22,-25 -15,-30 L-14,-72 Q-5,-82 3,-72 L5,-30 L12,-75 Q20,-77 26,-70 L28,-30 L40,-65 Q48,-68 52,-58 L45,-20 Q50,-10 50,10 Q42,35 10,35 Q-8,35 -10,0" 
                    fill="white" stroke="#E0E0E0" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                 />
                 <path d="M2,5 Q15,10 28,0" stroke="#EEE" strokeWidth="2" fill="none" strokeLinecap="round"/>
                 <ellipse cx="-18" cy="-8" rx="12" ry="22" transform="rotate(-55, -18, -8)" fill="white" stroke="#E0E0E0" strokeWidth="2" />
             </g>
        </g>
      </g>
    </svg>
  );
};
