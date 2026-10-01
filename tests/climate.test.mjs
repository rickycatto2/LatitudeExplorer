import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { koppenType, daylightHours, isValidDate, dayOfYear, dateFromDay } from '../src/climate.mjs';
import { readSharedView, sharedSearch } from '../src/share.mjs';
import { surprisePair } from '../src/surprise.mjs';
import { greatCircle, absoluteLatitudeDifference } from '../src/geo.mjs';
const cities = JSON.parse(fs.readFileSync('public/data/cities.json','utf8'));
test('Köppen classification handles tropical, arid, polar and temperate normals', () => {
  assert.equal(koppenType(Array(12).fill(26),Array(12).fill(100),0),'Af');
  assert.equal(koppenType(Array(12).fill(26),Array(12).fill(0),20),'BWh');
  assert.equal(koppenType(Array(12).fill(-5),Array(12).fill(50),75),'EF');
  assert.equal(koppenType(Array(12).fill(5),Array(12).fill(50),70),'ET');
  assert.equal(koppenType([5,6,8,11,15,18,20,20,17,13,9,6],Array(12).fill(80),45),'Cfb');
  assert.equal(koppenType([NaN],[],0),null);
});
test('dry-season classification respects opposite hemispheres', () => {
  const t = [8,9,12,15,18,21,24,24,21,17,12,9];
  const p = [100,90,80,50,20,5,2,3,10,40,70,90];
  assert.equal(koppenType(t,p,40),'Csa');
  assert.equal(koppenType([...t.slice(6),...t.slice(0,6)],[...p.slice(6),...p.slice(0,6)],-40),'Csa');
});
test('daylight covers hemispheres, equator, polar day/night and leap dates', () => {
  assert.ok(daylightHours(40,'2026-06-21') > 14);
  assert.ok(daylightHours(-40,'2026-06-21') < 10);
  assert.equal(daylightHours(90,'2026-06-21'),24);
  assert.equal(daylightHours(90,'2026-12-21'),0);
  assert.ok(Math.abs(daylightHours(0,'2026-03-21')-12) < .2);
  assert.equal(isValidDate('2026-02-29'),false);
  assert.equal(isValidDate('2024-02-29'),true);
  assert.equal(dayOfYear('2024-12-31'),366);
  assert.equal(dateFromDay(2024,60),'2024-02-29');
  assert.equal(daylightHours(91,'2026-01-01'),null);
});
test('share links round-trip cities, comparison, filters and daylight date', () => {
  const view = {selected:cities[0],compare:cities[1],latitude:-30,unit:'km',distance:150,minimumSeparationKm:900,population:100000,mirror:true,resultsMode:'all',layer:'daylight',date:'2024-02-29'};
  assert.deepEqual(readSharedView(sharedSearch(view),cities),view);
  const invalid = readSharedView('?city=oops&compare=oops&lat=999&separation=-1&date=2026-02-29',cities);
  assert.equal(invalid.selected.name,'Chicago'); assert.equal(invalid.compare,null); assert.equal(invalid.minimumSeparationKm,500); assert.equal(invalid.date,null);
  assert.ok(!sharedSearch({...view,layer:'climate'}).includes('date='));
  assert.equal(readSharedView(`?city=${cities[0].id}&compare=${cities[0].id}`,cities).compare,null);
});
test('surprise respects latitude and actual distance filters', () => {
  let seed = 42; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i=0;i<15;i++) { const [a,b] = surprisePair(cities,1.5,500,random); assert.notEqual(a.id,b.id); assert.ok(absoluteLatitudeDifference(a.lat,b.lat)<=1.5); assert.ok(greatCircle(a,b)>=500); }
  assert.equal(surprisePair([cities[0]],0,20000),null);
});
test('static climate covers every city with valid monthly series and provenance', () => {
  const data = JSON.parse(fs.readFileSync('public/data/climate.json','utf8'));
  assert.equal(Object.keys(data.records).length,cities.length);
  assert.equal(data.metadata.missing,0);
  for (const city of cities) { const r=data.records[city.id]; assert.equal(r.temperature.length,12); assert.equal(r.precipitation.length,12); assert.ok(r.temperature.every(Number.isFinite)); assert.ok(r.precipitation.every((v)=>Number.isFinite(v)&&v>=0)); assert.ok(r.koppen); assert.ok(Number.isFinite(r.coastKm)); }
});
