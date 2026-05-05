export type RemediationSourceService =
  | 'Camera & Technical Control Monitoring'
  | 'Network & Security Device Posture';

export type RemediationSeverity = 'Informational' | 'Low' | 'Medium' | 'High' | 'Critical';
export type RemediationPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type RemediationStatus = 'New' | 'Triaged' | 'Assigned' | 'In Progress' | 'Blocked' | 'Pending Verification' | 'Verified Complete';
export type RemediationChannel = 'ServiceChannel' | 'Me@Walmart' | 'FPI Internal' | 'Security Engineering' | 'Manual Coordination';
export type EvidenceStatus = 'Not Required' | 'Required' | 'Received' | 'Rejected' | 'Pending Verification' | 'Verified';

export type RemediationCategory =
  | 'Camera Outage'
  | 'Recorder / VMS Issue'
  | 'Recording Profile / Retention'
  | 'Access Control Issue'
  | 'LPR Issue'
  | 'Network / Security Device'
  | 'Source Freshness'
  | 'Governance / Role Gating';

export type RemediationItem = {
  remediationId: string;
  sourceFindingId: string;
  sourceService: RemediationSourceService;
  facilityAlias: string;
  region: string;
  title: string;
  description: string;
  category: RemediationCategory;
  severity: RemediationSeverity;
  priority: RemediationPriority;
  status: RemediationStatus;
  ownerTeam: string;
  channel: RemediationChannel;
  slaHours: number;
  createdAt: string;
  dueAt: string;
  evidenceRequired: boolean;
  evidenceStatus: EvidenceStatus;
  evidenceChecklist: string[];
  recommendedAction: string;
  nextStep: string;
  riskDriverIds: string[];
  linkedTechnologyIssueIds: string[];
};

export type RemediationRoutingRule = {
  findingType: string;
  sourceService: RemediationSourceService;
  channel: RemediationChannel;
  ownerTeam: string;
  severityTrigger: string;
  evidenceExpectation: string;
};

export type RemediationKpis = {
  totalOpen: number;
  criticalHigh: number;
  overdue: number;
  evidenceRequired: number;
  pendingVerification: number;
  onTrackPercent: number;
};
