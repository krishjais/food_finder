import React, { useState } from 'react';
import { AlertCircle, BadgeIndianRupee, LoaderCircle } from 'lucide-react';
import { checkFinalPrice } from '../api/foodApi';
import PlatformBadge from './PlatformBadge';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function FinalPriceCheck({ itemId, dataSource, areaSlug }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!['swiggy_live', 'zomato_simulated'].includes(dataSource)) return null;

  const needsArea = !areaSlug;

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await checkFinalPrice(itemId, { area: areaSlug }));
    } catch (requestError) {
      setError(requestError.message || 'Unable to check final price');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-3 border-t border-stone-100">
      <button
        type="button"
        onClick={runCheck}
        disabled={loading || needsArea}
        className="min-h-11 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 text-sm font-bold text-orange-800 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
      >
        {loading ? <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" /> : <BadgeIndianRupee className="w-4 h-4" aria-hidden="true" />}
        {loading ? 'Verifying checkout total…' : 'Verify with live checkout'}
      </button>

      {needsArea && (
        <p className="mt-2 text-xs text-amber-800">Select a Lucknow area to verify the estimate.</p>
      )}

      {error && (
        <div role="alert" className="mt-2 flex gap-2 rounded-lg bg-red-50 p-2 text-xs leading-relaxed text-red-800 border border-red-200">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {result?.comparison && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-700" aria-live="polite">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              result.comparison.swiggy,
              result.comparison.zomato,
            ].map((details) => {
              const isCheaper = result.comparison.cheaper_platform === details.platform;
              return (
                <section
                  key={details.platform}
                  className={`rounded-xl border p-3 ${isCheaper ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}
                  aria-label={`${details.platform} final price`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <PlatformBadge platform={details.platform} size="xs" />
                    {isCheaper && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Lower total</span>}
                  </div>
                  <p className="mt-2 text-xl font-black text-stone-900">{money.format(details.total)}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1">
                    <dt>Subtotal</dt><dd className="text-right">{money.format(details.subtotal)}</dd>
                    <dt>Delivery</dt><dd className="text-right">{money.format(details.delivery_fee)}</dd>
                    <dt>Taxes &amp; charges</dt><dd className="text-right">{money.format(details.taxes_and_charges)}</dd>
                    {details.platform_fee > 0 && <><dt>Platform fee</dt><dd className="text-right">{money.format(details.platform_fee)}</dd></>}
                    {details.other_charges > 0 && <><dt>Other charges</dt><dd className="text-right">{money.format(details.other_charges)}</dd></>}
                    {details.discount > 0 && <><dt>{details.offer_label || 'Discount'}</dt><dd className="text-right text-emerald-700">−{money.format(details.discount)}</dd></>}
                  </dl>
                  <p className={`mt-2 font-semibold ${details.coupon_code ? 'text-emerald-700' : 'text-stone-500'}`}>
                    {details.coupon_status || 'Coupon not applicable'}
                  </p>
                </section>
              );
            })}
          </div>
          <p className="mt-3 text-center font-bold text-emerald-700">
            {result.comparison.cheaper_platform === 'Same price'
              ? 'Both totals are the same'
              : `${result.comparison.cheaper_platform} saves ${money.format(result.comparison.savings)}`}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">{result.comparison.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
