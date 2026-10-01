import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rankMatches, scoreMatch, diversifyByCountry } from '../src/ranking.mjs';
import { latitudeMatches, degreesFromDistance } from '../src/geo.mjs';

const match = (id, countryCode, lat = 39, population = 1000000) => ({ city: { id, countryCode, lat, population }, separationKm: 5000 });

test('base ranking rewards latitude closeness and population without country weighting', () => {
  const exact = match(1, 'AA');
  const edge = match(2, 'BB', 40);
  const smaller = match(3, 'CC', 39, 10000);
  assert.ok(scoreMatch(exact, 39, 1) > scoreMatch(edge, 39, 1));
  assert.ok(scoreMatch(exact, 39, 1) > scoreMatch(smaller, 39, 1));
  assert.equal(scoreMatch(exact, 39, 1), scoreMatch(match(1, 'ZZ'), 39, 1));
  assert.equal(scoreMatch(exact, 39, 1), scoreMatch(match(1, 'AA', -39), 39, 1));
  assert.ok(Number.isFinite(scoreMatch(exact, 39, 0)));
  assert.deepEqual(rankMatches([edge, exact], 39, 1).map((r) => r.city.id), [1, 2]);
});

test('country rounds take the best from each country before any second city', () => {
  const ranked = [match(1, 'AA'), match(2, 'AA'), match(3, 'AA'), match(4, 'BB'), match(5, 'BB'), match(6, 'CC')];
  const discovered = diversifyByCountry(ranked);
  assert.deepEqual(discovered.map((r) => r.city.id), [1, 4, 6, 2, 5, 3]);
  assert.deepEqual(ranked.map((r) => r.city.id), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(discovered.map((r) => r.city.id)).size, ranked.length);
  const renamed = ranked.map((r) => ({ ...r, city: { ...r.city, countryCode: `renamed-${r.city.countryCode}` } }));
  assert.deepEqual(diversifyByCountry(renamed).map((r) => r.city.id), discovered.map((r) => r.city.id));
});

test('first ten limit each country to two when enough qualifying countries can fill them', () => {
  const ranked = ['AA', 'BB', 'CC', 'DD', 'EE'].flatMap((country, index) => Array.from({ length: 5 }, (_, n) => match(index * 5 + n, country)));
  const firstTen = diversifyByCountry(ranked).slice(0, 10);
  for (const country of ['AA', 'BB', 'CC', 'DD', 'EE']) assert.equal(firstTen.filter((r) => r.city.countryCode === country).length, 2);
});

test('sparse and single-country pools fill naturally without discarding matches', () => {
  assert.deepEqual(diversifyByCountry([]), []);
  const ranked = [match(1, 'AA'), match(2, 'AA'), match(3, 'AA')];
  assert.deepEqual(diversifyByCountry(ranked), ranked);
  assert.deepEqual(diversifyByCountry([...ranked, match(4, 'BB')]).map((r) => r.city.id), [1, 4, 2, 3]);
});

test('real Chicago discovery diversifies both groups without changing eligibility or the All matches ranking', () => {
  const cities = JSON.parse(fs.readFileSync(new URL('../public/data/cities.json', import.meta.url)));
  const origin = cities.find((city) => city.name === 'Chicago');
  const groups = latitudeMatches(cities, origin, origin.lat, degreesFromDistance(100, 'mi'), 500);
  for (const group of Object.values(groups)) {
    const base = rankMatches(group, origin.lat, degreesFromDistance(100, 'mi'));
    const discovered = diversifyByCountry(base);
    assert.deepEqual(new Set(discovered.map((r) => r.city.id)), new Set(base.map((r) => r.city.id)));
    assert.ok(discovered.every((r) => r.separationKm >= 500));
    const countryCount = new Set(group.map((r) => r.city.countryCode)).size;
    assert.equal(new Set(discovered.slice(0, countryCount).map((r) => r.city.countryCode)).size, countryCount);
    for (let i = 1; i < base.length; i++) assert.ok(scoreMatch(base[i - 1], origin.lat, degreesFromDistance(100, 'mi')) >= scoreMatch(base[i], origin.lat, degreesFromDistance(100, 'mi')));
  }
});
