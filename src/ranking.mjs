import { absoluteLatitudeDifference } from './geo.mjs';

// Country never enters the base score. Separation is an eligibility filter in geo.mjs.
// Keep prominence isolated so a future notability signal can replace or supplement population.
export const RANKING_WEIGHTS = Object.freeze({ latitude: 0.65, prominence: 0.35 });
export const populationProminence = (population) => Math.min(1, Math.log10(Math.max(1, population)) / 8);

export function scoreMatch(match, latitude, tolerance) {
  const difference = absoluteLatitudeDifference(match.city.lat, latitude);
  const closeness = tolerance > 0 ? Math.max(0, 1 - difference / tolerance) : difference <= 1e-9 ? 1 : 0;
  return RANKING_WEIGHTS.latitude * closeness + RANKING_WEIGHTS.prominence * populationProminence(match.city.population);
}

export function rankMatches(matches, latitude, tolerance) {
  return matches.map((match) => ({ match, score: scoreMatch(match, latitude, tolerance) }))
    .sort((a, b) => b.score - a.score
      || absoluteLatitudeDifference(a.match.city.lat, latitude) - absoluteLatitudeDifference(b.match.city.lat, latitude)
      || b.match.city.population - a.match.city.population
      || a.match.city.id - b.match.city.id)
    .map(({ match }) => match);
}

// Round one takes each country's best match, round two takes each second match, etc.
// Within a round, preserve the base ranking. Every country follows the same rule.
// When at least five countries have enough matches, the first ten contain at most
// two per country; sparse pools naturally fill from the remaining countries.
export function diversifyByCountry(rankedMatches) {
  const occurrences = new Map();
  return rankedMatches.map((match, index) => {
    const country = match.city.countryCode;
    const round = occurrences.get(country) || 0;
    occurrences.set(country, round + 1);
    return { match, index, round };
  }).sort((a, b) => a.round - b.round || a.index - b.index)
    .map(({ match }) => match);
}
