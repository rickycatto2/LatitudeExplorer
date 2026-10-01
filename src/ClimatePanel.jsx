import { useState } from 'react';
import { MONTHS, CLIMATE_NAMES, daylightHours, formatDaylight, dayOfYear, dateFromDay, isValidDate } from './climate.mjs';

const colors = ['#ffb86b', '#86bfff'];
function Chart({ series, field, title, unit, bars = false }) {
  const available = series.filter((s) => s.record?.[field]);
  if (!available.length) return <div className="climate-chart"><h3>{title}</h3><p>Monthly data unavailable.</p></div>;
  const values = available.flatMap((s) => s.record[field]);
  const low = bars ? 0 : Math.floor(Math.min(...values) / 5) * 5 - 5;
  const high = bars ? Math.max(20, Math.ceil(Math.max(...values) / 20) * 20) : Math.ceil(Math.max(...values) / 5) * 5 + 5;
  const x = (month) => 48 + month * 43;
  const y = (value) => 182 - (value - low) / (high - low) * 150;
  return <div className="climate-chart"><h3>{title} <small>{unit}</small></h3>
    <svg viewBox="0 0 560 215" role="img" aria-label={`${title} by calendar month. Exact values in the monthly table below.`}>
      {[0,.25,.5,.75,1].map((fraction) => { const value = low + (high - low) * fraction; return <g key={fraction}><line x1="38" x2="539" y1={y(value)} y2={y(value)} className="chart-grid"/><text x="31" y={y(value) + 4} textAnchor="end">{Math.round(value)}</text></g>; })}
      {MONTHS.map((month, i) => <text key={month} x={x(i)} y="207" textAnchor="middle">{month}</text>)}
      {available.map(({ city, record, color }, index) => bars ? <g key={city.id}>{record[field].map((value, i) => <rect key={i} x={x(i) - (available.length === 2 ? 14 : 9) + index * 14} y={y(value)} width={available.length === 2 ? 12 : 18} height={182 - y(value)} fill={color} opacity=".8"><title>{city.name}, {MONTHS[i]}: {value} {unit}</title></rect>)}</g> : <g key={city.id}><polyline points={record[field].map((value, i) => `${x(i)},${y(value)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5"/>{record[field].map((value, i) => <circle key={i} cx={x(i)} cy={y(value)} r="3" fill={color}><title>{city.name}, {MONTHS[i]}: {value} {unit}</title></circle>)}</g>)}
    </svg>
  </div>;
}

export default function ClimatePanel({ selected, compare, climate, climateError, layer, setLayer, date, setDate }) {
  const [month, setMonth] = useState(new Date().getMonth());
  if (!selected) return null;
  const series = [selected, compare].filter(Boolean).map((city, index) => ({city, record: climate?.records[city.id], color: colors[index]}));
  const year = Number(date.slice(0, 4));
  const yearDays = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
  return <section className="climate-section control-card" aria-label="Climate and seasons">
    <div className="climate-heading"><div><p className="eyebrow">SAME LATITUDE. DIFFERENT WORLDS.</p><h2>Climate & Seasons</h2></div>
      <div className="results-mode" role="group" aria-label="Climate layer"><button className={layer === 'climate' ? 'active' : ''} aria-pressed={layer === 'climate'} onClick={() => setLayer('climate')}>Climate & Seasons</button><button className={layer === 'daylight' ? 'active' : ''} aria-pressed={layer === 'daylight'} onClick={() => setLayer('daylight')}>Daylight</button></div>
    </div>
    <div className="climate-legend">{series.map(({city,color}) => <span key={city.id}><i style={{background: color}}/>{city.name} <small>{city.lat >= 0 ? 'Northern' : 'Southern'} hemisphere</small></span>)}{!compare && <small>Choose a comparison city or try “Surprise me” to see two places side by side.</small>}</div>
    {layer === 'daylight' ? <>
      <div className="daylight-date"><label htmlFor="daylight-date">Explore a date<input id="daylight-date" type="date" min="1900-01-01" max="2100-12-31" value={date} onChange={(e) => { if (isValidDate(e.target.value)) setDate(e.target.value); }}/></label><div className="range-row"><span>Jan 1</span><input aria-label="Daylight date slider" aria-valuetext={date} type="range" min="1" max={yearDays} value={dayOfYear(date)} onChange={(e) => setDate(dateFromDay(year, Number(e.target.value)))}/><span>Dec 31</span></div></div>
      <div className="climate-city-grid">{series.map(({city,color}) => { const hours = daylightHours(city.lat, date); return <article className="climate-city" key={city.id} style={{'--city-color':color}}><h3>{city.name}</h3><p className="daylight-number">{formatDaylight(hours)}</p><p>Approximate sunrise-to-sunset daylight</p><div className="daylight-bar"><i style={{width:`${hours / 24 * 100}%`,background:color}}/></div><small>{(24 - hours).toFixed(1)} hours of night · {date}</small></article>; })}</div>
      <p className="climate-note">Day length depends primarily on latitude and date, not climate. NOAA solar approximation includes typical refraction; terrain, elevation, weather and local horizon are not modeled. Polar day and night are included.</p>
    </> : <>
      {!climate && <p role="status">{climateError || 'Loading precomputed climate normals…'}</p>}
      <div className="climate-city-grid">{series.map(({city,record,color}) => { const t = record?.temperature; const elevation = city.elevation ?? record?.gridElevation; return <article className="climate-city" key={city.id} style={{'--city-color':color}}><h3>{city.name}</h3><dl><div><dt>Köppen–Geiger estimate</dt><dd>{record?.koppen ? `${record.koppen} · ${CLIMATE_NAMES[record.koppen]}` : 'Unavailable'}</dd></div><div><dt>Elevation</dt><dd>{elevation == null ? 'Not reported' : `${elevation.toLocaleString()} m${city.elevation == null ? ' · regional terrain estimate' : ' · reported city elevation'}`}</dd></div><div><dt>Coastal / inland context</dt><dd>{record?.coastKm == null ? 'Unavailable' : `${record.coastKm <= 100 ? 'Near coast' : 'Inland'} · ≈ ${record.coastKm.toLocaleString()} km from mapped coast`}</dd></div>{t && <div><dt>Seasonal temperature swing</dt><dd>{(Math.max(...t) - Math.min(...t)).toFixed(1)}°C · warmest {MONTHS[t.indexOf(Math.max(...t))]}, coolest {MONTHS[t.indexOf(Math.min(...t))]}</dd></div>}</dl>{!t && climate && <p>Monthly climate normals unavailable for this city.</p>}</article>; })}</div>
      <div className="climate-charts"><Chart series={series} field="temperature" title="Mean temperature" unit="°C"/><Chart series={series} field="precipitation" title="Precipitation" unit="mm / month" bars/></div>
      <div className="month-picker" role="group" aria-label="Inspect climate month">{MONTHS.map((name,i) => <button key={name} className={month === i ? 'active' : ''} aria-pressed={month === i} onClick={() => setMonth(i)}>{name}</button>)}</div>
      <div className="month-readout" aria-live="polite">{series.map(({city,record,color}) => <span key={city.id} style={{color}}>{city.name} · {MONTHS[month]}: {record?.temperature ? `${record.temperature[month]}°C · ${record.precipitation[month]} mm` : 'unavailable'}</span>)}</div>
      <details className="monthly-table"><summary>Monthly values & comparison</summary><div><table><caption>Monthly climate normals, 2001–2020</caption><thead><tr><th scope="col">Month</th>{series.map(({city}) => <th scope="col" key={city.id}>{city.name}<br/>°C / mm</th>)}</tr></thead><tbody>{MONTHS.map((name,i) => <tr key={name}><th scope="row">{name}</th>{series.map(({city,record}) => <td key={city.id}>{record?.temperature ? `${record.temperature[i]} / ${record.precipitation[i]}` : '—'}</td>)}</tr>)}</tbody></table></div></details>
      <p className="climate-note">NASA POWER / MERRA-2 · 2001–2020 normals · 0.5° × 0.625° regional grid, not city weather stations or forecasts. Köppen types are derived estimates. Natural Earth’s generalized coastline gives approximate ocean proximity; inland does not necessarily mean a continental climate, and small islands may be omitted. <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">Source & methodology ↗</a></p>
    </>}
  </section>;
}
