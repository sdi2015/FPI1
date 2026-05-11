import { useEffect, useState } from 'react';

const radiusOptions = [5, 10, 25, 50, 75, 100];

export interface RadiusSelectorProps {
  radiusMiles: number;
  airportCode?: string;
  scanIsStale?: boolean;
  onChange: (radiusMiles: number) => void;
}

export function RadiusSelector({ radiusMiles, airportCode, scanIsStale = false, onChange }: RadiusSelectorProps) {
  const [customRadius, setCustomRadius] = useState(String(radiusMiles));

  useEffect(() => {
    setCustomRadius(String(radiusMiles));
  }, [radiusMiles]);

  function applyCustomRadius() {
    const parsed = Math.max(1, Math.min(250, Number(customRadius)));
    if (Number.isFinite(parsed)) onChange(Math.round(parsed));
  }

  return (
    <section className="panel aviation-panel aviation-radius-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Radius</p>
          <h3>{radiusMiles} miles{airportCode ? ` from ${airportCode}` : ''}</h3>
        </div>
        {scanIsStale ? <span className="aviation-badge aviation-status-pending">Refresh scan</span> : null}
      </div>
      <p className="aviation-caveat">Adjust the readiness zone before running the airport radius scan.</p>
      <div className="aviation-button-grid aviation-radius-buttons" aria-label="Radius quick selections">
        {radiusOptions.map((option) => (
          <button key={option} type="button" className={option === radiusMiles ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
      <label className="aviation-radius-slider"><span>Radius slider</span><input type="range" min={5} max={100} step={5} value={Math.min(100, radiusMiles)} onChange={(event) => onChange(Number(event.target.value))} /></label>
      <label className="aviation-custom-radius">
        <span>Custom miles</span>
        <input className="aviation-input" type="number" min={1} max={250} value={customRadius} onChange={(event) => setCustomRadius(event.target.value)} onBlur={applyCustomRadius} />
        <button type="button" className="ops-action-button secondary" onClick={applyCustomRadius}>Apply</button>
      </label>
      {scanIsStale ? <p className="aviation-caveat">Radius changed after the last scan. Run scan again to refresh facility results.</p> : null}
    </section>
  );
}
