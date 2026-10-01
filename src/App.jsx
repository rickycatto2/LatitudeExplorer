import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { KM_PER_DEGREE, convertDistance, degreesFromDistance, latitudeMatches, absoluteLatitudeDifference, latitudeLabel, greatCircle, ringAt, normalizeSearch, escapeHtml } from './geo.mjs';

const Globe = lazy(() => import('./GlobeView.jsx'));
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const countries = new Intl.DisplayNames(['en'], { type: 'region' });

function countryName(code) {
  try { return countries.of(code) || code; } catch { return code; }
}

function Stat({ label, children }) {
  return <div className="stat"><span>{label}</span><strong>{children}</strong></div>;
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
  const [land, setLand] = useState([]);
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState(null);
  const [query, setQuery] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [mirror, setMirror] = useState(false);
  const [unit, setUnit] = useState('mi');
  const [distance, setDistance] = useState(100);
  const [minimumSeparationKm, setMinimumSeparationKm] = useState(500);
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
      const initial = cityData.find((city) => city.name === 'Chicago') || cityData[0];
      setSelected(initial);
      setLatitude(initial.lat);
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
    globeRef.current.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: cameraAltitude }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900);
  }, [selected, ready, cameraAltitude]);

  useEffect(() => {
    if (!ready) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const matchKinds = useMemo(() => new Map(Object.entries(matches).flatMap(([kind, rows]) => rows.map(({ city }) => [city.id, kind]))), [matches]);
  const suggestions = useMemo(() => {
    const term = normalizeSearch(query.trim());
    if (term.length < 2) return [];
    return cities.filter((city) => normalizeSearch(`${city.name} ${city.asciiName} ${countryName(city.countryCode)}`).includes(term)).slice(0, 7);
  }, [query, cities]);
  const paths = useMemo(() => [
    { kind: 'selected', points: ringAt(latitude) },
    { kind: 'band', points: ringAt(Math.min(90, latitude + toleranceDegrees)) },
    { kind: 'band', points: ringAt(Math.max(-90, latitude - toleranceDegrees)) },
    ...(mirror ? [{ kind: 'mirror', points: ringAt(-latitude) }] : [])
  ], [latitude, mirror, toleranceDegrees]);

  const selectCity = (city) => {
    if (comparing) { beginCompare(city); setComparing(false); setQuery(''); setSearchOpen(false); return; }
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
    setCompare(city);
    setPanelOpen(true);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Latitude Explorer home">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>LATITUDE<em>EXPLORER</em></span>
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
            pointAltitude={(d) => d.id === selected?.id ? 0.075 : 0.025}
            pointRadius={(d) => d.id === selected?.id ? 0.65 : Math.max(0.2, Math.log10(d.population) / 20)}
            pointColor={(d) => d.id === selected?.id ? '#ffb86b' : d.id === compare?.id ? '#86bfff' : matchKinds.get(d.id) === 'same' ? '#90f4cc' : matchKinds.get(d.id) === 'mirror' ? '#7a9eff' : '#85b4a0'}
            pointLabel={(d) => `<b>${escapeHtml(d.name)}</b><br/>${escapeHtml(countryName(d.countryCode))} · ${latitudeLabel(d.lat)}`}
            onPointClick={selectCity}
            pathsData={paths}
            pathPoints="points"
            pathPointLat="lat"
            pathPointLng="lng"
            pathColor={(d) => d.kind === 'mirror' ? '#7a9eff' : d.kind === 'band' ? '#ad855b' : '#ffb66b'}
            pathStroke={(d) => d.kind === 'mirror' ? 0.7 : d.kind === 'band' ? 0.2 : 1.5}
            pathDashLength={(d) => d.kind === 'mirror' ? 0.035 : 1}
            pathDashGap={(d) => d.kind === 'mirror' ? 0.02 : 0}
            pathPointAlt={0.014}
            pathsTransitionDuration={0}
          /></Suspense></GlobeBoundary> : <div className="loading-globe">Loading real-world city data…</div>}
          {ready && <button className="rotation-toggle" onClick={() => { globeRef.current.controls().autoRotate = !rotating; setRotating(!rotating); }}>{rotating ? 'Ⅱ Pause rotation' : '▷ Rotate globe'}</button>}
          {selected && <button className="selected-chip" onClick={() => { setPanelOpen(true); if (ready) globeRef.current.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: cameraAltitude }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500); }}><i />{selected.name}<span>{latitudeLabel(selected.lat)} ↗</span></button>}
          <div className="globe-hint">DRAG TO ROTATE <span>·</span> SCROLL TO ZOOM <span>·</span> SELECT A CITY</div>
        </div>

        {mobile && panelOpen && <button className="panel-backdrop" aria-label="Dismiss city details" onClick={() => setPanelOpen(false)} />}
        <aside className={`side-panel ${panelOpen ? 'open' : ''}`} inert={mobile && !panelOpen} aria-label="City details" onKeyDown={(event) => {
          if (!mobile || !panelOpen || event.key !== 'Tab') return;
          const buttons = event.currentTarget.querySelectorAll('button');
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
          <button ref={closePanelRef} className="panel-close" aria-label="Close details" onClick={() => { setPanelOpen(false); searchRef.current?.focus(); }}>×</button>
          {selected && <>
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
            {compare && <div className="compare-card">
              <div><span>COMPARING WITH</span><strong>{compare.name}</strong><small>{countryName(compare.countryCode)}</small></div>
              <button aria-label="Remove comparison" onClick={() => setCompare(null)}>×</button>
              <p><b>{latitudeLabel(compare.lat)}</b><span>{absoluteLatitudeDifference(compare.lat, selected.lat).toFixed(2)}° absolute latitude apart</span></p>
              <p><b>{number.format(greatCircle(selected, compare))} km</b><span>great-circle distance</span></p>
            </div>}
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
          <label className="switch-row"><span><b>Mirror ring on globe</b><small>Results always include both hemispheres</small></span><input aria-label="Mirror latitude" type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /><i /></label>
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
          <div className="result-groups">
            {['same', 'mirror'].map((kind) => <section key={kind} className={`result-group ${kind}`} aria-label={kind === 'same' ? 'Same-hemisphere matches' : 'Mirrored-latitude matches'}>
              <h2><span>{latitude === 0 ? (kind === 'same' ? 'Northern / equator' : 'Southern') : kind === 'same' ? 'Same hemisphere' : 'Mirrored latitude'} · {latitudeLabel(kind === 'same' ? latitude : -latitude, 1)}</span><b>{number.format(matches[kind].length)}</b></h2>
              <div className="nearby-list">
                {matches[kind].slice(0, 36).map(({ city, separationKm }) => <div key={city.id}>
                  <button className="city-select" onClick={() => selectCity(city)}><span className="city-dot"/><span><b>{city.name}</b><small>{countryName(city.countryCode)}</small></span><span className="match-metrics"><em>{latitudeLabel(city.lat)}</em><small>{number.format(convertDistance(separationKm, 'km', unit))} {unit} away</small></span></button>
                  <button className="add-compare" aria-label={`Compare ${selected?.name} with ${city.name}`} onClick={() => beginCompare(city)}>＋</button>
                </div>)}
                {matches[kind].length === 0 && <p className="empty-band">No matches. Widen latitude tolerance or reduce geographic separation.</p>}
              </div>
            </section>)}
          </div>
          <p className="dataset-note">Up to 36 most populous matches per hemisphere, from all 5,000 cities. Population filter affects globe markers.</p>
        </div>
      </section>
      <footer><span>Latitude Explorer · V1</span><span>City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a></span><span>Earth is more connected than it looks.</span></footer>
    </main>
  );
}

export default App;
