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
