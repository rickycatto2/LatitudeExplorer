import { latitudeMatches } from './geo.mjs';
import { rankMatches, diversifyByCountry } from './ranking.mjs';

// Country-neutral sampling: choose a country, then a prominent anchor in it.
// Eligibility stays in geo.mjs; never silently loosen the user's filters.
export function surprisePair(cities, tolerance, separation, random = Math.random, previous = []) {
  const groups = new Map();
  for (const city of cities) {
    if (city.population < 100000) continue;
    if (!groups.has(city.countryCode)) groups.set(city.countryCode, []);
    groups.get(city.countryCode).push(city);
  }
  const countries = [...groups.values()];
  const pick = (rows) => rows[Math.min(rows.length - 1, Math.floor(random() * rows.length))];
  for (let attempt = 0; attempt < 100 && countries.length; attempt++) {
    const anchor = pick(pick(countries));
    const matches = latitudeMatches(cities, anchor, anchor.lat, tolerance, separation);
    const kinds = Object.values(matches).map((rows) => rows.filter(({city}) => city.countryCode !== anchor.countryCode && city.population >= 100000)).filter((rows) => rows.length);
    if (!kinds.length) continue;
    const pool = diversifyByCountry(rankMatches(pick(kinds), anchor.lat, tolerance)).slice(0, 12);
    const other = pick(pool).city;
    if (previous.includes(anchor.id) && previous.includes(other.id)) continue;
    return [anchor, other];
  }
  // Sparse pools (including small settlements) still get a deterministic fallback.
  for (const anchor of cities) {
    const matches = latitudeMatches(cities, anchor, anchor.lat, tolerance, separation);
    const rows = [...matches.same, ...matches.mirror];
    if (rows.length) return [anchor, rankMatches(rows, anchor.lat, tolerance)[0].city];
  }
  return null;
}
