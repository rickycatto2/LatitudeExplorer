import { isValidDate } from './climate.mjs';

export function readSharedView(search, cities, defaultMirror = true) {
  const params = new URLSearchParams(search);
  const selected = cities.find((c) => String(c.id) === params.get('city')) || cities.find((c) => c.name === 'Chicago') || cities[0];
  const compare = cities.find((c) => String(c.id) === params.get('compare') && c.id !== selected?.id) || null;
  const bounded = (key, fallback, min, max) => {
    const value = params.has(key) ? Number(params.get(key)) : NaN;
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  };
  return { selected, compare, latitude: bounded('lat', selected?.lat || 0, -90, 90),
    unit: params.get('unit') === 'km' ? 'km' : 'mi',
    distance: bounded('tolerance', 100, 0, params.get('unit') === 'km' ? 804.672 : 500),
    minimumSeparationKm: bounded('separation', 500, 0, 10000),
    population: [0,50000,100000,250000,500000,1000000,3000000].includes(Number(params.get('population'))) && params.has('population') ? Number(params.get('population')) : 500000,
    mirror: params.get('mirror') === '0' ? false : params.get('mirror') === '1' ? true : defaultMirror, resultsMode: params.get('results') === 'all' ? 'all' : 'discover',
    layer: params.get('layer') === 'daylight' ? 'daylight' : 'climate',
    date: isValidDate(params.get('date')) ? params.get('date') : null };
}

export function sharedSearch(view) {
  const params = new URLSearchParams();
  if (!view.selected) return '';
  params.set('city', view.selected.id);
  if (view.compare && view.compare.id !== view.selected.id) params.set('compare', view.compare.id);
  params.set('lat', Number(view.latitude.toFixed(5)));
  params.set('unit', view.unit);
  params.set('tolerance', Number(view.distance.toFixed(5)));
  params.set('separation', Number(view.minimumSeparationKm.toFixed(5)));
  params.set('population', view.population);
  params.set('mirror', view.mirror ? '1' : '0');
  if (view.resultsMode === 'all') params.set('results', 'all');
  if (view.layer === 'daylight') { params.set('layer', 'daylight'); if (isValidDate(view.date)) params.set('date', view.date); }
  return `?${params}`;
}
