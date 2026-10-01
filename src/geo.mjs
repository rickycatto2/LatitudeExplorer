// Mean meridional distance on a spherical Earth. These are approximate, not routing distances.
export const KM_PER_DEGREE = 111.195;
export const KM_PER_MILE = 1.609344;
export const MI_PER_DEGREE = KM_PER_DEGREE / KM_PER_MILE;
export const degreesFromDistance = (distance, unit) => distance / (unit === 'mi' ? MI_PER_DEGREE : KM_PER_DEGREE);
export const convertDistance = (distance, from, to) => from === to ? distance : from === 'mi' ? distance * KM_PER_MILE : distance / KM_PER_MILE;
export const inLatitudeBand = (city, latitude, tolerance) => Math.abs(city.lat - latitude) <= tolerance + 1e-9;
export const absoluteLatitudeDifference = (a, b) => Math.abs(Math.abs(a) - Math.abs(b));

// Distance is measured from the selected city, even while the latitude band is scrubbed.
// Group by hemisphere so overlapping bands near the equator never duplicate a city.
export function latitudeMatches(cities, origin, latitude, tolerance, minimumSeparationKm) {
  const groups = { same: [], mirror: [] };
  if (!origin) return groups;
  for (const city of cities) {
    if (city.id === origin.id || absoluteLatitudeDifference(city.lat, latitude) > tolerance + 1e-9) continue;
    const separationKm = greatCircle(origin, city);
    if (separationKm + 1e-9 < minimumSeparationKm) continue;
    const sameHemisphere = (city.lat >= 0) === (latitude >= 0);
    groups[sameHemisphere ? 'same' : 'mirror'].push({ city, separationKm });
  }
  return groups;
}

export function latitudeLabel(lat, precision = 2) {
  if (Math.abs(lat) < 0.005) return '0°';
  return `${Math.abs(lat).toFixed(precision)}° ${lat > 0 ? 'N' : 'S'}`;
}

export function greatCircle(a, b) {
  const toRad = (v) => v * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function ringAt(lat) {
  return Array.from({ length: 361 }, (_, index) => ({ lat, lng: -180 + index }));
}

export const normalizeSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
