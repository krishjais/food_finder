import React, { useState } from 'react';
import { Search, MapPin, ArrowRight, X } from 'lucide-react';

export default function Hero({
  searchQuery,
  maxPrice,
  selectedCity,
  onSearch,
  searchRef,
}) {
  const [localDish, setLocalDish] = useState(searchQuery || '');
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (localDish.trim() || Number(localMaxPrice) > 0) {
      onSearch({
        dish: localDish.trim(),
        maxPrice: localMaxPrice ? Number(localMaxPrice) : '',
        city: selectedCity,
      });
    }
  };

  const handleQuickSearch = (dishWord, budget) => {
    setLocalDish(dishWord);
    if (budget) setLocalMaxPrice(budget);
    onSearch({
      dish: dishWord,
      maxPrice: budget || (localMaxPrice ? Number(localMaxPrice) : ''),
      city: selectedCity,
    });
  };

  const trendingTags = ['pizza', 'biryani', 'paneer', 'dosa', 'burger', 'noodles', 'tikka', 'cake'];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-orange-50/70 via-[#fbf9f5] to-[#fbf9f5] pt-10 pb-14 sm:pt-16 sm:pb-16">
      {/* Decorative ambient background accent */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-orange-300/20 via-amber-200/20 to-yellow-200/20 blur-3xl rounded-full" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        
        {/* Main Hero Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-stone-900 tracking-tight leading-[1.1] mb-4">
          Craving something tasty?{' '}
          <span className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
            Find the best value
          </span>{' '}
          in your budget.
        </h1>

        {/* Unified Search & Budget Bar */}
        <div
          ref={searchRef}
          className="max-w-3xl mx-auto bg-white rounded-3xl p-3 sm:p-3.5 shadow-xl shadow-orange-950/5 border border-stone-200/90 transition-all focus-within:border-orange-400 focus-within:ring-4 focus-within:ring-orange-500/10"
        >
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
            
            {/* 1. Dish Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={localDish}
                onChange={(e) => setLocalDish(e.target.value)}
                placeholder="Craving (e.g. pizza, biryani, burger)"
                className="w-full pl-11 pr-8 py-3 text-base font-semibold bg-stone-50/80 hover:bg-stone-50 focus:bg-white rounded-2xl border-none text-stone-900 placeholder-stone-400 focus:outline-hidden transition-all"
                autoFocus
              />
              {localDish && (
                <button
                  type="button"
                  onClick={() => setLocalDish('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                  title="Clear input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 2. Direct Budget / Max Price Input */}
            <div className="relative w-full md:w-44">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-orange-600 pointer-events-none">
                <span className="font-bold text-sm">₹</span>
              </div>
              <input
                type="number"
                min="10"
                max="5000"
                step="10"
                value={localMaxPrice}
                onChange={(e) => setLocalMaxPrice(e.target.value)}
                placeholder="Budget (₹)"
                className="w-full pl-8 pr-7 py-3 text-base font-semibold bg-stone-50/80 hover:bg-stone-50 focus:bg-white rounded-2xl border-none text-stone-900 placeholder-stone-400 focus:outline-hidden transition-all"
              />
              {localMaxPrice && (
                <button
                  type="button"
                  onClick={() => setLocalMaxPrice('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-0.5 cursor-pointer"
                  title="Clear budget"
                >
                  ✕
                </button>
              )}
            </div>

            {/* 3. Active City */}
            <div className="relative w-full md:w-36">
              <MapPin className="w-4 h-4 text-orange-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <div className="w-full rounded-2xl bg-stone-50/80 py-3 pl-8 pr-3 text-left text-sm font-semibold text-stone-800" aria-label={`Searching in ${selectedCity}`}>
                {selectedCity}
              </div>
            </div>

            {/* 4. Submit Button */}
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-600/25 active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <span>Search</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Quick Budget & Trending Suggestion Chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-stone-500">
          <span className="font-bold text-stone-400">Popular:</span>
          {trendingTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleQuickSearch(tag)}
              className="px-3 py-1 rounded-full bg-white hover:bg-orange-50 hover:border-orange-300 border border-stone-200/80 text-stone-700 hover:text-orange-700 transition-colors font-medium cursor-pointer shadow-2xs"
            >
              #{tag}
            </button>
          ))}
          <span className="text-stone-300 mx-1">•</span>
          <span className="font-bold text-stone-400">Budgets:</span>
          {['150', '250', '350', '500'].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setLocalMaxPrice(b);
                onSearch({ dish: localDish.trim(), maxPrice: Number(b), city: selectedCity });
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                localMaxPrice === b
                  ? 'bg-amber-100 border-amber-400 text-amber-900'
                  : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-600'
              }`}
            >
              Under ₹{b}
            </button>
          ))}
        </div>

      </div>
    </section>
  );
}
