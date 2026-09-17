function enabled(name, developmentDefault = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return process.env.NODE_ENV !== 'production' && developmentDefault;
  }
  return raw === 'true';
}

function getFeatureFlags() {
  return {
    swiggy_admin_tools: enabled('ENABLE_SWIGGY_ADMIN_TOOLS', true),
    public_live_price_check: enabled('ENABLE_PUBLIC_LIVE_PRICE_CHECK', true),
  };
}

module.exports = { enabled, getFeatureFlags };
