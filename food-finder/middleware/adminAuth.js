const crypto = require('crypto');

function safeEqual(first, second) {
  const firstBuffer = Buffer.from(String(first || ''));
  const secondBuffer = Buffer.from(String(second || ''));
  return firstBuffer.length === secondBuffer.length
    && crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function requireAdminApiKey(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) {
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(503).json({ error: 'Admin tools are not configured.' });
  }

  const authorization = String(req.get('authorization') || '');
  const bearerKey = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  const suppliedKey = req.get('x-admin-api-key') || bearerKey;
  if (!safeEqual(suppliedKey, configuredKey)) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  return next();
}

module.exports = { requireAdminApiKey };
