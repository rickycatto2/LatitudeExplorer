// Editorial pairings only. GeoNames IDs resolve the existing records; no coordinates here.
export const CURATED_PAIRS = [
  [4180439,3369157], // Atlanta / Cape Town
  [5368361,276781], // Los Angeles / Beirut
  [5128581,3117735], // New York City / Madrid, Spain
  [5128581,3169070], // New York City / Rome
  [5913490,2643743], // Calgary / London, UK
  [5809844,2988507], // Seattle / Paris
  [4641239,1850147], // Memphis / Tokyo
  [5391959,2267057], // San Francisco / Lisbon
  [4393217,2158177], // Kansas City, Missouri / Melbourne
  [3871336,3369157], // Santiago, Chile / Cape Town
  [3435910,2147714], // Buenos Aires / Sydney
  [3369157,5368361], // Cape Town / Los Angeles
];

export function resolveCuratedPairs(cities) {
  const byId = new Map(cities.map(city => [city.id,city]));
  return CURATED_PAIRS.map(([a,b]) => [byId.get(a),byId.get(b)]).filter(pair => pair.every(Boolean));
}
