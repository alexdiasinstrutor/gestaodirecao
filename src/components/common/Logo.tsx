import React from 'react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'horizontal' | 'compact';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  theme = 'light',
  size = 'md',
  className = '',
  showSubtitle = true
}) => {
  // Dimension definitions
  const dimensions = {
    sm: { icon: 28, textMain: 'text-base', textSub: 'text-[9px]', gap: 'gap-2' },
    md: { icon: 40, textMain: 'text-xl', textSub: 'text-[11px]', gap: 'gap-3' },
    lg: { icon: 54, textMain: 'text-2xl sm:text-3xl', textSub: 'text-xs', gap: 'gap-3.5' },
    xl: { icon: 72, textMain: 'text-3xl sm:text-4xl', textSub: 'text-sm', gap: 'gap-4' }
  }[size];

  const isDark = theme === 'dark';

  // Vector Logo Emblem: Monogram "AD" inside an aerodynamic steering wheel and forward road curve
  const LogoIcon = (
    <div
      className={`relative flex items-center justify-center shrink-0 drop-shadow-md select-none transition-transform hover:scale-105 duration-200`}
      style={{ width: dimensions.icon, height: dimensions.icon }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Main Shield / Wheel Gradient */}
          <linearGradient id="adGradientPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Accent Glow */}
          <linearGradient id="adGradientAccent" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>

          {/* Inner Road vanishing gradient */}
          <linearGradient id="adGradientRoad" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>

          <filter id="adGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0284c7" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Outer Dynamic Steering Wheel Ring with Sports Car Contour */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#adGradientPrimary)"
          strokeWidth="6.5"
          strokeDasharray="260"
          strokeDashoffset="12"
          strokeLinecap="round"
          className="transition-all"
        />

        {/* Wheel Grip Upper Accents */}
        <path
          d="M26 24 C34 16, 66 16, 74 24"
          stroke="#38bdf8"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Dynamic Road Track (Perspective Triangle into horizon) */}
        <path
          d="M38 78 L47 44 L53 44 L62 78 Z"
          fill="url(#adGradientRoad)"
          opacity="0.45"
        />
        {/* Road center dash line */}
        <line
          x1="50"
          y1="50"
          x2="50"
          y2="74"
          stroke="#ffffff"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />

        {/* Stylized Monogram "A" (Left side curving upward) */}
        <path
          d="M30 76 L48 27 C49 24.5, 51 24.5, 52 27 L60 48"
          stroke="#ffffff"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Letter "A" crossbar forming steering spoke */}
        <path
          d="M37 56 L55 56"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Stylized Monogram "D" (Right side forming the direction curve & speed loop) */}
        <path
          d="M52 32 C68 32, 78 40, 78 52 C78 64, 66 72, 50 72"
          stroke="url(#adGradientAccent)"
          strokeWidth="5.5"
          strokeLinecap="round"
          filter="url(#adGlow)"
        />

        {/* Direction Arrow Needle at top right */}
        <circle cx="75" cy="46" r="3.5" fill="#38bdf8" />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return <div className={className}>{LogoIcon}</div>;
  }

  return (
    <div className={`flex items-center ${dimensions.gap} ${className}`}>
      {LogoIcon}

      <div className="flex flex-col select-none leading-none">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-black tracking-tight ${dimensions.textMain} ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Gestão
          </span>
          <span className={`font-black tracking-tight ${dimensions.textMain} bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 bg-clip-text text-transparent drop-shadow-xs`}>
            AD
          </span>
        </div>

        {showSubtitle && (
          <span
            className={`font-bold tracking-widest uppercase mt-0.5 ${dimensions.textSub} ${
              isDark ? 'text-sky-300/90' : 'text-slate-500'
            }`}
          >
            Auto Direção
          </span>
        )}
      </div>
    </div>
  );
};

