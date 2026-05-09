import { getAviationFeedback } from './aviationFeedbackService';
import { getAviationPilotConfig } from './aviationPilotConfig';
import { getAviationPilotIssues } from './aviationPilotIssueService';
import { getAviationProviderConfig } from './aviationProviderConfig';
import { getAviationAuditEvents } from './aviationAuditService';
import type { AviationTripPlan } from '../types/aviation';

export function generateAviationHandoffPacket(trips: AviationTripPlan[]): string {
  const config = getAviationPilotConfig();
  const providers = getAviationProviderConfig();
  const feedback = getAviationFeedback();
  const issues = getAviationPilotIssues();
  const audits = getAviationAuditEvents();
  const closed = trips.filter((trip) => trip.status === 'closed' || trip.closure_summary).length;
  return `# FPI AVIATION TRAVEL READINESS — PILOT HANDOFF PACKET

Generated: ${new Date().toISOString()}

## 1. Executive Summary
The Aviation Travel Readiness module is configured for a controlled pilot. It supports airport search, radius scanning, facility context, advisory risk scoring, readiness actions, auditability, feedback capture, and handoff planning. It remains advisory-only.

## 2. Pilot Scope
Pilot: ${config.pilot_name}\nOwner: ${config.pilot_owner_role}\nApproved roles: ${config.approved_user_roles.join(', ')}

## 3. Current Environment Mode
${config.environment_mode}. No production behavior is enabled by default.

## 4. Data Sources and Provider Status
${providers.map((p) => `- ${p.display_name}: ${p.mode}/${p.status}, confidence ${p.confidence}%. ${p.notes}`).join('\n')}

## 5. Production Readiness Checklist
See in-module Production Readiness Checklist. Key blockers remain live source approval, production persistence, audit logging, IAM, security, privacy, and UAT.

## 6. Governance / Approval Matrix
Governance matrix is embedded in the Aviation module and should be reviewed with Aviation, EP, Global Security, Field Security, FPI Admin, and viewer roles.

## 7. Role-Based Access Summary
Sensitive EP/traveler details are restricted by current authorization checks. ${config.restricted_data_categories.join('; ')} are restricted categories.

## 8. Risk Scoring Model Summary
The score combines weather, FAA/airport, nearby facility, EP readiness, incident/support placeholders, and data confidence/freshness. Recommendations require human review.

## 9. Source and Confidence Rules
Source mode, status, confidence, caveats, and next steps are shown in integration status and generated briefs.

## 10. Completed Pilot Metrics
- Trips saved: ${trips.length}\n- Trips closed: ${closed}\n- Briefs generated: ${audits.filter((a) => a.event_type === 'trip_brief_generated').length}\n- Briefs exported: ${audits.filter((a) => a.event_type === 'brief_exported').length}\n- Feedback submitted: ${feedback.length}\n- Open issues: ${issues.filter((i) => ['open','in_progress','blocked'].includes(i.status)).length}

## 11. Feedback Summary
${feedback.length ? feedback.slice(0, 20).map((f) => `- ${f.severity} ${f.category}: ${f.summary} (${f.status})`).join('\n') : '- No feedback captured yet.'}

## 12. Open Pilot Issues
${issues.length ? issues.filter((i) => i.status !== 'resolved').map((i) => `- ${i.priority} ${i.category}: ${i.title} — ${i.status} (${i.owner_role})`).join('\n') : '- No pilot issues captured yet.'}

## 13. Required Production Integrations
Facility master, FPI risk posture, FAA/NOTAM, NOAA weather, routing, production persistence, production audit logging, and IAM.

## 14. Security / Privacy Considerations
Do not expose traveler identity, sensitive executive itinerary details, law enforcement sensitive data, or vulnerability details beyond authorized roles.

## 15. Known Limitations
Seeded/demo/local/estimated data remain active by default. Live APIs are not called unless provider mode is explicitly live_api and enabled.

## 16. Recommended Next Actions
Finalize stakeholder pilot plan, run UAT, collect feedback, complete IT/security/privacy reviews, confirm production data owners, and make a go/no-go decision for production transition.

Advisory disclaimer: ${config.advisory_disclaimer}\n${config.human_decision_authority}
`;
}
