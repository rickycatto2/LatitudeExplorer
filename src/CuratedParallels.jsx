import { useMemo } from 'react';
import { resolveCuratedPairs } from './curated.mjs';
import { comparisonMetrics } from './comparison.mjs';
import { convertDistance, latitudeLabel } from './geo.mjs';

const countries = new Intl.DisplayNames(['en'], {type:'region'});
const number = new Intl.NumberFormat('en',{maximumFractionDigits:0});

export default function CuratedParallels({ cities, selected, compare, onSelect }) {
  const pairs = useMemo(() => resolveCuratedPairs(cities),[cities]);
  return <section className="curated-parallels" aria-label="Curated Surprising Parallels">
    <div className="curated-heading"><div><p className="eyebrow">A FEW PLACES TO START</p><h2>Surprising Parallels</h2></div><p>Hand-picked connections. Select a pair to explore.<br/><small>Swipe or scroll for all 12 pairs →</small></p></div>
    <div className="curated-track" tabIndex="0" aria-label="Scroll curated city pairings">
      {pairs.map(([a,b]) => { const metrics = comparisonMetrics(a,b); const active = selected?.id===a.id && compare?.id===b.id; return <button key={`${a.id}-${b.id}`} className={`curated-pair ${active ? 'active' : ''}`} aria-label={`Explore ${a.name} and ${b.name}`} aria-pressed={active} onClick={() => onSelect([a,b])}>
        <span className="pair-kind">{metrics.mirrored ? 'Mirrored-latitude' : 'Same-latitude'} <span>↗</span></span>
        <span className="pair-city city-a"><b>{a.name}</b><strong>{latitudeLabel(a.lat)}</strong><small>{countries.of(a.countryCode)}</small></span>
        <span className="pair-city city-b"><b>{b.name}</b><strong>{latitudeLabel(b.lat)}</strong><small>{countries.of(b.countryCode)}</small></span>
        <span className="pair-difference">{metrics.difference.toFixed(2)}° {metrics.mirrored ? 'absolute latitude' : 'latitude'} difference<small>≈ {number.format(metrics.northSouthKm)} km / {number.format(convertDistance(metrics.northSouthKm,'km','mi'))} mi north–south</small></span>
      </button>; })}
      {!pairs.length && <p className="compare-help">Curated pairs will appear when city data loads.</p>}
    </div>
    <p className="curated-note">Curated pairs use the same comparison view and real city coordinates. Your discovery filters remain unchanged.</p>
  </section>;
}
