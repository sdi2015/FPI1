import type { TripRiskResult } from '../../types/aviation';

export function TripRiskScoreCard({ risk, canViewRecommendation }: { risk: TripRiskResult; canViewRecommendation: boolean }) {
  return (
    <section className="panel aviation-panel aviation-risk-card">
      <div className="card-heading"><div><p className="eyebrow">Transparent trip risk model</p><h3>Trip Risk Score</h3></div><span className="mode-pill">{risk.band}</span></div>
      <div className="aviation-score-row"><strong>{risk.score}</strong><span>Confidence {risk.confidence}%</span></div>
      <article className="aviation-recommendation">
        <span className="eyebrow">FPI recommendation</span>
        <strong>{canViewRecommendation ? risk.recommendation_label : 'Restricted'}</strong>
        <p>{canViewRecommendation ? risk.recommendation_rationale : 'Requires an authorized Aviation, EP, or Security role.'}</p>
      </article>
      <ul className="aviation-driver-list">{risk.drivers.map((driver) => <li key={driver}>{driver}</li>)}</ul>
      <details className="aviation-explain"><summary>Why this score?</summary>
        <div className="aviation-table-wrap">
          <table className="aviation-table aviation-score-table">
            <thead><tr><th>Domain</th><th>Raw Score</th><th>Weight</th><th>Contribution</th><th>Source Status</th><th>Confidence</th><th>Evidence</th></tr></thead>
            <tbody>{risk.domain_breakdown.map((domain) => <tr key={domain.domain}><td>{domain.domain}</td><td>{domain.raw_score}</td><td>{Math.round(domain.weight * 100)}%</td><td>{domain.weighted_contribution}</td><td>{domain.source_status}</td><td>{domain.confidence}%</td><td>{domain.evidence.join('; ')}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
      {risk.caveats.map((caveat) => <p key={caveat} className="aviation-caveat">{caveat}</p>)}
    </section>
  );
}
