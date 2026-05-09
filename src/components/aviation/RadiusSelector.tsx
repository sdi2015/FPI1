const radiusOptions = [5, 10, 25, 50, 75, 100];

export interface RadiusSelectorProps {
  radiusMiles: number;
  onChange: (radiusMiles: number) => void;
}

export function RadiusSelector({ radiusMiles, onChange }: RadiusSelectorProps) {
  return (
    <section className="panel aviation-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Scan radius</p>
          <h3>{radiusMiles} miles</h3>
        </div>
      </div>
      <div className="aviation-button-grid">
        {radiusOptions.map((option) => (
          <button key={option} type="button" className={option === radiusMiles ? 'ops-action-button' : 'ops-action-button secondary'} onClick={() => onChange(option)}>
            {option} mi
          </button>
        ))}
      </div>
    </section>
  );
}
