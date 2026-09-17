import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findNearestArea,
  haversineDistanceKm,
  isLocationAccurateEnough,
} from './location.js';

test('haversine distance is zero for the same coordinates', () => {
  const point = { latitude: 26.85, longitude: 80.95 };
  assert.equal(haversineDistanceKm(point, point), 0);
});

test('findNearestArea selects the closest fixed area', () => {
  const areas = [
    { slug: 'west', latitude: 26.84, longitude: 80.90 },
    { slug: 'east', latitude: 26.86, longitude: 81.01 },
  ];
  const nearest = findNearestArea(
    { latitude: 26.859, longitude: 81.009 },
    areas,
  );

  assert.equal(nearest.area.slug, 'east');
  assert.ok(nearest.distanceKm < 1);
});

test('findNearestArea handles an empty area list', () => {
  assert.equal(findNearestArea({ latitude: 0, longitude: 0 }, []), null);
});

test('a position at BBD selects Uttardhona instead of Rajajipuram', () => {
  const areas = [
    { slug: 'rajajipuram', latitude: 26.84524, longitude: 80.87919 },
    { slug: 'uttardhona', latitude: 26.88871, longitude: 81.05894 },
    { slug: 'anora-kala', latitude: 26.8981, longitude: 81.0856 },
  ];
  const nearest = findNearestArea(
    { latitude: 26.88871, longitude: 81.05894 },
    areas,
  );

  assert.equal(nearest.area.slug, 'uttardhona');
  assert.equal(nearest.distanceKm, 0);
  assert.ok(haversineDistanceKm(areas[0], areas[1]) > 18);
});

test('auto-selection rejects a coarse location reading', () => {
  assert.equal(isLocationAccurateEnough(25), true);
  assert.equal(isLocationAccurateEnough(3000), true);
  assert.equal(isLocationAccurateEnough(3001), false);
  assert.equal(isLocationAccurateEnough(Number.NaN), false);
});
