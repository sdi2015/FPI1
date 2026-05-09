export function AviationDemoScenario({ onLaunch }: { onLaunch: () => void }) {
  return (
    <section className="panel aviation-panel aviation-demo-panel">
      <div className="card-heading"><div><p className="eyebrow">One-click demo</p><h3>Executive Regional Airport Trip</h3></div></div>
      <p className="aviation-empty">Launch a seeded leadership story: regional airport, 25-mile scan, high-risk nearby facility, FAA watch, NOAA severe weather, mitigation actions, and an executive-ready brief.</p>
      <button type="button" className="ops-action-button aviation-scan-button" onClick={onLaunch}>Launch Demo Scenario</button>
    </section>
  );
}
