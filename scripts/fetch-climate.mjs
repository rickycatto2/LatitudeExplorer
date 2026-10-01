import fs from 'node:fs';
import path from 'node:path';

const cities = JSON.parse(fs.readFileSync('public/data/cities.json', 'utf8'));
const cache = '.data/power';
fs.mkdirSync(cache, { recursive: true });
const cells = new Map();
for (const city of cities) {
  const lat = Math.round(city.lat * 2) / 2;
  const lng = ((Math.round((city.lng + 180) / .625) * .625) % 360) - 180;
  cells.set(`${lat}_${lng}`, { lat, lng });
}
const queue = [...cells.entries()];
let position = 0;
let completed = 0;
let failed = 0;
let rateLimited = false;
async function worker() {
  while (position < queue.length && !rateLimited) {
    const [key, cell] = queue[position++];
    const file = path.join(cache, `${key}.json`);
    if (fs.existsSync(file)) { completed++; continue; }
    let success = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const url = new URL('https://power.larc.nasa.gov/api/temporal/climatology/point');
        url.search = new URLSearchParams({ parameters: 'T2M,PRECTOTCORR', community: 'AG', longitude: cell.lng, latitude: cell.lat, format: 'JSON' });
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (response.status === 429) { rateLimited = true; console.log('Rate limited: stopped. Resume later or use the documented bulk datastore.'); break; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (!json.properties?.parameter?.T2M || !json.properties?.parameter?.PRECTOTCORR) throw new Error('Invalid data');
        fs.writeFileSync(file, JSON.stringify(json));
        success = true;
        break;
      } catch (error) {
        if (attempt === 3) console.log(`Unavailable ${key}: ${error.message}`);
        else await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt));
      }
    }
    if (!success) failed++;
    completed++;
    if (completed % 50 === 0) console.log(`${completed}/${queue.length} climate grid cells (${failed} unavailable)`);
  }
}
// NASA's documented maximum is five concurrent API requests.
await Promise.all(Array.from({ length: 5 }, worker));
console.log(`Finished ${completed} cells; ${failed} unavailable. Run prepare-climate next.`);
if (failed || rateLimited) process.exitCode = 1;
