import test from 'node:test';
import assert from 'node:assert/strict';
import { convertDistance, degreesFromDistance, inLatitudeBand, latitudeMatches, absoluteLatitudeDifference, greatCircle, latitudeLabel, ringAt, normalizeSearch, escapeHtml } from '../src/geo.mjs';

test('unit changes preserve the north/south latitude band', () => {
  const km = convertDistance(100, 'mi', 'km');
  assert.equal(km, 160.9344);
  assert.ok(Math.abs(degreesFromDistance(100, 'mi') - degreesFromDistance(km, 'km')) < 1e-10);
});
test('latitude bands ignore longitude and handle hemisphere boundaries', () => {
  assert.equal(inLatitudeBand({ lat: 41.9, lng: 151 }, 41.9, 0), true);
  assert.equal(inLatitudeBand({ lat: -33.9 }, 33.9, 1), false);
  assert.equal(inLatitudeBand({ lat: -33.9 }, -33.9, 1), true);
  assert.equal(inLatitudeBand({ lat: 0.2 }, -0.2, 0.4), true);
});
test('great-circle calculation handles equator, identical and antipodal cities', () => {
  assert.equal(greatCircle({ lat: 20, lng: 30 }, { lat: 20, lng: 30 }), 0);
  assert.ok(Math.abs(greatCircle({ lat: 0, lng: 0 }, { lat: 0, lng: 90 }) - 10007.54) < .01);
  assert.ok(Number.isFinite(greatCircle({ lat: 45, lng: 0 }, { lat: -45, lng: 180 })));
});
test('ring closes at the dateline and uses a single accurate latitude', () => {
  const ring = ringAt(-33.9);
  assert.equal(ring[0].lng, -180);
  assert.equal(ring.at(-1).lng, 180);
  assert.ok(ring.every((p) => p.lat === -33.9));
  assert.equal(latitudeLabel(0), '0°');
  assert.equal(latitudeLabel(-33.9), '33.90° S');
});
test('search recognizes accents and tooltip data is escaped', () => {
  assert.equal(normalizeSearch('São Paulo'), 'sao paulo');
  assert.equal(escapeHtml('<b>"city"</b>'), '&lt;b&gt;&quot;city&quot;&lt;/b&gt;');
});

test('matches use absolute latitude, show both hemispheres and exclude the selected city', () => {
  const origin = { id: 1, lat: 39, lng: -94, population: 100 };
  const north = { id: 2, lat: 39.2, lng: 20, population: 200 };
  const south = { id: 3, lat: -38.9, lng: 145, population: 300 };
  const unrelated = { id: 4, lat: -33, lng: 100, population: 400 };
  const groups = latitudeMatches([origin, north, south, unrelated], origin, 39, 1, 500);
  assert.deepEqual(groups.same.map((r) => r.city.id), [2]);
  assert.deepEqual(groups.mirror.map((r) => r.city.id), [3]);
  assert.ok(Math.abs(absoluteLatitudeDifference(origin.lat, south.lat) - .1) < 1e-9);
  const flipped = latitudeMatches([origin, north, south], origin, -39, 1, 500);
  assert.deepEqual(flipped.same.map((r) => r.city.id), [3]);
  assert.deepEqual(flipped.mirror.map((r) => r.city.id), [2]);
});

test('great-circle separation excludes nearby cities across the dateline and preserves threshold inclusivity', () => {
  const origin = { id: 1, lat: 0, lng: 179 };
  const neighbor = { id: 2, lat: 0, lng: -179, population: 1 };
  const far = { id: 3, lat: 0, lng: 0, population: 2 };
  assert.deepEqual(latitudeMatches([neighbor, far], origin, 0, 1, 500).same.map((r) => r.city.id), [3]);
  const boundary = greatCircle(origin, neighbor);
  assert.equal(latitudeMatches([neighbor], origin, 0, 1, boundary).same.length, 1);
  assert.equal(latitudeMatches([neighbor], origin, 0, 1, boundary + 1).same.length, 0);
  assert.equal(latitudeMatches([neighbor], origin, 0, 1, 0).same.length, 1);
});

test('near-equator bands do not duplicate matches and scrubbing retains the selected distance origin', () => {
  const origin = { id: 1, lat: 39, lng: 0 };
  const north = { id: 2, lat: .1, lng: 0, population: 2 };
  const south = { id: 3, lat: -.1, lng: 0, population: 1 };
  const groups = latitudeMatches([north, south], origin, 0, 1, 500);
  assert.deepEqual(groups.same.map((r) => r.city.id), [2]);
  assert.deepEqual(groups.mirror.map((r) => r.city.id), [3]);
  assert.ok(groups.same[0].separationKm > 4000);
});
