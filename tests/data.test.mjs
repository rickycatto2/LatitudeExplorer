import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { latitudeMatches, degreesFromDistance } from '../src/geo.mjs';

const cities = JSON.parse(fs.readFileSync(new URL('../public/data/cities.json', import.meta.url)));
const boundaries = JSON.parse(fs.readFileSync(new URL('../public/data/countries.geojson', import.meta.url)));

test('shipped cities have unique identities and valid geographic coordinates', () => {
  assert.equal(cities.length, 5000);
  assert.equal(new Set(cities.map((c) => c.id)).size, cities.length);
  for (const city of cities) {
    assert.ok(city.name && city.countryCode.length === 2 && city.timezone);
    assert.ok(Number.isFinite(city.lat) && Math.abs(city.lat) <= 90);
    assert.ok(Number.isFinite(city.lng) && Math.abs(city.lng) <= 180);
    assert.ok(city.population > 0);
    assert.ok(city.elevation === null || Number.isFinite(city.elevation));
  }
});
test('known cities are in their real hemispheres', () => {
  const chicago = cities.find((c) => c.name === 'Chicago');
  const sydney = cities.find((c) => c.name === 'Sydney' && c.countryCode === 'AU');
  assert.ok(chicago.lat > 41 && chicago.lat < 42 && chicago.lng < -87 && chicago.lng > -88);
  assert.ok(sydney.lat < -33 && sydney.lat > -34 && sydney.lng > 151 && sydney.lng < 152);
});
test('country geometry includes real polygon features and is compact', () => {
  assert.equal(boundaries.type, 'FeatureCollection');
  assert.ok(boundaries.features.length > 170);
  assert.ok(boundaries.features.every((f) => ['Polygon', 'MultiPolygon'].includes(f.geometry.type)));
  assert.ok(fs.statSync(new URL('../public/data/countries.geojson', import.meta.url)).size < 500000);
});

test('Kansas City discovers Melbourne by mirrored latitude with the default separation filter', () => {
  const origin = cities.find((c) => c.name === 'Kansas City' && c.countryCode === 'US');
  assert.ok(origin);
  const matches = latitudeMatches(cities, origin, origin.lat, degreesFromDistance(100, 'mi'), 500);
  const melbourne = matches.mirror.find((r) => r.city.name === 'Melbourne' && r.city.countryCode === 'AU');
  assert.ok(melbourne);
  assert.ok(melbourne.separationKm > 10000);
  assert.ok(matches.same.every((r) => r.separationKm >= 500));
  assert.ok(![...matches.same, ...matches.mirror].some((r) => r.city.id === origin.id));
});
