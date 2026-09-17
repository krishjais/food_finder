const LUCKNOW_AREAS = Object.freeze([
  { slug: 'rajajipuram', name: 'Rajajipuram', latitude: 26.84524, longitude: 80.87919 },
  { slug: 'uttardhona', name: 'Uttardhona (BBD)', latitude: 26.88871, longitude: 81.05894 },
  { slug: 'manas-nagar', name: 'Manas Nagar', latitude: 26.79017, longitude: 80.87998 },
  { slug: 'anora-kala', name: 'Anora Kala', latitude: 26.8981, longitude: 81.0856 },
  { slug: 'aliganj', name: 'Aliganj', latitude: 26.90515, longitude: 80.94799 },
  { slug: 'gomti-nagar', name: 'Gomti Nagar', latitude: 26.85288, longitude: 80.99885 },
  { slug: 'hazratganj', name: 'Hazratganj', latitude: 26.84756, longitude: 80.94314 },
  { slug: 'indira-nagar', name: 'Indira Nagar', latitude: 26.88232, longitude: 80.99003 },
  { slug: 'aminabad', name: 'Aminabad', latitude: 26.8468, longitude: 80.92637 },
  { slug: 'chowk', name: 'Chowk', latitude: 26.86772, longitude: 80.90421 },
]);

function getLucknowArea(slug) {
  return LUCKNOW_AREAS.find((area) => area.slug === slug) || null;
}

function getConfiguredAddressIds() {
  const raw = process.env.LUCKNOW_AREA_ADDRESS_IDS;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    throw new Error(`LUCKNOW_AREA_ADDRESS_IDS must be valid JSON: ${error.message}`);
  }
}

function getAreaAddressId(slug) {
  const area = getLucknowArea(slug);
  if (!area) return null;
  const ids = getConfiguredAddressIds();
  const value = ids[slug];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

module.exports = {
  LUCKNOW_AREAS,
  getLucknowArea,
  getConfiguredAddressIds,
  getAreaAddressId,
};
