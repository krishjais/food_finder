const EARTH_RADIUS_KM = 6371;
export const MAX_AUTO_SELECT_ACCURACY_METERS = 3000;

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

export function haversineDistanceKm(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude)
      * Math.cos(secondLatitude)
      * Math.sin(longitudeDelta / 2) ** 2
  );
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

export function findNearestArea(position, areas) {
  if (!position || !Array.isArray(areas) || !areas.length) return null;

  return areas.reduce((nearest, area) => {
    const distanceKm = haversineDistanceKm(position, area);
    if (!nearest || distanceKm < nearest.distanceKm) {
      return { area, distanceKm };
    }
    return nearest;
  }, null);
}

export function isLocationAccurateEnough(
  accuracyMeters,
  maximumAccuracyMeters = MAX_AUTO_SELECT_ACCURACY_METERS,
) {
  return Number.isFinite(accuracyMeters)
    && accuracyMeters >= 0
    && accuracyMeters <= maximumAccuracyMeters;
}
