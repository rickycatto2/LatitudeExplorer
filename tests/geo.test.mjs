import test from 'node:test';
import assert from 'node:assert/strict';
import { convertDistance, degreesFromDistance, inLatitudeBand, greatCircle, latitudeLabel, ringAt, normalizeSearch, escapeHtml } from '../src/geo.mjs';

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
