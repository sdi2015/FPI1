import type { CameraWorkQueueItem, TechnologyHealthData, TechnologyIssue } from './technologyHealthTypes';
import type { RemediationItem, RemediationKpis, RemediationPriority, RemediationRoutingRule, RemediationSeverity, RemediationStatus } from './remediationTypes';

const NOW = Date.parse('2026-05-05T12:00:00.000Z');

export function buildRemediationItems(data: TechnologyHealthData): RemediationItem[] {
  const cameraTickets = data.workQueue.map((item, index) => fromCameraWorkQueue(item, index));
  const technologyIssues = data.technologyIssues.map((issue, index) => fromTechnologyIssue(issue, index));
  const sourceWarnings = data.sourceFreshness
    .filter((source) => ['Aging', 'Stale', 'Unknown'].includes(source.freshness_status))
    .map((source, index): RemediationItem => {
      const severity: RemediationSeverity = source.freshness_status === 'Stale' ? 'High' : source.freshness_status === 'Unknown' ? 'Medium' : 'Low';
      return baseItem({
        remediationId: `rem-source-${source.source_id}`,
        sourceFindingId: source.source_id,
        sourceService: 'Network & Security Device Posture',
        facilityAlias: 'Portfolio',
        title: `${source.source_label} freshness review`,
        description: `${source.source_label} is ${source.freshness_status.toLowerCase()} with ${source.confidence.toLowerCase()} confidence.`,
        category: 'Source Freshness',
        severity,
        status: index % 2 === 0 ? 'Triaged' : 'New',
        ownerTeam: 'Data / Adapter Owner',
        channel: 'FPI Internal',
        slaHours: severity === 'High' ? 48 : 96,
        evidenceRequired: true,
        evidenceChecklist: ['Confirm source owner', 'Validate last successful collection', 'Document adapter recovery or approved synthetic fallback'],
        recommendedAction: 'Validate source freshness and document collection confidence before downstream scoring.',
        nextStep: 'Assign adapter owner and confirm source status.',
        riskDriverIds: [],
        linkedTechnologyIssueIds: [],
        offsetHours: 12 + index * 9,
      });
    });

  const profileActions = data.analytics.topIssueStores.slice(0, 5).map((store, index): RemediationItem => {
    const severity: RemediationSeverity = store.healthStatus === 'Critical' ? 'High' : 'Medium';
    return baseItem({
      remediationId: `rem-profile-${store.siteAlias.toLowerCase()}`,
      sourceFindingId: `profile-${store.siteAlias}`,
      sourceService: 'Camera & Technical Control Monitoring',
      facilityAlias: store.siteAlias,
      title: `Recording profile and placement review for ${store.siteAlias}`,
      description: `${store.missingProfileCount} profile warnings and ${store.misplacedSubnetCount} placement flags require validation.`,
      category: 'Recording Profile / Retention',
      severity,
      status: index % 3 === 0 ? 'Assigned' : 'Triaged',
      ownerTeam: 'Technical Controls',
      channel: 'FPI Internal',
      slaHours: 96,
      evidenceRequired: true,
      evidenceChecklist: ['VMS profile validation', 'Retention/profile screenshot or approved exception note', 'FPI verification note'],
      recommendedAction: 'Validate VMS recording profile assignment and document AP-14 evidence readiness.',
      nextStep: 'Review sanitized store compliance card and request technical validation if needed.',
      riskDriverIds: ['camera-profile-gap', 'network-placement-flag'].filter((_, driverIndex) => driverIndex === 0 || store.misplacedSubnetCount > 0),
      linkedTechnologyIssueIds: [],
      offsetHours: 30 + index * 11,
    });
  });

  return [...cameraTickets, ...technologyIssues, ...sourceWarnings, ...profileActions];
}

export function getRemediationKpis(items: RemediationItem[]): RemediationKpis {
  const open = items.filter((item) => item.status !== 'Verified Complete');
  const overdue = open.filter((item) => Date.parse(item.dueAt) < NOW).length;
  const criticalHigh = open.filter((item) => item.severity === 'Critical' || item.severity === 'High').length;
  const evidenceRequired = open.filter((item) => item.evidenceRequired).length;
  const pendingVerification = open.filter((item) => item.status === 'Pending Verification' || item.evidenceStatus === 'Pending Verification').length;
  const onTrackPercent = open.length ? Math.round(((open.length - overdue) / open.length) * 100) : 100;
  return { totalOpen: open.length, criticalHigh, overdue, evidenceRequired, pendingVerification, onTrackPercent };
}

export function getRoutingRules(): RemediationRoutingRule[] {
  return [
    { findingType: 'Critical grouped camera outage', sourceService: 'Camera & Technical Control Monitoring', channel: 'ServiceChannel', ownerTeam: 'CCTV Service Program', severityTrigger: 'Critical or High outage cluster', evidenceExpectation: 'Camera online validation and work order closeout' },
    { findingType: 'Non-critical camera degradation', sourceService: 'Camera & Technical Control Monitoring', channel: 'Me@Walmart', ownerTeam: 'Store / Field Ops', severityTrigger: 'Medium or low impact', evidenceExpectation: 'Store validation or service note' },
    { findingType: 'Recorder / VMS dependency issue', sourceService: 'Network & Security Device Posture', channel: 'Security Engineering', ownerTeam: 'Technical Controls', severityTrigger: 'Recorder degraded/offline or stale', evidenceExpectation: 'Recorder health validation' },
    { findingType: 'Access Control / LPR finding', sourceService: 'Network & Security Device Posture', channel: 'Security Engineering', ownerTeam: 'Security Device Support', severityTrigger: 'Warning, Degraded, Critical, or Unknown', evidenceExpectation: 'System validation and support note' },
    { findingType: 'Source freshness warning', sourceService: 'Network & Security Device Posture', channel: 'FPI Internal', ownerTeam: 'Data / Adapter Owner', severityTrigger: 'Aging, stale, or unknown source', evidenceExpectation: 'Source owner confirmation and collection timestamp' },
    { findingType: 'Role-gated technical detail request', sourceService: 'Network & Security Device Posture', channel: 'Manual Coordination', ownerTeam: 'FPI Governance', severityTrigger: 'Raw identifier or engineer detail required', evidenceExpectation: 'Approved role-gating decision' },
  ];
}

export function groupByStatus(items: RemediationItem[]): Record<RemediationStatus, RemediationItem[]> {
  const statuses: RemediationStatus[] = ['New', 'Triaged', 'Assigned', 'In Progress', 'Blocked', 'Pending Verification', 'Verified Complete'];
  return statuses.reduce((accumulator, status) => {
    accumulator[status] = items.filter((item) => item.status === status);
    return accumulator;
  }, {} as Record<RemediationStatus, RemediationItem[]>);
}

export function agingBucket(item: RemediationItem): string {
  const ageHours = Math.max(0, Math.round((NOW - Date.parse(item.createdAt)) / 36e5));
  if (ageHours <= 24) return '0-24h';
  if (ageHours <= 72) return '1-3d';
  if (ageHours <= 168) return '4-7d';
  if (ageHours <= 336) return '8-14d';
  return '15d+';
}

export function summarizeBy<T extends string>(items: RemediationItem[], getKey: (item: RemediationItem) => T): Record<T, number> {
  return items.reduce((accumulator, item) => {
    const key = getKey(item);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {} as Record<T, number>);
}

export function isOverdue(item: RemediationItem): boolean {
  return item.status !== 'Verified Complete' && Date.parse(item.dueAt) < NOW;
}

function fromCameraWorkQueue(item: CameraWorkQueueItem, index: number): RemediationItem {
  const severity = normalizeSeverity(item.severity);
  return baseItem({
    remediationId: `rem-${item.id}`,
    sourceFindingId: item.id,
    sourceService: 'Camera & Technical Control Monitoring',
    facilityAlias: item.siteAlias,
    title: item.title,
    description: `Camera outage work candidate routed through ${item.channel} with ${item.assignmentGroup}.`,
    category: 'Camera Outage',
    severity,
    status: index % 5 === 0 ? 'Pending Verification' : index % 4 === 0 ? 'In Progress' : index % 3 === 0 ? 'Assigned' : 'Triaged',
    ownerTeam: item.assignmentGroup,
    channel: item.channel === 'ServiceChannel' ? 'ServiceChannel' : 'Me@Walmart',
    slaHours: item.sla.includes('24') ? 24 : 72,
    evidenceRequired: item.evidenceRequired,
    evidenceChecklist: ['Work order or ticket reference', 'Camera online validation', 'FPI verification note'],
    recommendedAction: 'Create or validate grouped CCTV service ticket and confirm camera recovery evidence.',
    nextStep: item.status,
    riskDriverIds: ['camera-outage-cluster'],
    linkedTechnologyIssueIds: [],
    offsetHours: 18 + index * 7,
  });
}

function fromTechnologyIssue(issue: TechnologyIssue, index: number): RemediationItem {
  const sourceService = issue.domain === 'Camera/VMS' || issue.domain === 'Recorder' ? 'Camera & Technical Control Monitoring' : 'Network & Security Device Posture';
  return baseItem({
    remediationId: issue.creates_remediation_id || `rem-${issue.issue_id}`,
    sourceFindingId: issue.issue_id,
    sourceService,
    facilityAlias: issue.facility_id,
    title: issue.summary,
    description: `${issue.domain} finding is ${issue.status.toLowerCase()} with ${issue.confidence.toLowerCase()} confidence and ${issue.freshness_status.toLowerCase()} freshness.`,
    category: issue.domain === 'Recorder' ? 'Recorder / VMS Issue' : issue.domain === 'Access Control' ? 'Access Control Issue' : issue.domain === 'LPR' ? 'LPR Issue' : issue.domain === 'Network/Security Device' ? 'Network / Security Device' : 'Camera Outage',
    severity: issue.severity,
    status: issue.status === 'Unknown' ? 'Blocked' : issue.status === 'Normal' ? 'Verified Complete' : index % 2 === 0 ? 'Assigned' : 'Triaged',
    ownerTeam: sourceService === 'Camera & Technical Control Monitoring' ? 'Technical Controls' : 'Security Device Support',
    channel: sourceService === 'Camera & Technical Control Monitoring' ? 'FPI Internal' : 'Security Engineering',
    slaHours: issue.severity === 'Critical' ? 24 : issue.severity === 'High' ? 48 : issue.severity === 'Medium' ? 96 : 168,
    evidenceRequired: issue.status !== 'Normal',
    evidenceChecklist: ['Source validation', 'Owner disposition', 'Closure evidence or accepted exception'],
    recommendedAction: `Validate ${issue.domain} finding and update remediation disposition.`,
    nextStep: issue.status === 'Unknown' ? 'Confirm source confidence and owner' : 'Assign owner and collect validation evidence',
    riskDriverIds: issue.risk_driver_ids,
    linkedTechnologyIssueIds: [issue.issue_id],
    offsetHours: 10 + index * 15,
  });
}

function baseItem(input: Omit<RemediationItem, 'priority' | 'region' | 'createdAt' | 'dueAt' | 'evidenceStatus'> & { offsetHours: number }): RemediationItem {
  const createdAt = new Date(NOW - input.offsetHours * 36e5).toISOString();
  const dueAt = new Date(Date.parse(createdAt) + input.slaHours * 36e5).toISOString();
  const priority = priorityForSeverity(input.severity);
  const evidenceStatus = input.status === 'Verified Complete' ? 'Verified' : input.status === 'Pending Verification' ? 'Pending Verification' : input.evidenceRequired ? 'Required' : 'Not Required';
  const { offsetHours: _offsetHours, ...rest } = input;
  void _offsetHours;
  return { ...rest, priority, region: input.facilityAlias === 'Portfolio' ? 'Enterprise' : 'Region 75', createdAt, dueAt, evidenceStatus };
}

function normalizeSeverity(value: string): RemediationSeverity {
  if (['Critical', 'High', 'Medium', 'Low', 'Informational'].includes(value)) return value as RemediationSeverity;
  return 'Medium';
}

function priorityForSeverity(severity: RemediationSeverity): RemediationPriority {
  if (severity === 'Critical') return 'P1';
  if (severity === 'High') return 'P2';
  if (severity === 'Medium') return 'P3';
  return 'P4';
}
