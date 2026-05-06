import type { EprFacility, EprIncident, EprSecuritySolution } from './eprTypes';
import type { VendorSolution } from './vendorIntelligenceTypes';

export type MitigationVendorCandidateStatus =
  | 'Suggested'
  | 'Under Review'
  | 'Assessment Requested'
  | 'Approved Candidate'
  | 'Not Recommended'
  | 'Deferred';

export type MitigationContext = {
  id: string;
  incidentType: string;
  riskDomain: string;
  recommendedControl: string;
  solutionType: string;
  facilityScope: string;
  region: string;
  priority: string;
  status: string;
  residualRisk: string;
  capabilityTags: string[];
  facilityId?: string;
};

export type MitigationVendorCandidateLink = {
  id: string;
  mitigation_id: string;
  vendor_id: string;
  match_score: number;
  match_rationale: string;
  capability_match: string[];
  risk_domain_match: string[];
  assessment_status_at_link: string;
  recommendation_score_at_link: number;
  candidate_status: MitigationVendorCandidateStatus;
  review_owner: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type MitigationVendorCandidate = MitigationVendorCandidateLink & {
  vendor: VendorSolution;
};

export const MITIGATION_VENDOR_CANDIDATES_STORAGE_KEY = 'fpi.mitigation_vendor_candidates.v1';

const capabilityTerms: Array<[string, string[]]> = [
  ['Video Analytics', ['camera', 'video', 'vision', 'cctv', 'surveillance', 'evidence']],
  ['Alarm Monitoring', ['alarm', 'intrusion', 'monitoring', 'panic', 'duress']],
  ['Access Control', ['access', 'badge', 'door', 'lock', 'credential', 'perimeter']],
  ['Fire/Life Safety', ['fire', 'life safety', 'smoke', 'evacuation']],
  ['Threat Intelligence', ['threat', 'violence', 'incident', 'risk', 'intelligence']],
  ['Robotics / Autonomous Patrol', ['robot', 'drone', 'patrol', 'autonomous']],
  ['Associate Safety', ['associate', 'worker', 'safety', 'panic', 'duress']],
  ['Network / Device Posture', ['device', 'network', 'iot', 'sensor', 'firmware']],
  ['Evidence / Case Management', ['case', 'evidence', 'workflow', 'investigation', 'reporting']],
];

function normalize(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function hashNudge(...parts: string[]): number {
  let hash = 0;
  for (const ch of parts.join('|').toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) % 9973;
  return ((hash % 21) - 10) / 10;
}

export function inferMitigationCapabilityTags(context: Pick<MitigationContext, 'incidentType' | 'recommendedControl' | 'solutionType' | 'riskDomain'>): string[] {
  const text = normalize(`${context.incidentType} ${context.recommendedControl} ${context.solutionType} ${context.riskDomain}`);
  const tags = capabilityTerms.filter(([, terms]) => hasAny(text, terms)).map(([tag]) => tag);
  return unique(tags.length ? tags : ['Threat Intelligence']);
}

export function mapSolutionRiskDomain(solution: EprSecuritySolution | null, incidentTypes: string[]): string {
  const text = normalize(`${solution?.solution_type ?? ''} ${solution?.name ?? ''} ${solution?.prevents_incident_types ?? ''} ${incidentTypes.join(' ')}`);
  if (hasAny(text, ['camera', 'video', 'cctv', 'evidence'])) return 'Camera & Technical Control Monitoring';
  if (hasAny(text, ['alarm', 'fire', 'life safety', 'panic', 'duress'])) return 'Fire-System Monitoring & Assurance';
  if (hasAny(text, ['access', 'door', 'badge', 'lock'])) return 'Network & Security Device Posture';
  if (hasAny(text, ['threat', 'violence', 'incident', 'offender'])) return 'Threat Detection & Risk Scoring';
  if (hasAny(text, ['patrol', 'guard', 'law enforcement', 'robot', 'drone'])) return 'Law Enforcement / Security Vendor Analysis / External Coordination';
  return 'Vendor Intelligence & Recommendations';
}

export function buildMitigationContext(store: EprFacility | null, incidents: EprIncident[], planSolutions: EprSecuritySolution[]): MitigationContext | null {
  if (!store) return null;
  const topIncident = [...incidents].sort((a, b) => Number(b.severity || 0) - Number(a.severity || 0))[0];
  const primarySolution = planSolutions[0] ?? null;
  const incidentType = topIncident?.incident_type ?? 'Store security risk';
  const recommendedControl = planSolutions.length
    ? planSolutions.map((solution) => solution.name).join(' + ')
    : primarySolution?.name ?? 'Recommended security control pending selection';
  const solutionType = planSolutions.length ? unique(planSolutions.map((solution) => solution.solution_type)).join(', ') : 'Security mitigation';
  const riskDomain = mapSolutionRiskDomain(primarySolution, incidents.map((incident) => incident.incident_type));
  const partial = { incidentType, recommendedControl, solutionType, riskDomain };
  const maxSeverity = Math.max(0, ...incidents.map((incident) => Number(incident.severity || 0)));
  return {
    id: `MIT-${store.facility_id}-${normalize(incidentType).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'security-risk'}`,
    incidentType,
    riskDomain,
    recommendedControl,
    solutionType,
    facilityScope: store.facility_name,
    region: store.region,
    priority: maxSeverity >= 4 ? 'P1' : maxSeverity >= 3 ? 'P2' : 'P3',
    status: planSolutions.length ? 'Planning' : 'Needs control selection',
    residualRisk: planSolutions.length ? 'Medium after validation' : 'Unmitigated / pending plan',
    capabilityTags: inferMitigationCapabilityTags(partial),
    facilityId: String(store.facility_id),
  };
}

export function scoreVendorForMitigation(vendor: VendorSolution, context: MitigationContext): MitigationVendorCandidate {
  const vendorText = normalize([
    vendor.company,
    vendor.technologyProduct,
    vendor.category,
    vendor.useCase,
    vendor.addsValueToWalmart,
    vendor.maturityLevel,
    vendor.assessmentStatus,
    ...(vendor.capabilityTags ?? []),
    ...(vendor.riskDomains ?? []),
  ].join(' '));
  const capabilityMatches = unique(context.capabilityTags.filter((tag) => vendor.capabilityTags?.includes(tag) || hasAny(vendorText, tag.toLowerCase().split(/\s+|\//))));
  const riskMatches = unique((vendor.riskDomains ?? []).filter((domain) => domain === context.riskDomain || normalize(domain).includes(normalize(context.riskDomain).slice(0, 12))));
  const contextualTerms = unique(`${context.incidentType} ${context.recommendedControl} ${context.solutionType}`.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 4));
  const contextualHits = contextualTerms.filter((term) => vendorText.includes(term)).length;

  const capabilityScore = Math.min(100, capabilityMatches.length * 42 + contextualHits * 6);
  const riskScore = riskMatches.length ? 100 : vendorText.includes(normalize(context.riskDomain).split(' ')[0]) ? 55 : 15;
  const recommendationScore = clamp(vendor.recommendationScore || 0);
  const assessmentText = normalize(`${vendor.assessmentStatus} ${vendor.maturityLevel} ${vendor.analysisCompleted}`);
  const assessmentScore = assessmentText.includes('yes') || assessmentText.includes('complete') || assessmentText.includes('mature') || assessmentText.includes('validated') ? 90 : assessmentText.includes('growth') || assessmentText.includes('pilot') ? 68 : assessmentText.includes('tracked') || assessmentText.includes('unknown') ? 35 : 55;
  const evidenceScore = clamp((vendor.scoreBreakdown?.evidenceQuality ?? (vendor.sourceUrlPublisher ? 9 : 4)) * 5);

  const weighted = capabilityScore * 0.3 + riskScore * 0.25 + recommendationScore * 0.2 + assessmentScore * 0.15 + evidenceScore * 0.1;
  const matchScore = Math.round(clamp(weighted + hashNudge(context.id, vendor.id, vendor.company)) * 10) / 10;
  const rationaleParts = [
    capabilityMatches.length ? `capability match: ${capabilityMatches.join(', ')}` : 'limited direct capability match',
    riskMatches.length ? `risk-domain alignment: ${riskMatches.join(', ')}` : 'risk-domain alignment requires review',
    `vendor recommendation score ${vendor.recommendationScore}`,
    `assessment status: ${vendor.assessmentStatus || 'Unknown'}`,
  ];

  return {
    id: `MVC-${context.id}-${vendor.id}`,
    mitigation_id: context.id,
    vendor_id: vendor.id,
    match_score: matchScore,
    match_rationale: rationaleParts.join('; '),
    capability_match: capabilityMatches,
    risk_domain_match: riskMatches,
    assessment_status_at_link: vendor.assessmentStatus || 'Unknown',
    recommendation_score_at_link: vendor.recommendationScore || 0,
    candidate_status: 'Suggested',
    review_owner: 'Security Mitigation / SENTRY Review',
    notes: '',
    created_by: 'fpi-coding-expert-agent-pack-20260504-ef2b3e',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    vendor,
  };
}

export function findMitigationVendorCandidates(vendors: VendorSolution[], context: MitigationContext, limit = 8): MitigationVendorCandidate[] {
  return vendors
    .map((vendor) => scoreVendorForMitigation(vendor, context))
    .filter((candidate) => candidate.match_score >= 35)
    .sort((a, b) => b.match_score - a.match_score || b.recommendation_score_at_link - a.recommendation_score_at_link)
    .slice(0, limit);
}

export function candidateStatusTone(status: MitigationVendorCandidateStatus): 'ready' | 'watch' | 'critical' | 'stable' | 'track' {
  if (status === 'Approved Candidate') return 'ready';
  if (status === 'Assessment Requested' || status === 'Under Review') return 'watch';
  if (status === 'Not Recommended') return 'critical';
  if (status === 'Deferred') return 'stable';
  return 'track';
}
