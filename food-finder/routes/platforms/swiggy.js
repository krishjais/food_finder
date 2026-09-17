const express = require('express');
const router = express.Router();
const {
  getAuthorizationUrl,
  handleCallback,
  getAuthStatus,
  clearToken,
} = require('../../services/swiggy/swiggyOAuth');
const {
  searchMenu,
  searchRestaurants,
  getRestaurantMenu,
  getAddresses,
} = require('../../services/swiggy/swiggyAdapter');

/**
 * Determine default callback URI based on incoming request
 */
function getCallbackUri(req) {
  const custom = process.env.SWIGGY_REDIRECT_URI;
  if (custom) return custom;

  const port = process.env.PORT || 5000;
  return `http://localhost:${port}/api/platforms/swiggy/auth/callback`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * GET /api/platforms/swiggy/auth/login
 * Starts OAuth 2.1 + PKCE flow.
 * Optional query: ?redirect=true to trigger 302 browser redirect.
 */
router.get('/auth/login', async (req, res, next) => {
  try {
    const redirectUri = getCallbackUri(req);
    const authUrl = await getAuthorizationUrl(redirectUri);

    if (req.query.redirect === 'true' || req.query.redirect === '1') {
      return res.redirect(authUrl);
    }

    return res.status(200).json({
      auth_url: authUrl,
      redirect_uri: redirectUri,
      message: 'Open the auth_url in your browser to complete Swiggy phone + OTP authentication.',
    });
  } catch (err) {
    console.error('[Swiggy Route] Login error:', err);
    return next(err);
  }
});

/**
 * GET /api/platforms/swiggy/auth/callback
 * Handles OAuth callback from Swiggy consent screen.
 */
router.get('/auth/callback', async (req, res, next) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Swiggy Authentication Failed</title><style>body{font-family:sans-serif;padding:40px;text-align:center;background:#fef2f2;color:#991b1b;}</style></head>
        <body>
          <h2>Swiggy Authentication Failed</h2>
          <p>${escapeHtml(error)}: ${escapeHtml(error_description || 'Authorization denied or cancelled.')}</p>
          <a href="/api/platforms/swiggy/auth/login?redirect=true">Try Again</a>
        </body>
        </html>
      `);
    }

    const redirectUri = getCallbackUri(req);
    await handleCallback({ code, state, redirectUri });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Swiggy Connected - BHOOK</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff7ed; color: #7c2d12; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 36px 48px; border-radius: 24px; box-shadow: 0 10px 30px rgba(234, 88, 12, 0.1); text-align: center; max-width: 480px; border: 1px solid #fed7aa; }
          h1 { font-size: 24px; margin-bottom: 12px; color: #ea580c; }
          p { font-size: 14px; color: #57534e; line-height: 1.6; }
          .badge { display: inline-block; background: #ffedd5; color: #c2410c; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 12px; margin-bottom: 16px; }
          .btn { display: inline-block; margin-top: 20px; padding: 10px 24px; background: #ea580c; color: white; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Swiggy MCP OAuth 2.1</div>
          <h1>Successfully Connected!</h1>
          <p>Your Swiggy account has been securely linked to BHOOK. Access tokens are stored on the backend and will never be exposed to the client.</p>
          <a class="btn" href="${escapeHtml(frontendUrl)}">Return to BHOOK App</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[Swiggy Route] Callback exchange error:', err);
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>OAuth Exchange Error</title><style>body{font-family:sans-serif;padding:40px;text-align:center;background:#fff1f2;color:#be123c;}</style></head>
      <body>
        <h2>Authentication Failed</h2>
        <p>${escapeHtml(err.message)}</p>
        <p><a href="/api/platforms/swiggy/auth/login?redirect=true">Restart Authorization</a></p>
      </body>
      </html>
    `);
  }
});

/**
 * GET /api/platforms/swiggy/auth/status
 * Public authentication status (without token exposure)
 */
router.get('/auth/status', (req, res) => {
  const status = getAuthStatus();
  return res.status(200).json(status);
});

/**
 * POST /api/platforms/swiggy/auth/logout
 * Clears the current locally cached session on the backend
 */
router.post('/auth/logout', (req, res) => {
  clearToken();
  return res.status(200).json({
    success: true,
    message: 'Locally cached Swiggy MCP session cleared.',
  });
});

/**
 * GET /api/platforms/swiggy/addresses
 * Fetches user's saved Swiggy delivery addresses
 */
router.get('/addresses', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.page_size, 10) || 10;
    const data = await getAddresses({ page, pageSize });
    return res.status(200).json(data);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});

/**
 * GET /api/platforms/swiggy/search?q=paneer+pizza
 * Primary Bhook integration endpoint:
 * Calls Swiggy Food MCP search_menu, normalizes responses to Bhook's unified schema.
 */
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q || req.query.query || req.query.dish;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        error: 'Missing required query parameter "q" (e.g. ?q=paneer+pizza)',
      });
    }

    const addressId = req.query.address_id || req.query.addressId;
    const veg = req.query.veg !== undefined ? req.query.veg : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    const restaurantIdOfAddedItem = req.query.restaurant_id || req.query.restaurantId;

    const result = await searchMenu({
      query: query.trim(),
      addressId,
      restaurantIdOfAddedItem,
      vegFilter: veg,
      offset,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        platform: 'swiggy',
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Swiggy Route] Search error:', err);
    return next(err);
  }
});

/**
 * GET /api/platforms/swiggy/restaurants?q=biryani
 * Search restaurants via Swiggy MCP
 */
router.get('/restaurants', async (req, res, next) => {
  try {
    const query = req.query.q || req.query.query;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        error: 'Missing required query parameter "q"',
      });
    }

    const addressId = req.query.address_id || req.query.addressId;
    const collection = req.query.collection;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

    const result = await searchRestaurants({
      query: query.trim(),
      addressId,
      collection,
      offset,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        platform: 'swiggy',
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Swiggy Route] Restaurant search error:', err);
    return next(err);
  }
});

/**
 * GET /api/platforms/swiggy/menu/:restaurantId
 * Get complete menu for a restaurant via Swiggy MCP
 */
router.get('/menu/:restaurantId', async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const addressId = req.query.address_id || req.query.addressId;

    const result = await getRestaurantMenu({
      restaurantId,
      addressId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        platform: 'swiggy',
        error: err.message,
        code: err.code,
      });
    }
    console.error('[Swiggy Route] Menu fetch error:', err);
    return next(err);
  }
});

module.exports = router;
