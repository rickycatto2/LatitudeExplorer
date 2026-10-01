import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CURATED_PAIRS,resolveCuratedPairs } from '../src/curated.mjs';
import { comparisonMetrics,latitudePaths } from '../src/comparison.mjs';
import { readSharedView,sharedSearch } from '../src/share.mjs';
const cities = JSON.parse(fs.readFileSync('public/data/cities.json','utf8'));
const climate = JSON.parse(fs.readFileSync('public/data/climate.json','utf8'));
test('all twelve editorial pairs resolve exact existing city records in the requested order', () => {
  const expected = [['Atlanta','US','Cape Town','ZA'],['Los Angeles','US','Beirut','LB'],['New York City','US','Madrid','ES'],['New York City','US','Rome','IT'],['Calgary','CA','London','GB'],['Seattle','US','Paris','FR'],['Memphis','US','Tokyo','JP'],['San Francisco','US','Lisbon','PT'],['Kansas City','US','Melbourne','AU'],['Santiago','CL','Cape Town','ZA'],['Buenos Aires','AR','Sydney','AU'],['Cape Town','ZA','Los Angeles','US']];
  const pairs=resolveCuratedPairs(cities);
  assert.equal(CURATED_PAIRS.length,12); assert.equal(pairs.length,12);
  assert.deepEqual(pairs.map(([a,b])=>[a.name,a.countryCode,b.name,b.countryCode]),expected);
  for (const [a,b] of pairs) { assert.equal(a,cities.find(c=>c.id===a.id)); assert.equal(b,cities.find(c=>c.id===b.id)); assert.ok(climate.records[a.id].temperature); assert.ok(climate.records[b.id].temperature); }
});
test('curated pair calculations, rings and share restoration reuse comparison logic', () => {
  for(const [selected,compare] of resolveCuratedPairs(cities)) {
    const view={...readSharedView('',cities),selected,compare,latitude:selected.lat};
    const restored=readSharedView(sharedSearch(view),cities);
    assert.equal(restored.selected.id,selected.id); assert.equal(restored.compare.id,compare.id);
    const metrics=comparisonMetrics(selected,compare);
    assert.ok(Math.abs(metrics.difference-Math.abs(Math.abs(selected.lat)-Math.abs(compare.lat)))<1e-9);
    const paths=latitudePaths(selected,compare,selected.lat,1.5,true);
    assert.equal(paths.find(p=>p.kind==='selected').points[0].lat,selected.lat);
    assert.equal(paths.find(p=>p.kind==='comparison').points[0].lat,compare.lat);
    assert.equal(paths.find(p=>p.kind==='equator').points[0].lat,0);
  }
  assert.deepEqual(resolveCuratedPairs([]),[]);
});
