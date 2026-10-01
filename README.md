# Latitude Explorer

Latitude Explorer is an interactive globe for discovering cities that share the same latitude—and the surprising places mirrored across the equator. V1 is a static React app designed to deploy cleanly to Cloudflare Pages.

## Features

- Interactive 3D globe with real country boundaries and city coordinates
- City search, selection, camera focus, and clickable markers
- Scrubbable latitude control with live nearby-city results
- Configurable north/south tolerance in miles or kilometers
- Optional mirrored-latitude ring
- Always-visible same-hemisphere and mirrored-latitude result groups using absolute latitude
- Default Discover mode diversifies matches by country; All matches shows the same base ranking without diversification
- Adjustable minimum great-circle separation from the selected city (default 500 km / approximately 311 mi), independent of latitude tolerance
- City population, elevation, equator distance, and time zone details
- Two-city comparison with latitude and great-circle distance
- Population filter for globe marker density
- Responsive desktop and mobile layouts

The **Climate & Seasons** layer compares monthly mean temperature and precipitation for one or two cities, alongside estimated Köppen–Geiger climate, available elevation, approximate coastal/inland context, and seasonal temperature swing. **Daylight** calculates approximate sunrise-to-sunset day length; its date input and yearly slider are hidden outside that mode. **Surprise me** chooses a same- or mirrored-latitude pair while honoring latitude tolerance and minimum separation. Share view copies a URL restoring cities, comparison, band, filters, result mode, and active layer (plus date in Daylight).

## Local development

Use Node.js 24 (or at least 22.12). The lockfile pins the dependency tree.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. To verify a production build:

```bash
npm run build
npm run preview
npm test
```

## Cloudflare Pages

No Cloudflare credentials are required to build the app. Connect this GitHub repository to Cloudflare Pages and use:

- Framework preset: **Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: leave blank (repository root)
- Environment variable: `NODE_VERSION=24`

See [Cloudflare's Vite deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/). Connect the `main` branch when ready to publish.

The app has no server-side runtime or secrets.

## Data sources and licenses

- City coordinates, population, elevation, and time zone are derived from the [GeoNames `cities15000` export](https://download.geonames.org/export/dump/), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). V1 ships the 5,000 most populous entries with a reported population to keep the client download reasonable. Attribution: GeoNames, downloaded October 2026.
- Country boundaries come from [`world-atlas` 2.0.2](https://github.com/topojson/world-atlas), sourced from [Natural Earth](https://www.naturalearthdata.com/) 4.1.0 at 1:110m scale. Natural Earth data is public domain. The redistribution's ISC notice is retained in [DATA_SOURCES.md](DATA_SOURCES.md).
- The globe uses a solid material and real polygons; it does not fetch external imagery. Fonts use Google Fonts with local font fallbacks.

The reproducible transform used to create both data files is in `scripts/prepare-data.mjs`. Download and unzip `cities15000.zip` into `.data/` (the script expects `.data/cities15000.txt`), then run `npm run prepare-data`. The raw export is intentionally excluded from Git. Normal development and deployment use the committed files and require no data download or API key.

Population numbers reflect GeoNames records, which can include districts or boroughs and vary in census date and definition. Missing reported elevation is shown as a dash in city details. The climate panel may show a separately labeled NASA regional terrain estimate when available, never passing that off as a reported city elevation. Latitude-band distance is approximate north/south distance on a spherical Earth, while two-city distance is great-circle distance, not a travel route. Boundaries are generalized for a world-scale visualization and may omit very small islands.

### Climate, seasons and daylight sources

All 5,000 cities have precomputed monthly series in `public/data/climate.json`, loaded asynchronously; there are no runtime climate API calls. [NASA POWER](https://power.larc.nasa.gov/) / MERRA-2 climatology covers **2001–2020**, sampled at the nearest native **0.5° × 0.625°** cell. Temperature is monthly mean air temperature at 2 m in °C. Corrected precipitation (mm/day) is multiplied by climatological month length (February 28.25 days) to get mm/month. These are coarse regional normals, not city station observations, current weather, or forecasts. Nearby settlements can share a grid cell; mountainous/coastal/island microclimates are not resolved.

NASA's public [bulk Zarr datastore](https://nasa-power.s3.us-west-2.amazonaws.com/index.html) carries [CC BY 4.0](https://nasa-power.s3.us-west-2.amazonaws.com/LICENSE.txt). Attribution: NASA Langley Research Center POWER Project, funded by NASA Applied Sciences; derived from MERRA-2. Data has been sampled, rounded, converted to monthly precipitation totals, and classified by this project. No NASA endorsement is implied; data is provided as-is. Coast distances use the public-domain [Natural Earth 1:110m coastline](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_coastline.geojson), with spherical segment distances. Inland/coastal is basic ocean proximity (100 km threshold), not a declaration of maritime/continental climate; lakes are not ocean coastlines and small islands may be absent.

Köppen–Geiger types are **derived estimates**, using [Peel et al. (2007)](https://hess.copernicus.org/articles/11/1633/2007/) thresholds and the 0°C temperate/continental boundary. They are not the published high-resolution Köppen map. Warmest/coolest months and temperature swing are displayed without presuming northern-hemisphere seasons. The [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) provide day length, including polar day/night, with a 90.833° sunrise/sunset zenith; local horizon, terrain, weather and elevation effects are excluded.

To regenerate climate, install Python `numpy` and `numcodecs` in an isolated environment, then run `python scripts/fetch-climate-bulk.py`. It downloads only the two parameters' 24 global monthly chunks from NASA's documented bulk store, caching them in ignored `.data/bulk/`, then creates a nearest-cell cache. Download the Natural Earth coastline linked above into `.data/coastline.geojson` and run `npm run prepare-climate`. Node, not Python, generates the committed app dataset. Normal builds require neither Python nor network data requests. `scripts/fetch-climate.mjs` is an optional point-service alternative with at most five concurrent requests and an immediate stop on rate limiting; prefer the bulk method for all cities.

### Optional local Cloudflare tunnel

The requested **https://latitude.pixelwood.co** uses a dedicated `latitude-explorer` tunnel, separate from existing tunnels. The production static server binds only to `127.0.0.1:4180` and serves `dist`; it never exposes Vite's development server or the checkout. Only this hostname routes to the origin; all other ingress requests get 404. Tunnel credentials, configuration and logs live in ignored `.local/` and must never be committed. The public website requires no login; share links contain only public city IDs and exploration settings.

Build first, then start the origin and connector in separate terminals:

```bash
npm run build
npm run serve
cloudflared tunnel --config .local/tunnel.yml run latitude-explorer
```

The supplied Windows helper `scripts/start-remote.ps1` starts both processes hidden and reuses healthy local processes instead of duplicating them. Run it from PowerShell after a build to restart remote access. **This PC must remain powered on and awake.** The processes are not installed as a boot service and do not automatically restart after Windows reboots. Rebuilding updates what is served. For always-on hosting independent of this PC, use Cloudflare Pages above. If rebuilding while visitors are active, a previously open page may need a refresh to load the new hashed assets.

Discovery results compare absolute latitude (`abs(abs(city.lat) - abs(bandLatitude))`) and always show both hemisphere groups, up to 36 ranked matches in each. For example, Kansas City can discover Melbourne within the default 100 mi latitude tolerance. The mirror switch controls only the globe ring. The selected city is excluded from its own results; minimum geographic separation applies to both groups and is measured from the selected city even when scrubbing the band. Switching MI/KM preserves both filters' physical distances. Near the equator, each city appears in only one hemisphere group. Population filtering still controls globe marker density separately.

### Results ranking

`src/geo.mjs` determines eligibility; `src/ranking.mjs` independently scores and diversifies the qualifying matches. The country-neutral base score combines 65% latitude closeness within the chosen tolerance with 35% logarithmic population prominence. Great-circle separation remains a qualifying threshold rather than a bonus for increasingly distant cities. Ties resolve by latitude difference, population, then stable city ID. The weights and population-prominence function are isolated for future tuning or a notability signal.

**Discover** (default) runs country rounds independently within each hemisphere: each country's best-ranked match first, each country's second match next, then third matches, and so on. Base order is preserved within each round. This normally limits a country to two appearances in the first ten when enough countries have qualifying matches; sparse pools fill with the remaining cities. All countries follow the same rule, with no exceptions or country-specific score weights. Diversification happens before the visible 36-result limit, so a less-populous country's top match is not prematurely discarded.

**All matches** uses the exact same base ranking without country rounds. Mode changes do not change eligibility, match counts, underlying city data, or the latitude/separation filters. Both hemisphere groups remain visible in both modes.

## Architecture

### Comparison UX

Climate & Seasons charts are expanded by default (and can still be collapsed). Remove city B with the × beside its comparison-panel heading or globe chip, or the existing Clear comparison action. These all use the same clear operation, keeping the primary city and filters intact and updating the share URL/history.

V2.1 retains all climate data, comparison context, monthly temperature/precipitation charts and existing daylight functionality in secondary disclosures. Latitude remains the lead interaction. A permanent solid equator reference at exactly 0° uses a muted sage stroke (0.8), lighter-weight than orange/blue city rings (1.5) and stronger than the dashed mirror guide (0.6). It is independent of mirror mode, selection and latitude scrubbing; city rings keep their actual positions on either side of it.

Every result has a distinct **Compare** button: it keeps city A and sets/replaces city B. City-name clicks select the primary city. Both actual city latitude rings are rendered during comparison (orange A, blue B), independent of the optional mirrored guide or scrubbed discovery band. Opposite-hemisphere pairs compare absolute latitudes; the north–south equivalent is that difference × 111.195 km/degree, separate from the cities' great-circle separation. The A/B panel leads with these relationships, with population/elevation and collapsed supporting climate beneath. The full existing climate/daylight panel remains available in a secondary disclosure; no new date features are introduced.

Mirror guide defaults on and is retained in session storage where available. URLs explicitly encode both on and off states (`mirror=1/0`), with URL state overriding the session preference. Stable GeoNames IDs restore both cities. City selection, comparison replacement and clearing add browser history entries; continuous filter/slider updates replace the current entry. Back/forward restores the saved view without creating another history entry.

- React + Vite
- `react-globe.gl` / Three.js for globe rendering
- Static GeoJSON and compact JSON datasets in `public/data`
- All filtering, search, comparison, and distance calculations run client-side

`src/geo.mjs` owns geographic calculations; `src/GlobeView.jsx` isolates and lazily loads the renderer. The main application owns discovery state. The prominent latitude slider is the V1 scrubbing interaction: it is reliable on touch screens and keyboards and updates results and the globe together. Dragging the ring itself is deferred.

The initial UI JavaScript is roughly 80 KB compressed. The WebGL module is loaded separately (roughly 550 KB compressed). City and boundary JSON together are about 1.3 MB uncompressed; climate/context JSON adds about 1.15 MB uncompressed. These load asynchronously. A modern browser with WebGL is required for the globe; other discovery controls remain available if renderer initialization fails.

GitHub Actions runs `npm ci`, the geographic/data tests, and the production build on pushes and pull requests.
