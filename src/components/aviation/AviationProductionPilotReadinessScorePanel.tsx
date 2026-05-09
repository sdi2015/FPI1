import { useEffect, useState } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { getSavedTripPlans } from '../../services/aviationTripStorageService';
import { calculateProductionPilotReadinessScore, type ProductionPilotReadinessScore } from '../../services/aviationReadoutReportService';

export function AviationProductionPilotReadinessScorePanel() {
  const [score, setScore] = useState<ProductionPilotReadinessScore | null>(null);
  useEffect(() => { async function load() { const trips = await getSavedTripPlans(); const next = calculateProductionPilotReadinessScore(trips); setScore(next); recordAviationAuditEvent({ event_type: 'production_readiness_score_viewed', actor_role: 'system', summary: `Production pilot readiness score viewed: ${next.score}.` }); } load(); }, []);
  if (!score) return <section className="panel aviation-panel"><p className="aviation-empty">Calculating production pilot readiness score...</p></section>;
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Limited production pilot</p><h3>Production Pilot Readiness Score</h3></div><span className="mode-pill">{score.score}/100</span></div><article className="aviation-selected-card"><span className="eyebrow">Readiness Band</span><strong>{score.band}</strong><p>{score.drivers.join(' • ')}</p></article>{score.blockers.length ? <div className="aviation-error"><strong>Blockers</strong><ul>{score.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : <p className="aviation-caveat">No critical readiness blockers are currently recorded locally.</p>}</section>;
}
