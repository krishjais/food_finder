import React, { useState } from 'react';
import { LoaderCircle, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { fetchPriceTrend } from '../api/foodApi';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const TREND_DETAILS = {
  rising: { label: 'May rise', Icon: TrendingUp, className: 'text-red-700 bg-red-50 border-red-200' },
  falling: { label: 'May fall', Icon: TrendingDown, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  stable: { label: 'Likely stable', Icon: Minus, className: 'text-stone-700 bg-stone-50 border-stone-200' },
};

export default function PriceTrendPreview({ itemId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchPriceTrend(itemId));
    } catch (requestError) {
      setError(requestError.message || 'Price outlook is unavailable');
    } finally {
      setLoading(false);
    }
  };

  if (!result) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 hover:border-orange-300 hover:text-orange-700 disabled:opacity-60"
        >
          {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {loading ? 'Checking outlook…' : 'View price outlook'}
        </button>
        {error && <p className="mt-1 text-[11px] text-stone-500">{error}</p>}
      </div>
    );
  }

  const details = TREND_DETAILS[result.trend] || TREND_DETAILS.stable;
  const { Icon } = details;
  return (
    <div className={`mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${details.className}`}>
      <span className="inline-flex items-center gap-1.5 font-bold">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {details.label}
      </span>
      <span>Menu price next week: <strong>{money.format(result.predicted_price_next_week)}</strong></span>
    </div>
  );
}
