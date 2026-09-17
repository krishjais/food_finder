import React from 'react';
import { Star, Clock, MapPin, Sparkles } from 'lucide-react';
import PlatformBadge from './PlatformBadge';
import BestMatchBadge from './BestMatchBadge';
import FinalPriceCheck from './FinalPriceCheck';
import MenuPriceComparison from './MenuPriceComparison';
import PriceTrendPreview from './PriceTrendPreview';

/**
 * SearchDishCard
 * Dedicated card for Search Results.
 * NOTE: As per brief, GET /api/search does NOT return `image_url`.
 * This card is intentionally designed without image fields to avoid broken images.
 */
export default function SearchDishCard({ item, rank, selectedAreaSlug, livePriceCheckEnabled }) {
  const {
    restaurant_name,
    city,
    area,
    item_name,
    platform,
    item_rating,
    delivery_time_mins,
    is_best_match,
    data_source,
  } = item;

  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        is_best_match
          ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-50/40 via-white to-white shadow-md ring-2 ring-amber-400/20'
          : 'border border-stone-200/90 shadow-2xs hover:border-stone-300'
      }`}
    >
      {/* Best match ribbon */}
      {is_best_match && (
        <div className="absolute -top-3 left-4 z-10">
          <BestMatchBadge variant="compact" />
        </div>
      )}

      {/* Top row: Platform & Rank */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <PlatformBadge platform={platform} />
        {rank && !is_best_match && (
          <span className="text-[11px] font-medium text-stone-400">
            #{rank}
          </span>
        )}
        {is_best_match && (
          <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Top Pick
          </span>
        )}
      </div>

      {/* Dish Name & Restaurant Info */}
      <div className="space-y-1.5 flex-grow">
        <h3
          className="text-lg font-bold text-stone-900 leading-snug tracking-tight title-case hover:text-orange-600 transition-colors"
          title={item_name}
        >
          {item_name}
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
          <span className="font-semibold text-stone-700">{restaurant_name}</span>
          <span className="text-stone-300">•</span>
          <span className="flex items-center gap-0.5 text-stone-500">
            <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
            {area ? `${area}, ${city}` : city}
          </span>
        </div>
      </div>

      {/* Bottom specs: Rating and delivery time */}
      <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Rating */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold shadow-2xs">
            <span>{Number(item_rating).toFixed(1)}</span>
            <Star className="w-3 h-3 fill-current" />
          </div>

          {/* Delivery Time */}
          {delivery_time_mins && (
            <div className="flex items-center gap-1 text-xs text-stone-600 font-medium">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              <span>{delivery_time_mins}m</span>
            </div>
          )}
        </div>

        {is_best_match && (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
            Best Overall Value
          </span>
        )}
      </div>

      <MenuPriceComparison item={item} />
      <PriceTrendPreview itemId={item.item_id} />

      {livePriceCheckEnabled && (
        <FinalPriceCheck
          itemId={item.item_id}
          dataSource={data_source}
          areaSlug={selectedAreaSlug}
        />
      )}
    </div>
  );
}
