# BHOOK Backend

Node.js, Express, and MySQL backend for the BHOOK food-price comparison portfolio app.

## Current capabilities

- Fuzzy dish search across the stored catalog with Fuse.js.
- BHOOK Best Value Score ranking: rating 50%, price 35%, delivery time 15%.
- One top-pick dish per restaurant using MySQL 8 `ROW_NUMBER()`.
- Synthetic 30-day price history and a seven-day linear-regression prediction.
- Optional Unsplash image enrichment for top-pick dishes.
- Experimental Swiggy Builders Club MCP OAuth, address, search, restaurant, and menu routes.
- Opt-in Lucknow catalog sync for ten fixed areas with a 3.5+ restaurant threshold.
- Query-time simulated Zomato prices linked to their live Swiggy source rows.
- On-demand live Swiggy and simulated Zomato final-price checks.

The original five-city catalog remains portfolio mock data. Lucknow rows are stored in the
same `restaurants` and `menu_items` tables and carry explicit source metadata.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and fill in local values.
3. Start with `npm run dev` or `npm start`.

Before enabling Lucknow, run the idempotent schema migration:

```bash
npm run migrate:lucknow
```

Configure `LUCKNOW_AREA_ADDRESS_IDS` with saved Swiggy address IDs for the fixed areas
(Rajajipuram, Uttardhona, Manas Nagar, Anora Kala, Aliganj, Gomti Nagar, Hazratganj,
Indira Nagar, Aminabad, and Chowk),
authenticate through `/api/platforms/swiggy/auth/login`, then run:

```bash
npm run sync:lucknow
```

Set `LUCKNOW_SYNC_ENABLED=true` to enable periodic syncs. The scheduler defaults to every
12 hours and remains disabled unless explicitly configured.

The default backend address is `http://localhost:5000`.

Never commit `.env` or `.swiggy_token.json`; both are ignored by Git.

## Expected base schema

```sql
CREATE TABLE restaurants (
  restaurant_id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255),
  city VARCHAR(100),
  area VARCHAR(100),
  cuisines VARCHAR(255),
  restaurant_rating DECIMAL(2,1),
  data_source ENUM('mock','swiggy_live','zomato_simulated') NOT NULL DEFAULT 'mock',
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at DATETIME NULL,
  source_restaurant_id VARCHAR(191) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL
);

CREATE TABLE menu_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id VARCHAR(10),
  platform VARCHAR(20),
  item_name VARCHAR(255),
  veg_or_non_veg VARCHAR(10),
  price_inr INT,
  item_rating DECIMAL(2,1),
  delivery_time_mins INT,
  image_url TEXT NULL,
  data_source ENUM('mock','swiggy_live','zomato_simulated') NOT NULL DEFAULT 'mock',
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at DATETIME NULL,
  source_item_id INT NULL,
  price_offset_percent DECIMAL(5,2) NULL,
  external_item_id VARCHAR(191) NULL,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id)
);
```

`scripts/generatePriceHistory.js` creates and populates `price_history` when run.

## API

### `GET /api/health`

Checks both the Express process and MySQL connection.

### `GET /api/search`

Parameters:

- `dish` — required dish query; this name is part of the frontend contract.
- `max_price` — optional positive integer.
- `city` — optional exact city filter.
- `area` — optional exact area filter, used for Lucknow's fixed coverage areas.
- `limit` — optional positive integer, capped at 100; defaults to 5.

The full structured-filter result set is fuzzy-matched before limiting. Every successful
response, including zero matches, has the same shape:

```json
{
  "query": "biryani",
  "results": []
}
```

Non-empty results include `item_id`, normalized numeric fields, `value_score`, and
`is_best_match`. Results are ordered by Best Value Score.

### `GET /api/top-picks`

Optional `city` and `limit` parameters. Returns one candidate per restaurant, then ranks
those candidates by Best Value Score. The default limit is 8 and the maximum is 100.

### `GET /api/price-trend/:itemId`

Returns historical prices, a predicted price for the following week, and a
`rising`, `falling`, or `stable` classification.

Simulated Zomato items keep their own `item_id`, but their trend is derived from the linked
Swiggy source history using the stored percentage offset.

### `GET /api/locations/lucknow-areas`

Returns the ten public fixed-area names and coordinates used for browser-side nearest-area
matching. It never returns Swiggy address IDs.

### `POST /api/final-price/:itemId`

Body: `{ "area": "gomti-nagar" }`.

- Swiggy live items run a guarded cart flow and always attempt cart cleanup.
- The flow refuses to overwrite a non-empty user cart.
- Simulated Zomato items return a clearly marked deterministic estimate without an external call.
- Mock items return `FINAL_PRICE_NOT_AVAILABLE`.

### `/api/platforms/swiggy`

Experimental MCP routes:

- `GET /auth/login`
- `GET /auth/callback`
- `GET /auth/status`
- `POST /auth/logout`
- `GET /addresses`
- `GET /search?q=...`
- `GET /restaurants?q=...`
- `GET /menu/:restaurantId`

OAuth tokens are cached only on the backend. Configure `SWIGGY_REDIRECT_URI` explicitly
for any non-local deployment.

## Utility scripts

```bash
node scripts/generatePriceHistory.js
node scripts/fetchTopPicksImages.js
npm test
```
