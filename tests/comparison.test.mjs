import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonMetrics, latitudePaths } from '../src/comparison.mjs';
import { readSharedView, sharedSearch } from '../src/share.mjs';
const a = {id:1,name:'Kansas City',lat:39.1,lng:-94.58};
const b = {id:2,name:'Melbourne',lat:-37.81,lng:144.96};
test('equator is a single permanent closed 0-degree ring independent of exploration state', () => {
  for (const primary of [null,a,{...a,lat:0}]) for (const comparison of [null,b]) for (const mirror of [true,false]) for (const band of [-60,0,39.1,75]) {
    const equators = latitudePaths(primary,comparison,band,1,mirror).filter(p=>p.kind==='equator');
    assert.equal(equators.length,1);
    assert.equal(equators[0].points.length,361);
    assert.ok(equators[0].points.every(point=>point.lat===0));
    assert.equal(equators[0].points[0].lng,-180);
    assert.equal(equators[0].points.at(-1).lng,180);
  }
});
test('mirrored relationship uses absolute latitude, not signed difference or longitude', () => {
  const m = comparisonMetrics(a,b);
  assert.equal(m.mirrored,true); assert.ok(Math.abs(m.difference-1.29)<1e-10);
  assert.ok(Math.abs(m.northSouthKm-143.44)<1); assert.ok(m.geographicKm>14000);
  assert.equal(comparisonMetrics(a,{...b,lng:0}).northSouthKm,m.northSouthKm);
  assert.equal(comparisonMetrics(a,{...b,lat:39.1}).difference,0);
});
test('comparison rings retain actual city latitudes when scrubbing and mirror is off', () => {
  for (const mirror of [true,false]) {
    const paths = latitudePaths(a,b,30,1,mirror);
    assert.equal(paths.find(p=>p.kind==='selected').points[0].lat,a.lat);
    assert.equal(paths.find(p=>p.kind==='comparison').points[0].lat,b.lat);
    assert.ok(!paths.some(p=>p.kind==='mirror'));
  }
  assert.equal(latitudePaths(a,null,30,1,true).find(p=>p.kind==='mirror').points[0].lat,-30);
  assert.ok(!latitudePaths(a,null,30,1,false).some(p=>p.kind==='mirror'));
});
test('mirror defaults on, session fallback is honored, and shared state wins', () => {
  assert.equal(readSharedView('',[a,b]).mirror,true);
  assert.equal(readSharedView('',[a,b],false).mirror,false);
  assert.equal(readSharedView('?mirror=1',[a,b],false).mirror,true);
  const view=readSharedView('?city=1&compare=2&mirror=0',[a,b]);
  assert.equal(view.mirror,false); assert.equal(view.selected.id,1); assert.equal(view.compare.id,2);
  assert.equal(readSharedView(sharedSearch(view),[a,b]).mirror,false);
});
