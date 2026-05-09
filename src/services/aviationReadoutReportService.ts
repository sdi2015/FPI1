import { getAviationAuditEvents } from './aviationAuditService';
import { getAviationFeedback } from './aviationFeedbackService';
import { getAviationPilotIssues } from './aviationPilotIssueService';
import { getAviationPilotConfig } from './aviationPilotConfig';
import { getAviationPilotUatRuns, getAviationStakeholderDecisions } from './aviationPilotExecutionService';
import { getAviationProvider, getAviationProviderConfig } from './aviationProviderConfig';
import type { AviationTripPlan } from '../types/aviation';

export type ProductionPilotReadinessScore = {
  score: number;
  band: 'Not Ready' | 'Needs Review' | 'Pilot Ready' | 'Ready for Limited Production Pilot';
  drivers: string[];
  blockers: string[];
};

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function calculateProductionPilotReadinessScore(trips: AviationTripPlan[]): ProductionPilotReadinessScore {
  const providers = getAviationProviderConfig();
  const decisions = getAviationStakeholderDecisions();
  const uat = getAviationPilotUatRuns();
  const feedback = getAviationFeedback();
  const issues = getAviationPilotIssues();
  const audits = getAviationAuditEvents();
  const criticalOpen = issues.filter((issue) => issue.priority === 'critical' && !['resolved', 'deferred'].includes(issue.status)).length;
  const dataApproved = decisions.some((decision) => decision.decision_type === 'approved_data_source' && ['accepted', 'closed'].includes(decision.status));
  const accessClear = decisions.some((decision) => decision.decision_type === 'role_access_decision' && ['accepted', 'closed'].includes(decision.status));
  const auditReady = getAviationProvider('auditProvider').enabled && audits.length > 0;
  const persistenceReady = getAviationProvider('persistenceProvider').enabled;
  const briefQualityAccepted = feedback.some((item) => item.category === 'brief_quality' && ['accepted', 'implemented', 'reviewed'].includes(item.status)) || audits.some((event) => event.event_type === 'trip_brief_generated');
  const riskScoreAccepted = feedback.some((item) => item.category === 'risk_scoring' && ['accepted', 'implemented', 'reviewed'].includes(item.status)) || trips.some((trip) => trip.risk_score > 0);
  const passRate = pct(uat.filter((run) => run.result === 'pass').length, uat.length);
  const providerReadiness = pct(providers.filter((provider) => ['ok', 'partial', 'pending'].includes(provider.status) && provider.enabled).length, providers.length);

  const criteria = [dataApproved, accessClear, auditReady, persistenceReady, briefQualityAccepted, riskScoreAccepted, criticalOpen === 0, passRate >= 70 || uat.length === 0];
  const score = Math.round((criteria.filter(Boolean).length / criteria.length) * 70 + providerReadiness * 0.3);
  const blockers = [
    !dataApproved ? 'No stakeholder-approved data source decision recorded.' : '',
    !accessClear ? 'Role/access decision has not been accepted or closed.' : '',
    criticalOpen > 0 ? `${criticalOpen} open critical pilot issue(s).` : '',
    uat.length > 0 && passRate < 70 ? `UAT pass rate is ${passRate}%.` : '',
  ].filter(Boolean);
  const band = score >= 85 && blockers.length === 0 ? 'Ready for Limited Production Pilot' : score >= 70 ? 'Pilot Ready' : score >= 50 ? 'Needs Review' : 'Not Ready';
  return { score, band, blockers, drivers: [`Provider readiness ${providerReadiness}%`, `UAT pass rate ${uat.length ? `${passRate}%` : 'not yet recorded'}`, `Open critical issues ${criticalOpen}`, `Feedback items ${feedback.length}`, `Saved trips ${trips.length}`] };
}

export function generateAviationPilotReadoutReport(trips: AviationTripPlan[]): string {
  const config = getAviationPilotConfig();
  const uat = getAviationPilotUatRuns();
  const feedback = getAviationFeedback();
  const issues = getAviationPilotIssues();
  const decisions = getAviationStakeholderDecisions();
  const providers = getAviationProviderConfig();
  const audits = getAviationAuditEvents();
  const readiness = calculateProductionPilotReadinessScore(trips);
  const passRate = pct(uat.filter((run) => run.result === 'pass').length, uat.length);
  const goNoGo = readiness.score >= 85 && readiness.blockers.length === 0 ? 'GO for limited production pilot with approved scope and controls' : readiness.score >= 70 ? 'GO WITH MITIGATION for continued controlled pilot / limited production prep' : 'NO-GO / DELAY until blockers are resolved';
  return `# FPI AVIATION TRAVEL READINESS — PILOT READOUT REPORT

Generated: ${new Date().toISOString()}

## Executive Summary
The module remains in ${config.environment_mode} mode and is advisory-only. It supports stakeholder pilot execution, UAT tracking, integration decisions, and NOAA-first live integration readiness without enabling live APIs by default.

## Pilot Scope
Pilot: ${config.pilot_name}\nOwner: ${config.pilot_owner_role}\nApproved roles: ${config.approved_user_roles.join(', ')}

## Demo Scenarios Completed
- Demo scenario launches recorded: ${audits.filter((event) => event.event_type === 'demo_scenario_launched').length}
- Trips saved: ${trips.length}
- Trips closed: ${trips.filter((trip) => trip.status === 'closed' || trip.closure_summary).length}

## UAT Results
- UAT sessions: ${uat.length}\n- Pass rate: ${uat.length ? `${passRate}%` : 'not recorded'}\n${uat.slice(0, 12).map((run) => `- ${run.session_date}: ${run.stakeholder_role} / ${run.test_scenario} — ${run.result}`).join('\n') || '- No UAT sessions recorded.'}

## Feedback Summary
${feedback.slice(0, 15).map((item) => `- ${item.severity} ${item.category}: ${item.summary} (${item.status})`).join('\n') || '- No feedback submitted.'}

## Open Issues
${issues.filter((issue) => !['resolved', 'deferred'].includes(issue.status)).map((issue) => `- ${issue.priority} ${issue.category}: ${issue.title} — ${issue.status}; owner ${issue.owner_role}`).join('\n') || '- No open issues.'}

## Integration Decisions
${decisions.slice(0, 15).map((decision) => `- ${decision.decision_type}: ${decision.title} — ${decision.status}; owner ${decision.follow_up_owner}`).join('\n') || '- No stakeholder decisions recorded.'}

## Data Source Readiness
${providers.map((provider) => `- ${provider.display_name}: ${provider.mode}/${provider.status}, confidence ${provider.confidence}%. Next: ${provider.next_step}`).join('\n')}

## Security / Privacy Considerations
Restricted categories: ${config.restricted_data_categories.join('; ')}. Sensitive traveler and EP details must remain hidden unless authorized. Audit and persistence are localStorage during pilot unless production services are approved.

## Production Pilot Readiness Score
Score: ${readiness.score}/100\nBand: ${readiness.band}\nDrivers: ${readiness.drivers.join('; ')}\nBlockers: ${readiness.blockers.join('; ') || 'None recorded'}

## Recommended Next Actions
1. Complete stakeholder UAT sessions and record pass/fail evidence.\n2. Record formal NOAA data-source approval or rejection decision.\n3. Resolve critical/high open pilot issues.\n4. Confirm IAM, audit, persistence, and privacy controls before limited production pilot.\n5. Keep seeded fallback active for demos and outages.

## Go/No-Go Recommendation for Limited Production Pilot
${goNoGo}

Advisory notice: ${config.advisory_disclaimer}\n${config.human_decision_authority}
`;
}
