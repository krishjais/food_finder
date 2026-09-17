import React from 'react';
import FoodCard from './FoodCard';
import SkeletonCard from './SkeletonCard';
import { BadgePercent, RefreshCw, AlertCircle } from 'lucide-react';

export default function TopPicks({
  items,
  loading,
  error,
  selectedCity,
  selectedAreaSlug,
  livePriceCheckEnabled,
  onRetry,
}) {
  return (
    <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-3 border-b border-stone-200/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">
            <BadgePercent className="w-4 h-4 text-amber-500" />
            <span>Best value across budgets</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight flex items-center gap-3">
            <span>Must Grab Deals</span>
            {selectedCity && (
              <span className="text-sm font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                in {selectedCity}
              </span>
            )}
          </h2>
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 text-center max-w-md mx-auto my-8">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-red-900 mb-1">Could not load Top Picks</h3>
          <p className="text-xs text-red-700 mb-4">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Loading state: Skeletons */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} hasImage={true} />
          ))}
        </div>
      )}

      {/* Data display grid */}
      {!loading && !error && items && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((item, index) => (
            <FoodCard
              key={`${item.restaurant_name}-${item.item_name}-${index}`}
              item={item}
              selectedAreaSlug={selectedAreaSlug}
              livePriceCheckEnabled={livePriceCheckEnabled}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!items || items.length === 0) && (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-stone-200/80">
          <p className="text-stone-500 text-sm font-medium">
            No must-grab deals found for {selectedCity}. Try again shortly or choose another Lucknow area.
          </p>
        </div>
      )}
    </section>
  );
}
