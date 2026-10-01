export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const CLIMATE_NAMES = {
  Af: 'Tropical rainforest', Am: 'Tropical monsoon', Aw: 'Tropical savanna, dry winter', As: 'Tropical savanna, dry summer',
  BWh: 'Hot desert', BWk: 'Cold desert', BSh: 'Hot semi-arid', BSk: 'Cold semi-arid',
  Csa: 'Hot-summer Mediterranean', Csb: 'Warm-summer Mediterranean', Csc: 'Cool-summer Mediterranean',
  Cfa: 'Humid subtropical', Cfb: 'Temperate oceanic', Cfc: 'Subpolar oceanic',
  Cwa: 'Dry-winter humid subtropical', Cwb: 'Dry-winter subtropical highland', Cwc: 'Dry-winter cool highland',
  Dfa: 'Hot-summer humid continental', Dfb: 'Warm-summer humid continental', Dfc: 'Subarctic', Dfd: 'Extremely cold subarctic',
  Dsa: 'Hot-summer dry-summer continental', Dsb: 'Warm-summer dry-summer continental', Dsc: 'Dry-summer subarctic', Dsd: 'Extremely cold dry-summer subarctic',
  Dwa: 'Hot-summer dry-winter continental', Dwb: 'Warm-summer dry-winter continental', Dwc: 'Dry-winter subarctic', Dwd: 'Extremely cold dry-winter subarctic',
  ET: 'Tundra', EF: 'Ice cap'
};

// Köppen–Geiger thresholds following Peel et al. (2007), using the 0°C C/D boundary.
// Applying these to coarse reanalysis normals gives an estimate, not an official city classification.
export function koppenType(temperature, precipitation, latitude) {
  if (temperature?.length !== 12 || precipitation?.length !== 12
    || !temperature.every(Number.isFinite) || !precipitation.every((p) => Number.isFinite(p) && p >= 0)) return null;
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const mean = sum(temperature) / 12;
  const annualRain = sum(precipitation);
  const coldest = Math.min(...temperature);
  const hottest = Math.max(...temperature);
  const summerIndexes = latitude >= 0 ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
  const summer = precipitation.filter((_, i) => summerIndexes.includes(i));
  const winter = precipitation.filter((_, i) => !summerIndexes.includes(i));
  const summerFraction = annualRain > 0 ? sum(summer) / annualRain : 0;
  const dryThreshold = 20 * mean + (summerFraction >= .7 ? 280 : summerFraction <= .3 ? 0 : 140);
  if (annualRain < dryThreshold) return `${annualRain < dryThreshold / 2 ? 'BW' : 'BS'}${mean >= 18 ? 'h' : 'k'}`;
  if (hottest < 10) return hottest > 0 ? 'ET' : 'EF';
  if (coldest >= 18) {
    const driest = Math.min(...precipitation);
    if (driest >= 60) return 'Af';
    if (driest >= 100 - annualRain / 25) return 'Am';
    return Math.min(...winter) <= Math.min(...summer) ? 'Aw' : 'As';
  }
  const family = coldest > 0 ? 'C' : 'D';
  const drySummer = Math.min(...summer) < 40 && Math.min(...summer) < Math.max(...winter) / 3;
  const dryWinter = Math.min(...winter) < Math.max(...summer) / 10;
  const season = drySummer && dryWinter ? (sum(summer) < sum(winter) ? 's' : 'w') : drySummer ? 's' : dryWinter ? 'w' : 'f';
  const heat = hottest >= 22 ? 'a' : temperature.filter((t) => t > 10).length >= 4 ? 'b' : family === 'D' && coldest <= -38 ? 'd' : 'c';
  return `${family}${season}${heat}`;
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dayOfYear(isoDate) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000) + 1;
}

export function dateFromDay(year, day) {
  return new Date(Date.UTC(year, 0, day, 12)).toISOString().slice(0, 10);
}

// NOAA fractional-year solar declination and a 90.833° sunrise/sunset zenith.
// Flat horizon, typical refraction; terrain and weather are not modeled.
export function daylightHours(latitude, isoDate) {
  if (!isValidDate(isoDate) || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  const year = Number(isoDate.slice(0, 4));
  const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  const gamma = 2 * Math.PI / days * (dayOfYear(isoDate) - 1);
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma)
    - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma)
    - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const radians = Math.PI / 180;
  const lat = latitude * radians;
  const cosine = (Math.cos(90.833 * radians) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  if (cosine >= 1) return 0;
  if (cosine <= -1) return 24;
  return 24 * Math.acos(cosine) / Math.PI;
}

export function formatDaylight(hours) {
  if (hours == null) return 'Unavailable';
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}
