import React, { useState } from 'react';
import { AlertCircle, LocateFixed, MapPin } from 'lucide-react';
import {
  findNearestArea,
  isLocationAccurateEnough,
} from '../utils/location';

export default function LucknowLocationPanel({
  areas,
  maximumDistanceKm,
  selectedAreaSlug,
  onAreaChange,
  loadingAreas,
  areasError,
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState(null);

  const useLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by this browser. Choose an area manually.' });
      return;
    }

    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const accuracyMeters = position.coords.accuracy;
        if (!isLocationAccurateEnough(accuracyMeters)) {
          setLocating(false);
          const readableAccuracy = Number.isFinite(accuracyMeters)
            ? `only accurate to about ${(accuracyMeters / 1000).toFixed(1)} km`
            : 'not precise enough';
          setMessage({
            type: 'error',
            text: `Your location is ${readableAccuracy}, so BHOOK did not auto-select an area. Turn on precise location or choose an area manually.`,
          });
          return;
        }

        const nearest = findNearestArea(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          areas,
        );
        setLocating(false);

        if (nearest && nearest.distanceKm <= maximumDistanceKm) {
          onAreaChange(nearest.area.slug);
          setMessage({
            type: 'success',
            text: `${nearest.area.name} selected — approximately ${nearest.distanceKm.toFixed(1)} km away (location accuracy ±${Math.round(accuracyMeters)} m).`,
          });
          return;
        }

        setMessage({
          type: 'error',
          text: `BHOOK coverage is not available within ${maximumDistanceKm} km. Choose an area manually.`,
        });
      },
      (error) => {
        setLocating(false);
        const denied = error.code === error.PERMISSION_DENIED;
        setMessage({
          type: 'error',
          text: denied
            ? 'Location permission was not granted. Choose a Lucknow area manually.'
            : 'Your location could not be detected. Choose a Lucknow area manually.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10" aria-labelledby="lucknow-coverage-title">
      <div className="rounded-2xl border border-orange-200 bg-white p-4 sm:p-5 shadow-md shadow-orange-950/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-2xl">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="lucknow-coverage-title" className="font-bold text-stone-900">Lucknow coverage</h2>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label htmlFor="lucknow-area" className="sr-only">Lucknow service area</label>
            <select
              id="lucknow-area"
              value={selectedAreaSlug}
              onChange={(event) => {
                onAreaChange(event.target.value);
                setMessage(null);
              }}
              disabled={loadingAreas}
              className="min-h-11 min-w-52 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60 cursor-pointer"
            >
              <option value="">Choose location</option>
              {areas.map((area) => (
                <option key={area.slug} value={area.slug}>{area.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={useLocation}
              disabled={locating || loadingAreas || areas.length === 0}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition-colors cursor-pointer"
            >
              <LocateFixed className={`w-4 h-4 ${locating ? 'animate-pulse' : ''}`} aria-hidden="true" />
              {locating ? 'Finding nearest area…' : 'Use my location'}
            </button>
          </div>
        </div>

        {(message || areasError) && (
          <div
            role="status"
            className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${
              message?.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-amber-50 text-amber-900 border border-amber-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{message?.text || areasError}</span>
          </div>
        )}
      </div>
    </section>
  );
}
