import React, { useState } from 'react';
import SearchDishCard from './SearchDishCard';
import SkeletonCard from './SkeletonCard';
import { ArrowLeft, RefreshCw, AlertCircle, UtensilsCrossed } from 'lucide-react';

function BudgetFilter({ maxPrice, onApply }) {
  const [value, setValue] = useState(maxPrice || '');
  const apply = () => {
    const nextBudget = value ? Number(value) : '';
    if (nextBudget !== maxPrice) onApply(nextBudget);
  };

  return (
    <div className="flex items-center gap-1 bg-stone-50 rounded-xl px-2.5 py-1 border border-stone-200 focus-within:border-orange-500 focus-within:bg-white">
      <span className="text-xs text-orange-600 font-bold">₹</span>
      <input
        type="number"
        min="10"
        max="5000"
        step="10"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply();
          }
        }}
        placeholder="Budget"
        className="w-20 text-xs font-bold text-stone-800 bg-transparent focus:outline-hidden"
      />
      {value && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setValue('');
            onApply('');
          }}
          className="text-stone-400 hover:text-stone-600 text-xs px-1 cursor-pointer"
          title="Remove budget filter"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function SearchResults({
  searchDish,
  results,
  loading,
  loadingMore,
  loadMoreError,
  error,
  maxPrice,
  selectedCity,
  selectedAreaSlug,
  livePriceCheckEnabled,
  onUpdateFilters,
  onClearSearch,
  pagination,
  onLoadMore,
  onRetry,
}) {
  const resultCount = results?.length || 0;

  return (
    <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Search Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200/90 shadow-xs mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Title & Query info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClearSearch}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 transition-colors cursor-pointer py-1 pr-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </button>
              <span className="text-stone-300">•</span>
              <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">
                Cross-Platform Results
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight flex flex-wrap items-center gap-2">
              <span>{searchDish ? 'Matches for' : 'Best dishes'}</span>
              {searchDish && (
                <span className="text-orange-600 bg-orange-50 px-3 py-0.5 rounded-xl border border-orange-200/80 inline-block">
                  &ldquo;{searchDish}&rdquo;
                </span>
              )}
              {searchDish && results && results.length > 0 && results[0].item_name.toLowerCase() !== searchDish.toLowerCase() && (
                <span className="ml-2 text-sm text-stone-500">Did you mean &ldquo;{results[0].item_name}&rdquo;?</span>
              )}
            </h2>

            <p className="text-xs sm:text-sm text-stone-500">
              {!loading && !error && (
                <>
                  Showing <strong className="text-stone-800 font-semibold">{resultCount}</strong>
                  {pagination?.total > resultCount && <> of <strong className="text-stone-800 font-semibold"> {pagination.total}</strong></>} dishes ranked by BHOOK Best Value Score
                  {` in ${selectedCity}`}
                  {maxPrice && ` (under ₹${maxPrice})`}
                </>
              )}
            </p>
          </div>

          {/* Inline Filter Controls */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100">
            {/* Active city */}
            <div className="flex min-h-9 items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5">
              <span className="text-xs text-stone-400 font-medium">City:</span>
              <span className="text-xs font-bold text-orange-800">{selectedCity}</span>
            </div>

            {/* Direct Budget Input */}
            <BudgetFilter
              key={maxPrice || 'no-budget'}
              maxPrice={maxPrice}
              onApply={(nextBudget) => onUpdateFilters({ maxPrice: nextBudget })}
            />

            {/* Clear search button */}
            <button
              type="button"
              onClick={onClearSearch}
              className="px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 text-xs font-medium transition-colors cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* 1. LOADING STATE */}
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2 text-stone-400 text-xs font-medium py-2">
            <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
            <span>Searching the BHOOK portfolio dataset...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} hasImage={false} />
            ))}
          </div>
        </div>
      )}

      {/* 2. ERROR STATE */}
      {!loading && error && (
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-red-200/90 p-8 text-center shadow-md shadow-red-500/5 my-8">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 mb-2">
            Unable to complete search
          </h3>
          <p className="text-sm text-stone-600 mb-6 leading-relaxed">
            {error}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Search</span>
            </button>
            <button
              type="button"
              onClick={onClearSearch}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              View Top Picks
            </button>
          </div>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!loading && !error && resultCount === 0 && (
        <div className="max-w-md mx-auto bg-white rounded-3xl border border-stone-200/90 p-8 text-center shadow-xs my-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200/60">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 mb-1">
            No matching dishes found
          </h3>
          <p className="text-xs sm:text-sm text-stone-500 mb-6 leading-relaxed">
            We couldn&apos;t find any dishes{searchDish && <> matching &ldquo;{searchDish}&rdquo;</>}
            {` in ${selectedCity}`}
            {maxPrice && ` under ₹${maxPrice}`}. Try adjusting your filters or search keywords.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {maxPrice && (
              <button
                type="button"
                onClick={() => onUpdateFilters({ maxPrice: '' })}
                className="px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200 transition-colors cursor-pointer"
              >
                Remove Budget Filter
              </button>
            )}
            <button
              type="button"
              onClick={onClearSearch}
              className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Explore Top Picks
            </button>
          </div>
        </div>
      )}

      {/* 4. RESULTS DISPLAY (NO IMAGES, AS SPECIFIED) */}
      {!loading && !error && resultCount > 0 && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map((item, index) => (
              <SearchDishCard
                key={`${item.item_id}-${item.platform}`}
                item={item}
                rank={index + 1}
                selectedAreaSlug={selectedAreaSlug}
                livePriceCheckEnabled={livePriceCheckEnabled}
              />
            ))}
          </div>
          {pagination?.has_more && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="min-h-11 rounded-xl bg-stone-900 px-6 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? 'Loading more dishes…' : `Load more (${pagination.total - resultCount} remaining)`}
              </button>
              {loadMoreError && <p className="text-xs text-red-700" role="alert">{loadMoreError}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
