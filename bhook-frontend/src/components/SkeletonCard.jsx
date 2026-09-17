import React from 'react';

export default function SkeletonCard({ hasImage = false }) {
  if (hasImage) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs animate-pulse flex flex-col h-full">
        {/* Image placeholder */}
        <div className="w-full h-44 bg-stone-200 relative">
          <div className="absolute top-3 left-3 w-16 h-5 bg-stone-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-grow justify-between gap-3">
          <div className="space-y-2">
            <div className="h-4 bg-stone-200 rounded-md w-3/4" />
            <div className="h-3 bg-stone-100 rounded-md w-1/2" />
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
            <div className="h-5 bg-stone-200 rounded-md w-16" />
            <div className="h-4 bg-stone-200 rounded-md w-12" />
          </div>
        </div>
      </div>
    );
  }

  // No-image search skeleton
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs animate-pulse space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-grow">
          <div className="h-5 bg-stone-200 rounded-md w-4/5" />
          <div className="h-3.5 bg-stone-100 rounded-md w-2/3" />
        </div>
        <div className="h-6 w-16 bg-stone-200 rounded-full" />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2">
        <div className="h-10 bg-stone-100 rounded-lg" />
        <div className="h-10 bg-stone-100 rounded-lg" />
        <div className="h-10 bg-stone-100 rounded-lg" />
      </div>
    </div>
  );
}
