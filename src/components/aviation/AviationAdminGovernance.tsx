import { AviationGovernanceMatrix } from './AviationGovernanceMatrix';
import { AviationLiveIntegrationDecisionMatrix } from './AviationLiveIntegrationDecisionMatrix';
import { AviationPilotBanner } from './AviationPilotBanner';
import { AviationPilotFeedbackPanel } from './AviationPilotFeedbackPanel';
import { AviationPilotIssueTracker } from './AviationPilotIssueTracker';
import { AviationPilotMetricsPanel } from './AviationPilotMetricsPanel';
import { AviationPilotUatRunLog } from './AviationPilotUatRunLog';
import { AviationProductionPilotReadinessScorePanel } from './AviationProductionPilotReadinessScorePanel';
import { AviationStakeholderDecisionLog } from './AviationStakeholderDecisionLog';
import { AviationStakeholderPilotPlanPanel } from './AviationStakeholderPilotPlanPanel';
import { IntegrationStatusPanel } from './IntegrationStatusPanel';
import { NoaaLiveIntegrationReadinessPanel } from './NoaaLiveIntegrationReadinessPanel';
import { ProductionReadinessChecklist } from './ProductionReadinessChecklist';
import type { AviationUserRole } from '../../types/aviation';

export function AviationAdminGovernance({ role, tripId }: { role: AviationUserRole; tripId: string }) {
  const fullAdmin = ['aviation_admin', 'fpi_admin'].includes(role);
  const governanceViewer = fullAdmin || ['global_security', 'executive_protection'].includes(role);
  if (role === 'viewer') return <section className="panel aviation-panel"><p className="aviation-empty">Restricted. Admin and governance materials require an authorized aviation, security, EP, or FPI role.</p></section>;
  return <div className="aviation-admin-page"><section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Admin / Governance</p><h3>Pilot Support and Production Readiness</h3></div><span className="mode-pill">{fullAdmin ? 'full admin' : 'limited access'}</span></div><p className="aviation-caveat">Operational trip planning tools are separated from technical, governance, feedback, and production readiness materials.</p></section><AviationPilotBanner />{governanceViewer ? <><AviationStakeholderPilotPlanPanel /><AviationGovernanceMatrix /><AviationPilotUatRunLog actorRole={role} /><AviationStakeholderDecisionLog actorRole={role} /></> : null}{fullAdmin ? <><IntegrationStatusPanel /><NoaaLiveIntegrationReadinessPanel /><AviationLiveIntegrationDecisionMatrix /><ProductionReadinessChecklist /><AviationProductionPilotReadinessScorePanel /><AviationPilotMetricsPanel /><AviationPilotFeedbackPanel actorRole={role} tripId={tripId} /><AviationPilotIssueTracker actorRole={role} /></> : <p className="aviation-empty">Provider debug, issue tracking, and production readiness controls are limited to Aviation Admin and FPI Admin roles.</p>}</div>;
}
