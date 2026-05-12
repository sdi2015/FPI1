import type { TripRiskResult } from '../../types/aviation';

function riskLabel(score: number) {
  if (score <= 29) return 'Low';
  if (score <= 49) return 'Watch';
  if (score <= 69) return 'Elevated';
  if (score <= 84) return 'High';
  return 'Critical';
}

export function TripRiskScoreCard({ risk, canViewRecommendation = true }: { risk: TripRiskResult; canViewRecommendation?: boolean }) {
  return (
    <section className="panel aviation-panel aviation-risk-score-card">
      <div className="card-heading">
        <div><p className="eyebrow">Review Risk</p><h3>Trip Risk Score</h3></div>
        <span className={`aviation-risk-badge risk-${risk.band.toLowerCase()}`}>{risk.band}</span>
      </div>
      <div className="aviation-score-hero">
        <strong>{risk.score}<span>/100</span></strong>
        <div><span>Confidence</span><b>{risk.confidence}%</b><p>{canViewRecommendation ? risk.recommendation_label : 'Restricted'} · advisory only</p></div>
      </div>
      <div className="aviation-score-meter"><span style={{ width: `${Math.max(4, risk.score)}%` }} /></div>
      <div className="aviation-risk-driver-list">
        <p className="eyebrow">Top Drivers</p>
        <ol>{risk.drivers.slice(0, 5).map((driver) => <li key={driver}>{driver}</li>)}</ol>
      </div>
      {canViewRecommendation ? <p className="aviation-caveat">{risk.recommendation_rationale}</p> : <p className="aviation-caveat">Recommendation details require an authorized Aviation, EP, or Security role.</p>}
      <div className="aviation-table-wrap">
        <table className="aviation-table aviation-score-breakdown-table">
          <thead><tr><th>Domain</th><th>Weight</th><th>Current Risk</th><th>Raw Score</th><th>Source</th><th>Evidence</th></tr></thead>
          <tbody>
            {risk.domain_breakdown.map((domain) => {
              const label = riskLabel(domain.raw_score);
              return <tr key={domain.domain}><td>{domain.domain}</td><td>{Math.round(domain.weight * 100)}%</td><td><span className={`aviation-risk-badge risk-${label.toLowerCase()}`}>{label}</span></td><td>{domain.raw_score}</td><td>{domain.source_status} · {domain.confidence}%</td><td>{domain.evidence.join('; ')}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <p className="aviation-guardrail">FPI provides advisory readiness analysis only. Aviation, security, and executive protection teams retain final decision authority.</p>
    </section>
  );
}
