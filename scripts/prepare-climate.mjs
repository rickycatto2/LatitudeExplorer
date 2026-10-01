import fs from 'node:fs';
import { greatCircle } from '../src/geo.mjs';
import { koppenType, MONTHS } from '../src/climate.mjs';

const cities = JSON.parse(fs.readFileSync('public/data/cities.json', 'utf8'));
const coastline = JSON.parse(fs.readFileSync('.data/coastline.geojson', 'utf8'));
const segments = coastline.features.flatMap((feature) => {
  const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return lines.flatMap((line) => line.slice(1).map((point, index) => [line[index], point]));
});
const radians = Math.PI / 180;
function bearing(a, b) {
  const dLon = (b.lng - a.lng) * radians;
  return Math.atan2(Math.sin(dLon) * Math.cos(b.lat * radians), Math.cos(a.lat * radians) * Math.sin(b.lat * radians) - Math.sin(a.lat * radians) * Math.cos(b.lat * radians) * Math.cos(dLon));
}
function coastDistance(city) {
  let nearest = Infinity;
  for (const [[lngA, latA], [lngB, latB]] of segments) {
    const a = { lat: latA, lng: lngA }; const b = { lat: latB, lng: lngB };
    const d13 = greatCircle(a, city) / 6371;
    const angle = bearing(a, city) - bearing(a, b);
    const along = Math.atan2(Math.sin(d13) * Math.cos(angle), Math.cos(d13)) * 6371;
    const distance = along >= 0 && along <= greatCircle(a, b) ? Math.abs(Math.asin(Math.max(-1, Math.min(1, Math.sin(d13) * Math.sin(angle))))) * 6371 : Math.min(d13 * 6371, greatCircle(b, city));
    nearest = Math.min(nearest, distance);
  }
  return Math.round(nearest);
}
const days = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const records = {};
let missing = 0;
for (const city of cities) {
  const lat = Math.round(city.lat * 2) / 2;
  const lng = ((Math.round((city.lng + 180) / .625) * .625) % 360) - 180;
  const file = `.data/power/${lat}_${lng}.json`;
  const coastKm = coastDistance(city);
  const record = { coastKm, temperature: null, precipitation: null, koppen: null, gridElevation: null };
  if (fs.existsSync(file)) {
    const source = JSON.parse(fs.readFileSync(file, 'utf8'));
    const parameters = source.properties.parameter;
    const t = MONTHS.map((month) => parameters.T2M[month.toUpperCase()]);
    const p = MONTHS.map((month) => parameters.PRECTOTCORR[month.toUpperCase()]);
    if (t.every((v) => Number.isFinite(v) && v > -100 && v < 80) && p.every((v) => Number.isFinite(v) && v >= 0)) {
      record.temperature = t.map((v) => Math.round(v * 10) / 10);
      record.precipitation = p.map((v, i) => Math.round(v * days[i] * 10) / 10);
      record.koppen = koppenType(record.temperature, record.precipitation, city.lat);
      record.gridElevation = source.geometry.coordinates[2] == null ? null : Math.round(source.geometry.coordinates[2]);
      record.grid = [lat, lng];
    } else missing++;
  } else missing++;
  records[city.id] = record;
}
const metadata = { source: 'NASA POWER / MERRA-2', period: '2001–2020', grid: '0.5° latitude × 0.625° longitude', precipitationUnits: 'mm/month', temperatureUnits: '°C', koppen: 'Derived estimate; 0°C temperate/continental boundary', coastalSource: 'Natural Earth 1:110m coastline', generated: new Date().toISOString().slice(0, 10), missing };
fs.writeFileSync('public/data/climate.json', JSON.stringify({ metadata, records }));
console.log(`Prepared ${cities.length} climate/context records; ${missing} missing monthly series.`);
