import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';

export default function BestMatchBadge({ variant = 'ribbon' }) {
  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-sm">
        <Sparkles className="w-3 h-3 text-amber-100" />
        Top Match
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-md shadow-orange-500/20">
      <Trophy className="w-3.5 h-3.5 text-amber-100" />
      <span>Best Overall Value</span>
    </div>
  );
}
