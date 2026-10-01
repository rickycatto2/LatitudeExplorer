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

Climate, daylight, and date-based features are intentionally outside V1. The city model includes time zone data and the UI is organized into discrete controls so those layers can be added later without replacing the core latitude interaction.

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

Population numbers reflect GeoNames records, which can include districts or boroughs and vary in census date and definition. Missing reported elevation is shown as a dash; model-derived terrain elevation is not substituted. Latitude-band distance is approximate north/south distance on a spherical Earth, while two-city distance is great-circle distance, not a travel route. Boundaries are generalized for a world-scale visualization and may omit very small islands.

Discovery results compare absolute latitude (`abs(abs(city.lat) - abs(bandLatitude))`) and always show both hemisphere groups, up to 36 ranked matches in each. For example, Kansas City can discover Melbourne within the default 100 mi latitude tolerance. The mirror switch controls only the globe ring. The selected city is excluded from its own results; minimum geographic separation applies to both groups and is measured from the selected city even when scrubbing the band. Switching MI/KM preserves both filters' physical distances. Near the equator, each city appears in only one hemisphere group. Population filtering still controls globe marker density separately.

### Results ranking

`src/geo.mjs` determines eligibility; `src/ranking.mjs` independently scores and diversifies the qualifying matches. The country-neutral base score combines 65% latitude closeness within the chosen tolerance with 35% logarithmic population prominence. Great-circle separation remains a qualifying threshold rather than a bonus for increasingly distant cities. Ties resolve by latitude difference, population, then stable city ID. The weights and population-prominence function are isolated for future tuning or a notability signal.

**Discover** (default) runs country rounds independently within each hemisphere: each country's best-ranked match first, each country's second match next, then third matches, and so on. Base order is preserved within each round. This normally limits a country to two appearances in the first ten when enough countries have qualifying matches; sparse pools fill with the remaining cities. All countries follow the same rule, with no exceptions or country-specific score weights. Diversification happens before the visible 36-result limit, so a less-populous country's top match is not prematurely discarded.

**All matches** uses the exact same base ranking without country rounds. Mode changes do not change eligibility, match counts, underlying city data, or the latitude/separation filters. Both hemisphere groups remain visible in both modes.

## Architecture

- React + Vite
- `react-globe.gl` / Three.js for globe rendering
- Static GeoJSON and compact JSON datasets in `public/data`
- All filtering, search, comparison, and distance calculations run client-side

`src/geo.mjs` owns geographic calculations; `src/GlobeView.jsx` isolates and lazily loads the renderer. The main application owns discovery state. The prominent latitude slider is the V1 scrubbing interaction: it is reliable on touch screens and keyboards and updates results and the globe together. Dragging the ring itself is deferred.

The initial UI JavaScript is roughly 75 KB compressed. The WebGL module is loaded separately (roughly 550 KB compressed). City and boundary JSON together are about 1.3 MB uncompressed and load asynchronously. A modern browser with WebGL is required for the globe; other discovery controls remain available if renderer initialization fails.

GitHub Actions runs `npm ci`, the geographic/data tests, and the production build on pushes and pull requests.
