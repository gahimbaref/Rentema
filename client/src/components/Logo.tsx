import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  variant?: 'full' | 'icon';
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 40, 
  showText = true,
  variant = 'full' 
}) => {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        
        {/* House/Building shape */}
        <path
          d="M50 15 L85 40 L85 85 L15 85 L15 40 Z"
          fill="url(#logoGradient)"
        />
        
        {/* Door */}
        <rect x="40" y="60" width="20" height="25" fill="#1e293b" rx="2" />
        
        {/* Windows */}
        <rect x="25" y="45" width="12" height="12" fill="#60a5fa" rx="1" />
        <rect x="63" y="45" width="12" height="12" fill="#60a5fa" rx="1" />
        
        {/* Roof accent */}
        <path
          d="M50 15 L85 40 L80 40 L50 20 L20 40 L15 40 Z"
          fill="#1e293b"
          opacity="0.3"
        />
      </svg>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        
        {/* House/Building shape */}
        <path
          d="M50 15 L85 40 L85 85 L15 85 L15 40 Z"
          fill="url(#logoGradient)"
        />
        
        {/* Door */}
        <rect x="40" y="60" width="20" height="25" fill="#1e293b" rx="2" />
        
        {/* Windows */}
        <rect x="25" y="45" width="12" height="12" fill="#60a5fa" rx="1" />
        <rect x="63" y="45" width="12" height="12" fill="#60a5fa" rx="1" />
        
        {/* Roof accent */}
        <path
          d="M50 15 L85 40 L80 40 L50 20 L20 40 L15 40 Z"
          fill="#1e293b"
          opacity="0.3"
        />
      </svg>
      
      {showText && (
        <div style={{ 
          fontSize: size * 0.6, 
          fontWeight: 700,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Rentema
        </div>
      )}
    </div>
  );
};

export default Logo;
