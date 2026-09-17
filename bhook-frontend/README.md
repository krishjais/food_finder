# BHOOK Frontend

React, Vite, and Tailwind CSS frontend for the BHOOK food-price comparison portfolio app.

## Development

```bash
npm install
npm run dev
```

Vite runs on `http://localhost:5173` and proxies `/api` to the backend at
`http://localhost:5000`. Set `VITE_API_BASE_URL` for a deployed backend.

## Current UI

- Six-city selector including Lucknow live/simulated coverage.
- Dish, maximum-price, and city search controls.
- Cuisine shortcuts backed by stored dish keywords.
- Search cards ordered by the backend's BHOOK Best Value Score.
- One top-pick card per restaurant with image fallbacks.
- Loading, empty, retry, and error states.
- Explicit `MOCK` source labels for the current portfolio dataset.
- Explicit `LIVE` and `SIMULATED` labels for Lucknow records.
- User-triggered nearest-area matching with a 15 km Haversine cutoff and manual fallback.
- Per-item final-price checks for Lucknow live/simulated rows.

The price-trend API is supported by item IDs, but a dedicated chart UI is not connected yet.

## Checks

```bash
npm test
npm run lint
npm run build
```
