import React from 'react';

const iconImg = '/icon.png';
const logoImg = '/logo.png';

/**
 * BhookLogo Component
 * Renders the official brand icon (icon.png) and logo wordmark (logo.png).
 */
export default function BhookLogo({
  size = 'md',
  showIcon = true,
  showText = true,
  className = '',
}) {
  const iconSizes = {
    sm: 'w-7 h-7 sm:w-8 sm:h-8',
    md: 'w-9 h-9 sm:w-10 sm:h-10',
    lg: 'w-12 h-12 sm:w-14 sm:h-14',
  };

  const logoSizes = {
    sm: 'h-6 sm:h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-10 sm:h-12',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none group ${className}`}>
      {/* Brand Icon Badge */}
      {showIcon && (
        <img
          src={iconImg}
          alt="Bhook Icon"
          className={`${iconSizes[size] || iconSizes.md} shrink-0 object-contain rounded-2xl drop-shadow-xs transition-transform duration-200 group-hover:scale-105`}
        />
      )}

      {/* Brand Wordmark Logo */}
      {showText && (
        <div className="flex items-center">
          <img
            src={logoImg}
            alt="BHOOK"
            className={`${logoSizes[size] || logoSizes.md} w-auto object-contain transition-opacity duration-200 group-hover:opacity-95`}
          />
        </div>
      )}
    </div>
  );
}

