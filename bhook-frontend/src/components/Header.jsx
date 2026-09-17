import React, { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import BhookLogo from './BhookLogo';

export default function Header({
  selectedCity,
  searchQuery,
  onSearchSubmit,
  onClearSearch,
}) {


  const [headerInput, setHeaderInput] = useState(searchQuery || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (headerInput.trim()) {
      onSearchSubmit(headerInput.trim());
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-stone-200/80 bg-white/95 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3 sm:gap-6">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={(e) => {
              e.preventDefault();
              if (onClearSearch) onClearSearch();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}>
            <BhookLogo size="md" />
          </div>

          {/* Center: Quick search input */}
          <div className="flex-1 max-w-md hidden md:block">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                value={headerInput}
                onChange={(e) => setHeaderInput(e.target.value)}
                placeholder="Search dish (e.g. biryani, pizza, dosa)..."
                className="w-full pl-10 pr-20 py-2 text-sm bg-stone-100 border border-stone-200 rounded-full focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-stone-800 placeholder-stone-400"
              />
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-stone-900 hover:bg-orange-600 text-white text-xs font-semibold rounded-full transition-colors cursor-pointer"
              >
                Search
              </button>
            </form>
          </div>

          {/* Right: active city */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 text-xs font-bold text-orange-800 sm:text-sm" aria-label={`Active city: ${selectedCity}`}>
              <MapPin className="h-4 w-4 text-orange-600" aria-hidden="true" />
              <span>{selectedCity}</span>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
