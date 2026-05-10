import { useState } from 'react';

const radiusOptions = [5, 10, 25, 50, 75, 100];

export interface RadiusSelectorProps {
  radiusMiles: number;
  airportCode?: string;
  onChange: (radiusMiles: number) => void;
}

export function RadiusSelector({ radiusMiles, airportCode, onChange }: RadiusSelectorProps) {
  const [customRadius, setCustomRadius] = useState(String(radiusMiles));
  function applyCustomRadius() {
    const parsed = Math.max(1, Math.min(250, Number(customRadius)));
    if (Number.isFinite(parsed)) onChange(Math.round(parsed));
  }
  return (
    <section className="panel aviation-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Scan radius</p>
          <h3>Scanning within {radiusMiles} miles{airportCode ? ` of ${airportCode}` : ''}</h3>
        </div>
      </div>
      <div className="aviation-button-grid">
        {radiusOptions.map((option) => (
          <button key={option} type="button" className={option === radiusMiles ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onChange(option)}>
            {option} mi
          </button>
        ))}
      </div>
      <label className="aviation-custom-radius">
        <span>Custom radius</span>
        <input className="aviation-input" type="number" min={1} max={250} value={customRadius} onChange={(event) => setCustomRadius(event.target.value)} onBlur={applyCustomRadius} />
        <button type="button" className="ops-action-button secondary" onClick={applyCustomRadius}>Apply</button>
      </label>
      <p className="aviation-caveat">Minimum 1 mile. Maximum 250 miles.</p>
    </section>
  );
}
