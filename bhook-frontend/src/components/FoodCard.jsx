import React, { useState } from 'react';
import { Star, Clock, MapPin, Utensils } from 'lucide-react';
import PlatformBadge from './PlatformBadge';
import BestMatchBadge from './BestMatchBadge';
import FinalPriceCheck from './FinalPriceCheck';
import MenuPriceComparison from './MenuPriceComparison';
import PriceTrendPreview from './PriceTrendPreview';

/**
 * FoodCard
 * Used for Top Picks section where `image_url` is provided (with guaranteed fallback).
 */
export default function FoodCard({ item, selectedAreaSlug, livePriceCheckEnabled }) {
  const {
    restaurant_name,
    city,
    area,
    item_name,
    platform,
    item_rating,
    delivery_time_mins,
    image_url,
    is_best_match,
    data_source,
  } = item;

  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`group relative flex flex-col rounded-2xl bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
        is_best_match
          ? 'border-2 border-amber-400 shadow-md shadow-amber-500/10 ring-2 ring-amber-400/20'
          : 'border border-stone-200/90 shadow-xs'
      }`}
    >
      {/* Best Match Top Banner / Ribbon */}
      {is_best_match && (
        <div className="absolute -top-3 left-4 z-10">
          <BestMatchBadge variant="compact" />
        </div>
      )}

      {/* Image Container with Fallback */}
      <div className="relative h-44 w-full overflow-hidden rounded-t-2xl bg-stone-100">
        {image_url && !imgFailed ? (
          <img
            src={image_url}
            alt={item_name}
            onError={() => setImgFailed(true)}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-amber-50 via-stone-100 to-orange-50 text-stone-400 p-4 text-center">
            <div className="p-3 bg-white/80 rounded-full shadow-xs mb-2 text-amber-500">
              <Utensils className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-stone-500 line-clamp-1">{item_name}</span>
          </div>
        )}

        {/* Platform badge positioned on top right of image */}
        <div className="absolute top-3 right-3 shadow-xs">
          <PlatformBadge platform={platform} />
        </div>

        {/* Delivery Time Pill overlay */}
        {delivery_time_mins && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-md bg-stone-900/80 backdrop-blur-xs px-2 py-0.5 text-[11px] font-medium text-white shadow-2xs">
            <Clock className="w-3 h-3 text-stone-300" />
            <span>{delivery_time_mins} mins</span>
          </div>
        )}

        {item.price_bracket?.label && (
          <div className="absolute bottom-2.5 right-2.5 rounded-md border border-white/30 bg-white/95 px-2 py-0.5 text-[11px] font-bold text-stone-800 shadow-sm backdrop-blur-sm">
            {item.price_bracket.label}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Dish Name */}
          <h3
            className="font-semibold text-stone-900 text-base leading-snug line-clamp-2 title-case group-hover:text-orange-600 transition-colors"
            title={item_name}
          >
            {item_name}
          </h3>

          {/* Restaurant & Location */}
          <div className="mt-1 flex items-center gap-1 text-xs text-stone-500">
            <span className="font-medium text-stone-700 truncate max-w-[150px]">{restaurant_name}</span>
            <span className="text-stone-300">•</span>
            <span className="truncate flex items-center gap-0.5">
              <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
              {area || city}
            </span>
          </div>
        </div>

        {/* Bottom stats */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold shadow-2xs">
              <span>{Number(item_rating).toFixed(1)}</span>
              <Star className="w-3 h-3 fill-current" />
            </span>
            <span className="text-[11px] text-stone-400">rated</span>
          </div>

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
    </div>
  );
}
