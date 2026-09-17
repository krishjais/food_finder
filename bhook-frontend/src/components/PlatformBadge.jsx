import React from 'react';

/**
 * PlatformBadge
 * Strictly uses plain text labels and distinctive colors.
 * NO trademarked logos or brand marks are used as per specification.
 */
export default function PlatformBadge({ platform, size = 'sm' }) {
  const isZomato = platform?.toLowerCase() === 'zomato';
  const isSwiggy = platform?.toLowerCase() === 'swiggy';

  const sizeClasses = size === 'xs' 
    ? 'text-[11px] px-2 py-0.5 font-medium' 
    : 'text-xs px-2.5 py-1 font-semibold';

  if (isZomato) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-2xs tracking-wide ${sizeClasses}`}
        title="Zomato"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Zomato
      </span>
    );
  }

  if (isSwiggy) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800 shadow-2xs tracking-wide ${sizeClasses}`}
        title="Swiggy"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Swiggy
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 text-stone-700 ${sizeClasses}`}>
      {platform || 'Delivery'}
    </span>
  );
}
