# BHOOK

BHOOK is a final-year portfolio project for finding food that fits a user's
budget. It compares paired Swiggy catalog prices with clearly disclosed Zomato
estimates, ranks dishes by rating, estimated payable price, and delivery time,
and supports fixed-area location matching in Lucknow.

## Architecture

- `bhook-frontend`: React, Vite, Tailwind CSS
- `food-finder`: Node.js, Express, MySQL-compatible database
- Search: Fuse.js typo-tolerant matching plus BHOOK Best Value Score
- Data: stored catalog snapshots; no Zomato scraping or unofficial API
- Public deployment: estimated payable totals; shared-account Swiggy tools are
  disabled by default

## Local development

1. Copy `food-finder/.env.example` to `food-finder/.env` and configure MySQL.
2. Install dependencies in both application directories with `npm ci`.
3. Start the backend with `npm run dev` in `food-finder`.
4. Start the frontend with `npm run dev` in `bhook-frontend`.

Or run `start-bhook.bat` on Windows after dependencies and environment values
are configured.

## Verification

```bash
cd food-finder && npm test
cd ../bhook-frontend && npm run lint && npm test && npm run build
```

## Database portability

Run `npm run export:db` in `food-finder` to regenerate
`food-finder/database/bhook.sql`. The export contains catalog and price-history
data only, never `.env`, OAuth tokens, or saved addresses.

## Deployment

- Backend Blueprint: `render.yaml`
- Frontend Vercel config: `bhook-frontend/vercel.json`
- Database: any TLS-enabled MySQL-compatible service such as TiDB Cloud Starter

Set `VITE_API_BASE_URL` on the frontend, and set `FRONTEND_URL` plus
`CORS_ORIGINS` to the exact deployed frontend origin on the backend.

## Data disclosure

Swiggy rows are stored catalog snapshots. Zomato values are portfolio estimates
derived from stored percentage offsets; they are not real Zomato checkout data.
The public app does not scrape Zomato or call unofficial APIs.
