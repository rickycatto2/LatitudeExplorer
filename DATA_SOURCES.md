# Data sources and attribution

## GeoNames

Source: https://download.geonames.org/export/dump/cities15000.zip

Retrieved October 1, 2026. GeoNames supplies WGS84 coordinates, settlement names, population, reported elevation, and IANA time zone identifiers. The shipped subset contains the 5,000 largest records with nonzero population, sorted by population. The transform keeps the GeoNames ID and ASCII name for reliable identity and search. No coordinates or population values are generated.

Attribution: GeoNames (https://www.geonames.org/), licensed under Creative Commons Attribution 4.0 (https://creativecommons.org/licenses/by/4.0/). The source schema and terms are at https://download.geonames.org/export/dump/readme.txt. Changes consist of selecting records/fields and converting tab-separated text into JSON.

## Country geometry

Source: `world-atlas` 2.0.2, `countries-110m.json`, converted to GeoJSON using `topojson-client` 3.1.0. This is a redistribution of Natural Earth 4.1.0 Admin 0 country geometry at 1:110m scale. Natural Earth geographic data is public domain: https://www.naturalearthdata.com/about/terms-of-use/.

The `world-atlas` redistribution includes the following ISC notice:

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.

## Climate & Seasons additions

- **NASA POWER / MERRA-2**: NASA Langley Research Center POWER Project; funded by NASA Applied Sciences within the Earth Science Division. [Source](https://power.larc.nasa.gov/), [bulk datastore](https://nasa-power.s3.us-west-2.amazonaws.com/index.html), [CC BY 4.0 license](https://nasa-power.s3.us-west-2.amazonaws.com/LICENSE.txt). Climatology 2001–2020, nearest native 0.5° × 0.625° cells. Adaptations: monthly temperature rounded to 0.1°C, corrected daily precipitation converted to monthly totals and rounded to 0.1 mm, derived Köppen estimates. Where available, grid terrain elevation from point responses is retained separately from GeoNames reported elevation. NASA does not endorse this application; data is supplied as-is without warranties.
- **Natural Earth 1:110m coastline**, public domain, [source file](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_coastline.geojson): spherical ocean-coast distances rounded to kilometers. Generalized coastline can omit small islands; lakes are not ocean coastlines.
- **Köppen–Geiger**: derived algorithm following [Peel, Finlayson & McMahon (2007)](https://hess.copernicus.org/articles/11/1633/2007/) with 0°C C/D threshold. This is an estimate based on coarse NASA normals, not a redistribution of the paper's climate map.
- **Daylight**: [NOAA solar equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), fractional-year declination and 90.833° sunrise/sunset zenith. Calculated locally; not a date-specific observation. Horizon, terrain, weather and elevation effects are excluded.
