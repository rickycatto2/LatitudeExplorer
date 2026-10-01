import { absoluteLatitudeDifference, greatCircle, KM_PER_DEGREE, ringAt } from './geo.mjs';

export const CITY_COLORS = { primary: '#ffb86b', comparison: '#86bfff' };

export function comparisonMetrics(a, b) {
  const mirrored = a.lat * b.lat < 0;
  const difference = mirrored ? absoluteLatitudeDifference(a.lat, b.lat) : Math.abs(a.lat - b.lat);
  return { mirrored, difference, northSouthKm: difference * KM_PER_DEGREE, geographicKm: greatCircle(a, b) };
}

export function latitudePaths(selected, compare, latitude, tolerance, mirror) {
  if (!selected) return [];
  const paths = [{ kind: 'selected', points: ringAt(compare ? selected.lat : latitude) }];
  if (compare) paths.push({ kind: 'comparison', points: ringAt(compare.lat) });
  else if (mirror) paths.push({ kind: 'mirror', points: ringAt(-latitude) });
  paths.push({ kind: 'band', points: ringAt(Math.min(90, latitude + tolerance)) },
    { kind: 'band', points: ringAt(Math.max(-90, latitude - tolerance)) });
  if (compare && Math.abs(latitude - selected.lat) > .025) paths.push({ kind: 'scrub', points: ringAt(latitude) });
  return paths;
}
