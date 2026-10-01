import fs from 'node:fs';
import path from 'node:path';
import { feature } from 'topojson-client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const input = path.resolve('.data/cities15000.txt');
const outputDir = path.resolve('public/data');
if (!fs.existsSync(input)) throw new Error('Missing .data/cities15000.txt. Download the GeoNames cities15000 export first.');

const cities = fs.readFileSync(input, 'utf8').trim().split('\n').map((line) => {
  const f = line.split('\t');
  return {
    id: Number(f[0]),
    name: f[1],
    asciiName: f[2],
    lat: Number(f[4]),
    lng: Number(f[5]),
    countryCode: f[8],
    population: Number(f[14]) || 0,
    elevation: f[15] !== '' && Number(f[15]) !== -9999 ? Number(f[15]) : null,
    timezone: f[17]
  };
}).filter((city) => city.population > 0)
  .sort((a, b) => b.population - a.population)
  .slice(0, 5000);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'cities.json'), JSON.stringify(cities));
const topology = JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf8'));
fs.writeFileSync(path.join(outputDir, 'countries.geojson'), JSON.stringify(feature(topology, topology.objects.countries)));
console.log(`Prepared ${cities.length.toLocaleString()} cities.`);
