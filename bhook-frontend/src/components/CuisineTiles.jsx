import React from 'react';
import { CUISINES } from '../data/cuisines';
import { Flame } from 'lucide-react';

/**
 * CuisineTiles
 * Displays the 8 confirmed MySQL database cuisines.
 * Clicking any tile pre-fills the search query with its representative dish keyword
 * and immediately triggers GET /api/search?dish=<keyword>.
 */
export default function CuisineTiles({ activeKeyword, onSelectCuisine }) {
  return (
    <section className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-600 mb-1">
            <Flame className="w-4 h-4 fill-orange-500 text-orange-500" />
            <span>Popular Categories</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Explore by Cuisine
          </h2>
        </div>
      </div>

      {/* Grid of Cuisine Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        {CUISINES.map((item) => {
          const isActive = activeKeyword?.toLowerCase() === item.keyword.toLowerCase();
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectCuisine(item.keyword)}
              className={`group relative flex flex-col items-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-center ${
                isActive
                  ? 'border-orange-500 bg-orange-50/80 shadow-md ring-2 ring-orange-400/30'
                  : 'border-stone-200/80 bg-white hover:border-orange-300 hover:shadow-md hover:-translate-y-1'
              }`}
            >
              {/* Circular food thumbnail */}
              <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden mb-2.5 shadow-inner bg-stone-100 ring-2 ring-stone-100 group-hover:ring-orange-200 transition-all">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>

              {/* Title & subtle dish keyword hint */}
              <span className="text-xs sm:text-sm font-bold text-stone-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                {item.name}
              </span>
              <span className="text-[10px] text-stone-400 font-medium line-clamp-1 mt-0.5">
                '{item.keyword}'
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
