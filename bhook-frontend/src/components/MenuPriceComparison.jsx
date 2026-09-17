import React from 'react';
import { ArrowDown } from 'lucide-react';
import PlatformBadge from './PlatformBadge';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function MenuPriceComparison({ item }) {
  const ownPrice = Number(item.price_inr);
  const pairedPrice = Number(item.comparison_price_inr);
  const ownPlatform = String(item.platform || '');
  const pairedPlatform = String(item.comparison_platform || '');
  const estimate = item.estimated_final_price;

  if (!estimate && (!Number.isFinite(pairedPrice) || !pairedPlatform)) {
    return (
      <div className="mt-4 border-t border-stone-100 pt-3 text-right text-xl font-extrabold text-stone-900">
        {money.format(ownPrice)}
      </div>
    );
  }

  const swiggyPrice = ownPlatform.toLowerCase() === 'swiggy' ? ownPrice : pairedPrice;
  const zomatoPrice = ownPlatform.toLowerCase() === 'zomato' ? ownPrice : pairedPrice;
  const cheaper = swiggyPrice === zomatoPrice ? 'Same price' : (swiggyPrice < zomatoPrice ? 'Swiggy' : 'Zomato');
  const savings = Math.abs(swiggyPrice - zomatoPrice);

  if (estimate?.swiggy && estimate?.zomato) {
    return (
      <div className="mt-4 border-t border-stone-100 pt-3" aria-label="Estimated payable price comparison">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-stone-500">Estimated payable</span>
          {estimate.area && <span className="text-[10px] text-stone-400">for {estimate.area}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[estimate.swiggy, estimate.zomato].map((entry) => {
            const isCheaper = estimate.cheaper_platform === entry.platform;
            return (
              <div key={entry.platform} className={`rounded-xl border p-2.5 ${isCheaper ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}>
                <PlatformBadge platform={entry.platform} size="xs" />
                <p className="mt-1.5 text-xl font-black text-stone-900">{money.format(entry.total)}</p>
                <p className="mt-0.5 text-[10px] text-stone-500">Menu {money.format(entry.subtotal)} + fees</p>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="text-stone-500">Delivery, platform fee &amp; charges included</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-700">
            {estimate.cheaper_platform === 'Same price'
              ? 'Same total'
              : <><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />{estimate.cheaper_platform} saves {money.format(estimate.savings)}</>}
          </span>
        </div>
        <details className="mt-2 rounded-lg bg-stone-50 px-2.5 py-2 text-[11px] text-stone-600">
          <summary className="cursor-pointer font-semibold text-stone-700">View estimate breakdown</summary>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[estimate.swiggy, estimate.zomato].map((entry) => (
              <dl key={entry.platform} className="grid grid-cols-2 gap-x-1 gap-y-0.5">
                <dt className="col-span-2 mb-0.5 font-bold">{entry.platform}</dt>
                <dt>Delivery</dt><dd className="text-right">{money.format(entry.delivery_fee)}</dd>
                <dt>Platform fee</dt><dd className="text-right">{money.format(entry.platform_fee)}</dd>
                <dt>Taxes/charges</dt><dd className="text-right">{money.format(entry.taxes_and_charges)}</dd>
                {entry.other_charges > 0 && <><dt>Other charges</dt><dd className="text-right">{money.format(entry.other_charges)}</dd></>}
                {entry.discount > 0 && <><dt>Offer</dt><dd className="text-right text-emerald-700">−{money.format(entry.discount)}</dd></>}
                <dt className="col-span-2 mt-1 text-stone-400">{entry.coupon_status}</dt>
              </dl>
            ))}
          </div>
        </details>
        <p className="mt-1.5 text-[10px] leading-relaxed text-stone-500">{estimate.disclaimer}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-stone-100 pt-3" aria-label="Menu price comparison">
      <div className="grid grid-cols-2 gap-2">
        {[
          { platform: 'Swiggy', price: swiggyPrice },
          { platform: 'Zomato', price: zomatoPrice },
        ].map((entry) => (
          <div
            key={entry.platform}
            className={`rounded-xl border p-2.5 ${cheaper === entry.platform ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}
          >
            <PlatformBadge platform={entry.platform} size="xs" />
            <p className="mt-1.5 text-lg font-extrabold text-stone-900">{money.format(entry.price)}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-stone-500">Menu price</span>
        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
          {cheaper === 'Same price' ? cheaper : <><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />{cheaper} saves {money.format(savings)}</>}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-500">Zomato price is an estimate for comparison.</p>
    </div>
  );
}
