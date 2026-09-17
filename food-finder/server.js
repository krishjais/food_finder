const express = require("express");
const cors = require("cors");
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
require("dotenv").config();

const pool = require("./db");
const searchRouter = require("./routes/search");
const topPicksRouter = require("./routes/topPicks");
const priceTrendRouter = require("./routes/priceTrend");
const swiggyRouter = require("./routes/platforms/swiggy");
const locationRouter = require("./routes/locations");
const finalPriceRouter = require("./routes/finalPrice");
const { startLucknowSyncScheduler } = require("./services/lucknow/lucknowSyncService");
const { getFeatureFlags } = require('./config/featureFlags');
const { requireAdminApiKey } = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 5000;
const featureFlags = getFeatureFlags();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  // This service returns JSON plus a small OAuth callback page with inline
  // styles. The public React site sets its own browser-facing headers.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include curl, health checks, and
    // same-origin server traffic.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
}));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please retry shortly.' },
});
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Search rate limit reached. Please retry shortly.' },
});
const livePriceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Live price-check limit reached. Please retry in a minute.' },
});

// Parse incoming JSON payloads
app.use(express.json());
app.use('/api', apiLimiter);

/**
 * Health check endpoint
 * GET /api/health
 * Confirms both server and MySQL database connection are alive.
 */
app.get("/api/health", async (req, res) => {
  try {
    // Ping the database to ensure connection is healthy
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    return res.status(500).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

app.get('/api/config', (req, res) => {
  res.status(200).json({
    city: 'Lucknow',
    capabilities: {
      live_price_check: featureFlags.public_live_price_check,
    },
  });
});

// Search routes
app.use("/api/search", searchLimiter, searchRouter);

// Top picks routes (homepage — no dish filter, best item per restaurant)
app.use("/api/top-picks", topPicksRouter);

// Price trend & prediction routes
app.use("/api/price-trend", priceTrendRouter);

// Swiggy Builders Club MCP Platform routes
app.use('/api/platforms/swiggy', (req, res, next) => {
  if (!featureFlags.swiggy_admin_tools) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  // OAuth providers must reach the callback without a custom admin header.
  if (req.path === '/auth/callback') return next();
  return requireAdminApiKey(req, res, next);
}, swiggyRouter);

// Public fixed-area metadata and on-demand final-price checks
app.use("/api/locations", locationRouter);
app.use('/api/final-price', livePriceLimiter, (req, res, next) => {
  if (!featureFlags.public_live_price_check) {
    return res.status(404).json({ error: 'Live price verification is disabled.' });
  }
  return next();
}, finalPriceRouter);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  const statusCode = err.message === 'Origin not allowed by CORS' ? 403 : 500;
  res.status(statusCode).json({
    error: "Internal server error",
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Food Finder server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(
    `Search endpoint: http://localhost:${PORT}/api/search?dish=pizza`,
  );
  console.log(
    `Top picks endpoint: http://localhost:${PORT}/api/top-picks?limit=8`,
  );
  startLucknowSyncScheduler();
});
