const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getFeatureFlags } = require('../../config/featureFlags');

const SWIGGY_AUTH_BASE = process.env.SWIGGY_AUTH_URL || 'https://mcp.swiggy.com/auth';
const TOKEN_FILE_PATH = path.join(__dirname, '../../.swiggy_token.json');

// In-memory PKCE state store: state -> { codeVerifier, redirectUri, createdAt }
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// In-memory token store
let currentToken = null;

// Clean up expired pending states periodically
const pendingStateCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000);
pendingStateCleanupTimer.unref();

/**
 * Load token from disk on startup if exists
 */
function loadTokenFromDisk() {
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE_PATH, 'utf8'));
      if (data && data.access_token && data.expires_at) {
        currentToken = data;
        console.log('[Swiggy OAuth] Loaded existing token from secure local cache.');
      }
    }
  } catch (err) {
    console.error('[Swiggy OAuth] Error reading token cache:', err.message);
  }
}
const startupFlags = getFeatureFlags();
if (startupFlags.swiggy_admin_tools
  || startupFlags.public_live_price_check
  || process.env.LUCKNOW_SYNC_ENABLED === 'true') {
  loadTokenFromDisk();
}

/**
 * Save token to disk
 */
function saveTokenToDisk(tokenObj) {
  try {
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(tokenObj, null, 2), {
      encoding: 'utf8',
      mode: 0o600, // Read/write only for owner
    });
  } catch (err) {
    console.error('[Swiggy OAuth] Error writing token cache:', err.message);
  }
}

/**
 * Generate PKCE code verifier and challenge (RFC 7636)
 */
function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate a cryptographically random CSRF state token
 */
function generateState() {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Register client dynamically if needed (RFC 7591)
 */
async function registerClient(redirectUri) {
  const customClientId = process.env.SWIGGY_CLIENT_ID;
  if (customClientId) {
    return customClientId;
  }

  try {
    const res = await fetch(`${SWIGGY_AUTH_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: 'bhook-food-app',
        redirect_uris: [redirectUri],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.client_id) {
        return data.client_id;
      }
    }
  } catch (err) {
    console.warn('[Swiggy OAuth] DCR fallback warning:', err.message);
  }

  // Standard fallback default from Swiggy DCR
  return 'swiggy-mcp';
}

/**
 * Build the authorization URL for initiating OAuth 2.1 PKCE consent
 */
async function getAuthorizationUrl(redirectUri) {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = generateState();
  const clientId = await registerClient(redirectUri);

  pendingStates.set(state, {
    codeVerifier,
    clientId,
    redirectUri,
    createdAt: Date.now(),
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
    scope: 'mcp:tools',
  });

  return `${SWIGGY_AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Handle OAuth callback: exchange code for access token
 */
async function handleCallback({ code, state, redirectUri }) {
  if (!code || !state) {
    throw new Error('Missing code or state in OAuth callback');
  }

  const stored = pendingStates.get(state);
  if (!stored) {
    throw new Error('Invalid or expired state parameter. CSRF validation failed.');
  }

  // Single-use state verification
  pendingStates.delete(state);

  if (redirectUri && redirectUri !== stored.redirectUri) {
    throw new Error('OAuth callback redirect URI does not match the authorization request');
  }

  const effectiveRedirectUri = stored.redirectUri;

  const payload = {
    grant_type: 'authorization_code',
    code,
    code_verifier: stored.codeVerifier,
    redirect_uri: effectiveRedirectUri,
    client_id: stored.clientId,
  };

  console.log('[Swiggy OAuth] Exchanging authorization code at token endpoint...');

  const tokenRes = await fetch(`${SWIGGY_AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error(`[Swiggy OAuth] Token exchange failed HTTP ${tokenRes.status}`);
    throw new Error(`Token exchange failed (HTTP ${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Token response missing access_token');
  }

  // Token lifetime in seconds (default: 5 days = 432000s)
  const expiresIn = tokenData.expires_in || 432000;
  const expiresAt = Date.now() + expiresIn * 1000;

  currentToken = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type || 'Bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    scope: tokenData.scope || 'mcp:tools',
    received_at: Date.now(),
  };

  saveTokenToDisk(currentToken);
  console.log('[Swiggy OAuth] Access token acquired and saved securely. Lifetime:', expiresIn, 'seconds.');

  return {
    success: true,
    expires_in: expiresIn,
    scope: currentToken.scope,
  };
}

/**
 * Retrieve active access token (returns null if not authenticated or expired)
 */
function getAccessToken() {
  if (!currentToken || !currentToken.access_token) {
    return null;
  }

  // Proactively check expiry: consider token expired if <= 60s remaining
  const now = Date.now();
  if (currentToken.expires_at && now >= currentToken.expires_at - 60000) {
    console.warn('[Swiggy OAuth] Token expired or nearing expiration.');
    return null;
  }

  return currentToken.access_token;
}

/**
 * Get public authentication status without exposing the token
 */
function getAuthStatus() {
  if (!currentToken || !currentToken.access_token) {
    return {
      authenticated: false,
      message: 'Not authenticated. Please authenticate via OAuth flow.',
    };
  }

  const now = Date.now();
  const isExpired = currentToken.expires_at && now >= currentToken.expires_at;
  const remainingSeconds = currentToken.expires_at
    ? Math.max(0, Math.floor((currentToken.expires_at - now) / 1000))
    : 0;

  return {
    authenticated: !isExpired,
    expires_at: currentToken.expires_at ? new Date(currentToken.expires_at).toISOString() : null,
    remaining_seconds: remainingSeconds,
    scope: currentToken.scope,
    message: isExpired ? 'Token expired. Re-authentication required.' : 'Authenticated with Swiggy MCP.',
  };
}

/**
 * Invalidate current token (e.g. on 401 or logout)
 */
function clearToken() {
  currentToken = null;
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      fs.unlinkSync(TOKEN_FILE_PATH);
    }
  } catch (err) {
    console.error('[Swiggy OAuth] Error clearing token cache:', err.message);
  }
  console.log('[Swiggy OAuth] Token cleared.');
}

module.exports = {
  getAuthorizationUrl,
  handleCallback,
  getAccessToken,
  getAuthStatus,
  clearToken,
};
