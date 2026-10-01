import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { KM_PER_DEGREE, convertDistance, degreesFromDistance, latitudeMatches, latitudeLabel, normalizeSearch, escapeHtml } from './geo.mjs';
import { rankMatches, diversifyByCountry } from './ranking.mjs';
import ClimatePanel from './ClimatePanel.jsx';
import { readSharedView, sharedSearch } from './share.mjs';
import { surprisePair } from './surprise.mjs';
import { CITY_COLORS, comparisonMetrics, latitudePaths } from './comparison.mjs';
import CuratedParallels from './CuratedParallels.jsx';
import About from './About.jsx';

const Globe = lazy(() => import('./GlobeView.jsx'));
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const countries = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code) {
  try { return countries.of(code) || code; } catch { return code; }
}

function Stat({ label, children }) {
  return <div className="stat"><span>{label}</span><strong>{children}</strong></div>;
}

function ComparisonPanel({ selected, compare, climate, onClear, onReplace, onShare }) {
  const metrics = comparisonMetrics(selected, compare);
  return <div className="ab-panel">
    <p className="eyebrow">LATITUDE COMPARISON</p>
    <h1>Compare latitudes</h1>
    <div className="ab-cities">{[selected, compare].map((city, index) => <article key={city.id} className={index ? 'city-b' : 'city-a'}>
      <span className="ab-badge">{index ? 'B · COMPARISON' : 'A · PRIMARY'}</span>
      {index === 1 && <button className="remove-comparison" aria-label={`Remove comparison city ${city.name}`} title="Remove comparison city" onClick={onClear}>×</button>}
      <h2>{city.name}</h2><p>{countryName(city.countryCode)}</p>
      <strong className="ab-latitude">{latitudeLabel(city.lat)}</strong>
      <small>Absolute latitude {Math.abs(city.lat).toFixed(2)}°</small>
    </article>)}</div>
    <div className="latitude-relationship">
      <span>{metrics.mirrored ? 'MIRROR LATITUDE DIFFERENCE' : 'LATITUDE DIFFERENCE'}</span>
      <strong>{metrics.difference.toFixed(2)}°</strong>
      <p>≈ {number.format(metrics.northSouthKm)} km / {number.format(convertDistance(metrics.northSouthKm, 'km', 'mi'))} mi north–south difference</p>
      <small>{metrics.mirrored ? 'Compares absolute latitudes across the equator.' : 'Compares actual latitudes in the same hemisphere.'} Not the distance between the cities.</small>
    </div>
    <div className="geographic-distance"><span>GREAT-CIRCLE GEOGRAPHIC DISTANCE</span><b>{number.format(metrics.geographicKm)} km / {number.format(convertDistance(metrics.geographicKm, 'km', 'mi'))} mi</b></div>
    <div className="ab-facts"><div className="ab-facts-heading"><span>City details</span><b className="city-a">A</b><b className="city-b">B</b></div>{['population','elevation'].map((field) => <div key={field}><span>{field === 'population' ? 'Population' : 'Elevation'}</span>{[selected,compare].map((city) => <b key={city.id}>{city[field] == null ? 'Not reported' : `${number.format(city[field])}${field === 'elevation' ? ' m' : ''}`}</b>)}</div>)}</div>
    <details className="ab-climate"><summary>Supporting climate context</summary>{[selected,compare].map((city,index) => <p key={city.id}><b className={index ? 'city-b' : 'city-a'}>{city.name}</b> · {climate?.records[city.id]?.koppen || 'Climate unavailable'} <small>(regional Köppen estimate)</small></p>)}<a href="#supporting-climate" onClick={() => { document.getElementById('supporting-climate').open = true; }}>Monthly temperature & precipitation below ↓</a></details>
    <div className="comparison-actions"><button onClick={onClear}>Clear comparison</button><button onClick={onReplace}>Replace city B</button><button onClick={onShare}>↗ Share comparison</button></div>
    <p className="compare-help">Click Compare on any result to replace B. City names select a new primary city.</p>
  </div>;
}

class GlobeBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="error-card" role="alert">The 3D globe requires WebGL. Try enabling hardware acceleration in your browser. City search and latitude discovery are still available below.</div> : this.props.children;
  }
}

function App() {
  const globeRef = useRef();
  const stageRef = useRef();
  const searchRef = useRef();
  const [cities, setCities] = useState([]);
  const [climate, setClimate] = useState(null);
  const [climateError, setClimateError] = useState('');
  const [layer, setLayer] = useState('climate');
  const [date, setDate] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`; });
  const [actionMessage, setActionMessage] = useState('');
  const [shareFallback, setShareFallback] = useState('');
  const [land, setLand] = useState([]);
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState(null);
  const [query, setQuery] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [mirror, setMirror] = useState(true);
  const [unit, setUnit] = useState('mi');
  const [distance, setDistance] = useState(100);
  const [minimumSeparationKm, setMinimumSeparationKm] = useState(500);
  const [resultsMode, setResultsMode] = useState('discover');
  const [population, setPopulation] = useState(500000);
  const [dimensions, setDimensions] = useState({ width: 800, height: 700 });
  const cameraAltitude = Math.max(1.85, dimensions.height / dimensions.width * 1.8);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [ready, setReady] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const closePanelRef = useRef();
  const historyActionRef = useRef('replace');

  const restoreView = (cityData) => {
    let sessionMirror = true;
    try { sessionMirror = sessionStorage.getItem('latitude-mirror') !== '0'; } catch { /* Storage may be disabled. */ }
    const view = readSharedView(window.location.search, cityData, sessionMirror);
    historyActionRef.current = 'replace';
    setComparing(false); setQuery(''); setSearchOpen(false);
    setSelected(view.selected); setCompare(view.compare); setLatitude(view.latitude);
    setUnit(view.unit); setDistance(view.distance); setMinimumSeparationKm(view.minimumSeparationKm);
    setPopulation(view.population); setMirror(view.mirror); setResultsMode(view.resultsMode); setLayer(view.layer);
    if (view.date) setDate(view.date);
  };

  useEffect(() => {
    fetch('/data/climate.json').then((r) => r.ok ? r.json() : Promise.reject()).then(setClimate)
      .catch(() => setClimateError('Climate data could not be loaded. Refresh to retry; latitude discovery and daylight still work.'));
  }, []);

  useEffect(() => {
    if (!cities.length) return;
    const restore = () => restoreView(cities);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [cities]);

  useEffect(() => {
    if (!selected) return;
    const search = sharedSearch({ selected, compare, latitude, unit, distance, minimumSeparationKm, population, mirror, resultsMode, layer, date });
    const url = `${window.location.pathname}${search}${window.location.hash}`;
    if (window.location.search !== search) window.history[historyActionRef.current === 'push' ? 'pushState' : 'replaceState'](null, '', url);
    historyActionRef.current = 'replace';
    try { sessionStorage.setItem('latitude-mirror', mirror ? '1' : '0'); } catch { /* Sharing still works without storage. */ }
    setShareFallback('');
  }, [selected, compare, latitude, unit, distance, minimumSeparationKm, population, mirror, resultsMode, layer, date]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (mobile && panelOpen) closePanelRef.current?.focus();
  }, [mobile, panelOpen]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape') { setSearchOpen(false); setPanelOpen(false); setComparing(false); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/data/cities.json').then((r) => r.ok ? r.json() : Promise.reject(new Error('city data'))),
      fetch('/data/countries.geojson').then((r) => r.ok ? r.json() : Promise.reject(new Error('country geometry')))
    ]).then(([cityData, geo]) => {
      setCities(cityData);
      setLand(geo.features);
      restoreView(cityData);
    }).catch(() => setLoadingError('The map data could not be loaded. Please refresh to try again.'));
  }, []);

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => setDimensions({
      width: Math.max(320, Math.round(entry.contentRect.width)),
      height: Math.max(420, Math.round(entry.contentRect.height))
    }));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!ready || !selected) return;
    globeRef.current.pointOfView({ lat: compare ? (selected.lat + compare.lat) / 2 : selected.lat, lng: selected.lng, altitude: compare ? Math.max(2.1, cameraAltitude) : cameraAltitude }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  }, [selected, compare, ready, cameraAltitude]);

  useEffect(() => {
    if (!ready) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = !compare && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRotating(controls.autoRotate);
    controls.autoRotateSpeed = 0.25;
    controls.minDistance = 120;
    controls.maxDistance = 600;
    const stop = () => { controls.autoRotate = false; setRotating(false); };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [ready]);

  const toleranceDegrees = degreesFromDistance(distance, unit);
  const shownCities = useMemo(() => cities.filter((city) => city.population >= population || city.id === selected?.id || city.id === compare?.id), [cities, population, selected, compare]);
  const matches = useMemo(() => latitudeMatches(cities, selected, latitude, toleranceDegrees, minimumSeparationKm), [cities, selected, latitude, toleranceDegrees, minimumSeparationKm]);
  const rankedMatches = useMemo(() => Object.fromEntries(Object.entries(matches).map(([kind, rows]) => [kind, rankMatches(rows, latitude, toleranceDegrees)])), [matches, latitude, toleranceDegrees]);
  const visibleMatches = useMemo(() => Object.fromEntries(Object.entries(rankedMatches).map(([kind, rows]) => [kind, (resultsMode === 'discover' ? diversifyByCountry(rows) : rows).slice(0, 36)])), [rankedMatches, resultsMode]);
  const matchKinds = useMemo(() => new Map(Object.entries(matches).flatMap(([kind, rows]) => rows.map(({ city }) => [city.id, kind]))), [matches]);
  const suggestions = useMemo(() => {
    const term = normalizeSearch(query.trim());
    if (term.length < 2) return [];
    return cities.filter((city) => normalizeSearch(`${city.name} ${city.asciiName} ${countryName(city.countryCode)}`).includes(term)).slice(0, 7);
  }, [query, cities]);
  const paths = useMemo(() => latitudePaths(selected, compare, latitude, toleranceDegrees, mirror), [selected, compare, latitude, mirror, toleranceDegrees]);

  const selectCity = (city) => {
    if (comparing) { beginCompare(city); setComparing(false); setQuery(''); setSearchOpen(false); return; }
    historyActionRef.current = 'push';
    setSelected(city);
    if (compare?.id === city.id) setCompare(null);
    setLatitude(city.lat);
    setQuery('');
    setSearchOpen(false);
    if (mobile) setPanelOpen(true);
    if (ready) { globeRef.current.controls().autoRotate = false; setRotating(false); }
  };

  const changeUnit = (next) => {
    setDistance(convertDistance(distance, unit, next));
    setUnit(next);
  };

  const exploreLatitude = (lat) => {
    setLatitude(lat);
    if (!ready) return;
    globeRef.current.controls().autoRotate = false;
    setRotating(false);
    globeRef.current.pointOfView({ lat: Math.max(-75, Math.min(75, lat)), lng: globeRef.current.pointOfView().lng, altitude: cameraAltitude }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  };

  const beginCompare = (city) => {
    if (!selected || city.id === selected.id) return;
    historyActionRef.current = 'push';
    setCompare(city);
    setComparing(false);
    if (ready) { globeRef.current.controls().autoRotate = false; setRotating(false); }
    setPanelOpen(true);
  };

  const clearComparison = () => {
    historyActionRef.current = 'push';
    setCompare(null);
    setComparing(false);
    setActionMessage('Comparison removed.');
  };

  const loadPair = (pair) => {
    historyActionRef.current = 'push';
    setSelected(pair[0]); setLatitude(pair[0].lat); setQuery(''); setSearchOpen(false);
    if (ready) { globeRef.current.controls().autoRotate = false; setRotating(false); }
    setComparing(false); setCompare(pair[1]);
    setPanelOpen(false);
    setActionMessage(`${pair[0].name} ↔ ${pair[1].name} · ${pair[0].lat * pair[1].lat < 0 ? 'Mirrored latitude' : 'Same hemisphere'}`);
  };

  const surprise = () => {
    const pair = surprisePair(cities, toleranceDegrees, minimumSeparationKm, Math.random, [selected?.id, compare?.id]);
    if (!pair) { setActionMessage('No pair qualifies. Widen latitude tolerance or reduce minimum separation.'); return; }
    loadPair(pair);
  };

  const share = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setActionMessage('Link copied — your cities, filters and active layer are included.'); }
    catch { setShareFallback(window.location.href); setActionMessage('Copy this link to share your view.'); }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Surprising Parallels home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>SURPRISING<em>PARALLELS</em></span>
        </a>
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
          <input ref={searchRef} aria-label="Search for a city" placeholder={comparing ? 'Find a city to compare…' : 'Search a city…'} value={query} onFocus={() => setSearchOpen(true)} onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }} onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) selectCity(suggestions[0]); }} />
          <kbd>Ctrl K</kbd>
          {searchOpen && query.trim().length >= 2 && <div className="suggestions" aria-label="City search results">
            {suggestions.map((city) => <button key={city.id} onClick={() => selectCity(city)}>
              <span>{city.name}</span><small>{countryName(city.countryCode)} · {latitudeLabel(city.lat)}</small>
            </button>)}
            {suggestions.length === 0 && <p>No cities found in this dataset. Try another spelling.</p>}
          </div>}
        </div>
        <div className="top-actions"><span className="live-dot" /> LIVE GLOBE <button className="mobile-details" onClick={() => setPanelOpen(true)}>Details</button></div>
      </header>

      <div className="discovery-toolbar"><span>{compare ? `${selected?.name} ↔ ${compare.name}` : 'Discover unexpected connections across the globe.'}</span><div><a className="about-link" href="#about" onClick={() => { document.getElementById('about').open = true; }}>About</a><button disabled={!selected} onClick={surprise}>✦ Surprise me</button><button disabled={!selected} onClick={share}>↗ Share view</button></div></div>
      {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
      {shareFallback && <input className="share-link" aria-label="Shareable view URL" readOnly value={shareFallback} onFocus={(e) => e.target.select()}/>}

      <section className="workspace" id="top">
        <div className="globe-stage" ref={stageRef}>
          <div className="stage-label"><span>LATITUDE BAND</span><strong>{latitudeLabel(latitude)}</strong></div>
          {loadingError ? <div className="error-card" role="alert">{loadingError}</div> : cities.length > 0 ? <GlobeBoundary><Suspense fallback={<div className="loading-globe">Loading the globe…</div>}><Globe
            ref={globeRef}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            onGlobeReady={() => setReady(true)}
            showAtmosphere
            atmosphereColor="#69f5bd"
            atmosphereAltitude={0.17}
            polygonsData={land}
            polygonAltitude={0.006}
            polygonCapCurvatureResolution={2}
            polygonsTransitionDuration={0}
            polygonCapColor={() => '#234c40'}
            polygonSideColor={() => 'rgba(9, 18, 17, .2)'}
            polygonStrokeColor={() => 'rgba(148, 194, 177, .28)'}
            pointsData={shownCities}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={(d) => d.id === selected?.id || d.id === compare?.id ? 0.075 : 0.025}
            pointRadius={(d) => d.id === selected?.id || d.id === compare?.id ? 0.65 : Math.max(0.2, Math.log10(d.population) / 20)}
            pointColor={(d) => d.id === selected?.id ? '#ffb86b' : d.id === compare?.id ? '#86bfff' : matchKinds.get(d.id) === 'same' ? '#90f4cc' : matchKinds.get(d.id) === 'mirror' ? '#7a9eff' : '#85b4a0'}
            pointLabel={(d) => `<b>${escapeHtml(d.name)}</b><br/>${escapeHtml(countryName(d.countryCode))} · ${latitudeLabel(d.lat)}`}
            onPointClick={selectCity}
            pathsData={paths}
            pathPoints="points"
            pathPointLat="lat"
            pathPointLng="lng"
            pathColor={(d) => d.kind === 'comparison' ? CITY_COLORS.comparison : d.kind === 'selected' ? CITY_COLORS.primary : d.kind === 'equator' ? '#91aa9f' : d.kind === 'mirror' ? '#70869c' : '#ad855b'}
            pathStroke={(d) => d.kind === 'equator' ? 0.8 : d.kind === 'mirror' ? 0.6 : d.kind === 'band' || d.kind === 'scrub' ? 0.2 : 1.5}
            pathDashLength={(d) => d.kind === 'mirror' ? 0.035 : 1}
            pathDashGap={(d) => d.kind === 'mirror' ? 0.02 : 0}
            pathPointAlt={0.014}
            pathsTransitionDuration={0}
          /></Suspense></GlobeBoundary> : <div className="loading-globe">Loading real-world city data…</div>}
          {ready && <button className="rotation-toggle" onClick={() => { globeRef.current.controls().autoRotate = !rotating; setRotating(!rotating); }}>{rotating ? 'Ⅱ Pause rotation' : '▷ Rotate globe'}</button>}
          {selected && <div className="city-ring-legend"><button className="selected-chip" onClick={() => { setPanelOpen(true); if (ready) globeRef.current.pointOfView({ lat: compare ? (selected.lat + compare.lat) / 2 : selected.lat, lng: selected.lng, altitude: compare ? Math.max(2.1, cameraAltitude) : cameraAltitude }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500); }}><i />{compare && 'A · '}{selected.name}<span>{latitudeLabel(selected.lat)} ↗</span></button>{compare && <div className="comparison-chip-group"><button className="selected-chip comparison-chip" onClick={() => setPanelOpen(true)}><i />B · {compare.name}<span>{latitudeLabel(compare.lat)} ↗</span></button><button className="chip-remove-comparison" aria-label={`Remove comparison city ${compare.name} from globe`} title="Remove comparison city" onClick={clearComparison}>×</button></div>}</div>}
          <div className="globe-hint">DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM <span>·</span> SELECT A CITY</div>
        </div>

        {mobile && panelOpen && <button className="panel-backdrop" aria-label="Dismiss city details" onClick={() => setPanelOpen(false)} />}
        <aside className={`side-panel ${panelOpen ? 'open' : ''}`} inert={mobile && !panelOpen} aria-label="City details" onKeyDown={(event) => {
          if (!mobile || !panelOpen || event.key !== 'Tab') return;
          const buttons = [...event.currentTarget.querySelectorAll('button, a, summary, input')].filter((element) => element.getClientRects().length > 0);
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
          <button ref={closePanelRef} className="panel-close" aria-label="Close details" onClick={() => { setPanelOpen(false); searchRef.current?.focus(); }}>×</button>
          {selected && compare ? <ComparisonPanel selected={selected} compare={compare} climate={climate} onClear={clearComparison} onReplace={() => { setComparing(true); setPanelOpen(false); searchRef.current?.focus(); }} onShare={share}/> : selected && <>
            <p className="eyebrow">SELECTED CITY</p>
            <h1>{selected.name}</h1>
            <p className="country">{countryName(selected.countryCode)}</p>
            <div className="coordinate"><span>{latitudeLabel(selected.lat)}</span><span>{Math.abs(selected.lng).toFixed(2)}° {selected.lng >= 0 ? 'E' : 'W'}</span></div>
            {Math.abs(latitude - selected.lat) > .025 && <button className="return-latitude" onClick={() => setLatitude(selected.lat)}>Return band to {selected.name}</button>}
            <div className="stats-grid">
              <Stat label="FROM EQUATOR">{number.format(Math.abs(selected.lat) * KM_PER_DEGREE)} km</Stat>
              <Stat label="POPULATION">{number.format(selected.population)}</Stat>
              <Stat label="ELEVATION">{selected.elevation == null ? '—' : `${number.format(selected.elevation)} m`}</Stat>
              <Stat label="TIME ZONE">{selected.timezone.split('/').at(-1).replaceAll('_', ' ')}</Stat>
            </div>
            <button className="compare-button" onClick={() => { setComparing(!comparing); if (!comparing) { setPanelOpen(false); searchRef.current?.focus(); } }}>
              {comparing ? 'Cancel comparison selection' : '＋ Choose a city to compare'}
            </button>
            {comparing && <p className="compare-help">Search or select a marker to choose your second city.</p>}
          </>}
        </aside>
      </section>

      <section className="control-deck">
        <div className="latitude-control control-card">
          <div className="control-heading"><span>EXPLORE LATITUDE</span><strong>{latitudeLabel(latitude)}</strong></div>
          <div className="range-row"><span>90°S</span><input aria-label="Latitude" aria-valuetext={latitudeLabel(latitude)} type="range" min="-90" max="90" step="0.01" value={latitude} onChange={(e) => exploreLatitude(Number(e.target.value))} /><span>90°N</span></div>
          <div className="quick-latitudes">
            {[-60, -30, 0, 30, 60].map((lat) => <button className={Math.abs(latitude - lat) < 0.1 ? 'active' : ''} key={lat} onClick={() => exploreLatitude(lat)}>{lat === 0 ? 'EQUATOR' : `${Math.abs(lat)}°${lat > 0 ? 'N' : 'S'}`}</button>)}
          </div>
          <label className="switch-row"><span><b>Mirror ring on globe</b><small>{compare ? 'Actual city rings stay visible while comparing' : 'Results always include both hemispheres'}</small></span><input aria-label="Mirror latitude" type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /><i /></label>
        </div>

        <div className="filters control-card">
          <div className="control-heading"><span>LATITUDE TOLERANCE</span><div className="units"><button className={unit === 'mi' ? 'active' : ''} onClick={() => changeUnit('mi')}>MI</button><button className={unit === 'km' ? 'active' : ''} onClick={() => changeUnit('km')}>KM</button></div></div>
          <div className="distance-readout"><strong>± {number.format(distance)}</strong><span>{unit} north / south</span></div>
          <input aria-label="Latitude tolerance" type="range" min="0" max={unit === 'mi' ? 500 : convertDistance(500, 'mi', 'km')} step="any" value={distance} onChange={(e) => setDistance(Number(e.target.value))} />
          <p className="equivalence">Equivalent to <b>± {toleranceDegrees.toFixed(2)}°</b> of latitude</p>
          <div className="separation-filter">
            <div className="control-heading"><span>MINIMUM GEOGRAPHIC SEPARATION</span><b>{number.format(convertDistance(minimumSeparationKm, 'km', unit))} {unit}</b></div>
            <input aria-label="Minimum geographic separation" aria-valuetext={`${number.format(convertDistance(minimumSeparationKm, 'km', unit))} ${unit}`} type="range" min="0" max={convertDistance(10000, 'km', unit)} step="any" value={convertDistance(minimumSeparationKm, 'km', unit)} onChange={(e) => setMinimumSeparationKm(convertDistance(Number(e.target.value), unit, 'km'))} />
            <p className="equivalence">Great-circle distance from <b>{selected?.name || 'the selected city'}</b>. Separate from latitude tolerance.</p>
          </div>
          <div className="population-filter"><div><span>MINIMUM POPULATION</span><b>{population === 0 ? 'All cities' : `${number.format(population)}+`}</b></div><input aria-label="Minimum city population" type="range" min="0" max="6" step="1" value={[0,50000,100000,250000,500000,1000000,3000000].indexOf(population)} onChange={(e) => setPopulation([0,50000,100000,250000,500000,1000000,3000000][Number(e.target.value)])} /></div>
        </div>

        <div className="nearby control-card">
          <div className="control-heading"><span>LATITUDE MATCHES</span><b>{number.format(matches.same.length + matches.mirror.length)} FOUND</b></div>
          <div className="results-mode" role="group" aria-label="Results mode">
            <button aria-pressed={resultsMode === 'discover'} className={resultsMode === 'discover' ? 'active' : ''} title="Prioritizes geographic variety so one country doesn’t dominate the results." onClick={() => setResultsMode('discover')}>Discover</button>
            <button aria-pressed={resultsMode === 'all'} className={resultsMode === 'all' ? 'active' : ''} onClick={() => setResultsMode('all')}>All matches</button>
          </div>
          <p className="mode-explanation">{resultsMode === 'discover' ? 'Prioritizes geographic variety so one country doesn’t dominate the results.' : 'Ranks by latitude closeness and population, without country diversification.'}</p>
          <div className="result-groups">
            {['same', 'mirror'].map((kind) => <section key={kind} className={`result-group ${kind}`} aria-label={kind === 'same' ? 'Same-hemisphere matches' : 'Mirrored-latitude matches'}>
              <h2><span>{latitude === 0 ? (kind === 'same' ? 'Northern / equator' : 'Southern') : kind === 'same' ? 'Same hemisphere' : 'Mirrored latitude'} · {latitudeLabel(kind === 'same' ? latitude : -latitude, 1)}</span><b>{number.format(matches[kind].length)}</b></h2>
              <div className="nearby-list">
                {visibleMatches[kind].map(({ city, separationKm }) => <div key={city.id}>
                  <button className="city-select" onClick={() => selectCity(city)}><span className="city-dot"/><span><b>{city.name}</b><small>{countryName(city.countryCode)}</small></span><span className="match-metrics"><em>{latitudeLabel(city.lat)}</em><small>{number.format(convertDistance(separationKm, 'km', unit))} {unit} away</small></span></button>
                  <button className={`add-compare ${compare?.id === city.id ? 'active' : ''}`} aria-label={`Compare ${selected?.name} with ${city.name}`} aria-pressed={compare?.id === city.id} onClick={() => beginCompare(city)}>{compare?.id === city.id ? 'Comparing' : 'Compare'}</button>
                </div>)}
                {matches[kind].length === 0 && <p className="empty-band">No matches. Widen latitude tolerance or reduce geographic separation.</p>}
              </div>
            </section>)}
          </div>
          <p className="dataset-note">Showing up to 36 of {number.format(matches.same.length)} same-hemisphere and {number.format(matches.mirror.length)} mirrored matches, from all 5,000 cities. Population filter affects globe markers.</p>
        </div>
      </section>
      <CuratedParallels cities={cities} selected={selected} compare={compare} onSelect={(pair) => { loadPair(pair); stageRef.current?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'}); }}/>
      <details className="supporting-climate" id="supporting-climate" open><summary>Supporting information · Climate & Seasons{compare ? ` · ${selected.name} / ${compare.name}` : ''}</summary><ClimatePanel selected={selected} compare={compare} climate={climate} climateError={climateError} layer={layer} setLayer={setLayer} date={date} setDate={setDate}/></details>
      <About/>
      <footer><span>Surprising Parallels · V2.1</span><span>City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a></span><span>Earth is more connected than it looks.</span></footer>
    </main>
  );
}

export default App;
