export type TechnologyStatus = 'Normal' | 'Warning' | 'Degraded' | 'Critical' | 'Unknown' | 'Not Applicable';
export type TechnologySeverity = 'Informational' | 'Low' | 'Medium' | 'High' | 'Critical';
export type TechnologyFreshness = 'Current' | 'Aging' | 'Stale' | 'Unknown' | 'Not Applicable';
export type TechnologyConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type TechnologyDomain = 'Fire Alarm' | 'Camera/VMS' | 'Recorder' | 'Access Control' | 'Network/Security Device' | 'LPR' | 'Other';

export type TechnologyIssue = {
  issue_id: string;
  facility_id: string;
  domain: TechnologyDomain;
  status: TechnologyStatus;
  severity: TechnologySeverity;
  summary: string;
  source_id: string;
  confidence: TechnologyConfidence;
  freshness_status: TechnologyFreshness;
  creates_remediation_id: string;
  risk_driver_ids: string[];
  role_visibility: string[];
  engineer_detail_ref?: string;
};

export type TechnologySourceFreshness = {
  source_id: string;
  source_label: string;
  adapter_mode: 'Local JSON' | 'SQLite' | 'Future Adapter Placeholder';
  freshness_status: TechnologyFreshness;
  last_demo_update: string;
  confidence: TechnologyConfidence;
};

export type TechnologyAdapterRun = {
  adapter_id: string;
  adapter_mode: string;
  run_started_at: string;
  run_completed_at: string;
  result: 'Success' | 'Partial' | 'Failed' | 'Skipped';
  record_count: number;
  warnings: string[];
};

export type CameraFleetSummary = {
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  onlinePercent: number;
  status: string;
  storeCount: number;
  storeHealthDistribution: Record<string, number>;
  thresholds: Record<string, string>;
  intelSummary: Record<string, number | string | null>;
  marchSummary: Record<string, number | string | null>;
};

export type RegionHealthSummary = {
  region: string;
  stores: number;
  recorders: number;
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  issueCameras: number;
  ipCameras: number;
  analogCameras: number;
  onlinePercent: number;
  healthStatus: string;
  storeHealthDistribution: Record<string, number>;
  recordingProfileAssigned?: number | null;
  recordingProfileMissing?: number | null;
  retentionOk?: number | null;
  retentionBelow30d?: number | null;
  retentionUnknown?: number | null;
};

export type StoreCameraHealth = {
  siteAlias: string;
  region: string;
  facilityType: string;
  vmsPlatform: string;
  healthStatus: string;
  onlinePercent: number;
  totalCameras: number;
  onlineCameras: number;
  offlineCameras: number;
  unknownStatus: number;
  ipTotal: number;
  ipOnline: number;
  ipOffline: number;
  analogTotal: number;
  analogOnline: number;
  analogOffline: number;
  vsrvCount: number;
  issueCameraCount: number;
  ptzCount: number;
  missingProfileCount: number;
  misplacedSubnetCount: number;
  lastScan?: string | null;
  scanError?: string | null;
};

export type RecorderHealth = {
  siteAlias: string;
  recorderAlias: string;
  vmsPlatform: string;
  recorderStatus: string;
  alive: boolean;
  cameraCount: number;
  lastSeen?: string | null;
};

export type CameraWorkQueueItem = {
  id: string;
  siteAlias: string;
  title: string;
  severity: TechnologySeverity | 'High';
  channel: string;
  assignmentGroup: string;
  status: string;
  evidenceRequired: boolean;
  sla: string;
};

export type PredictiveCameraCandidate = {
  siteAlias: string;
  riskScore: number;
  forecast: string;
  drivers: string[];
  recommendedAction: string;
};

export type TechnologyHealthData = {
  metadata: {
    sourceTask: string;
    sourceOwner: string;
    classification: string;
    dataMode: string;
    generatedAt: string;
    sourceNote: string;
    analyzedFileCount: number;
  };
  adapterRun: TechnologyAdapterRun;
  sourceFreshness: TechnologySourceFreshness[];
  technologyIssues: TechnologyIssue[];
  fleetSummary: CameraFleetSummary;
  regionSummary: RegionHealthSummary;
  storeHealth: StoreCameraHealth[];
  recorderHealth: RecorderHealth[];
  analytics: {
    storeStatusCounts: Record<string, number>;
    recorderStatusCounts: Record<string, number>;
    cameraCategoryCounts: Record<string, number>;
    cameraStatusCounts: Record<string, number>;
    manufacturerCounts: Record<string, number>;
    topOfflineStores: StoreCameraHealth[];
    topIssueStores: StoreCameraHealth[];
  };
  complianceSummary: {
    policySource: string;
    policyImplications: string[];
    storeComplianceCards: number;
    criticalServiceTicketCandidates: number;
    profileWarnings: number;
    networkPlacementFlags: number;
  };
  predictiveSummary: {
    scope: string;
    candidates: PredictiveCameraCandidate[];
  };
  workQueue: CameraWorkQueueItem[];
  governanceChecklist: string[];
};
