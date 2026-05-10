export type StatusTone = 'ready' | 'watch' | 'buildout' | 'critical' | 'stable' | 'track' | 'expanding';
export type FpiRiskTier = 'Low' | 'Medium' | 'High' | 'Critical' | 'Unknown';
export type FpiOverallStatus = 'READY' | 'WATCH' | 'CRITICAL' | 'UNAVAILABLE';

export type FpiMetadata = {
  datasetName: string;
  classification: string;
  dataMode: string;
  generatedAt: string;
  region: string;
};

export type FpiFacility = {
  facilityId: string;
  facilityName: string;
  market: string;
  region: string;
  division: string;
  city: string;
  state: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationSource?: string;
  locationName?: string;
  zipCode?: string;
  finalStatus?: string;
  finalPriority?: string;
  finalNotes?: string;
  googleStatus?: string;
  googlePriority?: string;
  banner: string;
  riskScore: number;
  riskTier: FpiRiskTier;
};

export type FpiProgramData = {
  metadata: FpiMetadata;
  facilities: FpiFacility[];
  tasks: FpiWorkItem[];
  remediations: FpiRemediation[];
  alarmSignals: FpiAlarmSignal[];
  cameraIssues: FpiCameraIssue[];
  panelInventory: FpiPanel[];
};

export type FpiWorkItem = {
  id: string;
  facilityId: string;
  title: string;
  priority: string;
  status: string;
  ownerRole: string;
  riskType: string;
};

export type FpiRemediation = {
  id: string;
  taskId: string;
  riskType: string;
  severity: string;
  status: string;
};

export type FpiAlarmSignal = {
  id: string;
  facilityId: string;
  type: string;
  category: string;
  severity: string;
  priority: string;
  status: string;
  occurredAt: string;
};

export type FpiCameraIssue = {
  id: string;
  facilityId: string;
  issueType: string;
  severity: string;
  status: string;
  area: string;
};

export type FpiPanel = {
  id: string;
  facilityId: string;
  panelType: string;
  vendor: string;
  healthScore: number;
  status: string;
};

export type FpiExecutiveStatusItem = {
  label: string;
  value: string;
  tone: StatusTone;
  trend: string;
};

export type FpiKpi = {
  label: string;
  value: string;
  trend: string;
  status: string;
  tone: StatusTone;
  caption: string;
};

export type FpiReadinessBucket = {
  label: string;
  count: number;
  value: number;
  color: string;
  tone: StatusTone;
  note: string;
};

export type FpiTopRiskFacility = {
  facilityId: string;
  facilityName: string;
  region: string;
  market: string;
  riskTier: FpiRiskTier;
  riskScore: number;
  criticalExceptions: number;
  activeSignals: number;
  openWorkItems: number;
  panelTrouble: number;
  primaryIssueType: string;
};

export type FpiDashboardMetrics = {
  overallStatus: FpiOverallStatus;
  facilitiesProfiled: number;
  criticalExceptions: number;
  activeSignals: number;
  cameraIssues: number;
  panelTrouble: number;
  activeWorkQueue: number;
  elmLocationCount: number;
  geocodedFacilities: number;
  elmMediumPriority: number;
  elmHighPriority: number;
  executiveStatus: FpiExecutiveStatusItem[];
  kpis: FpiKpi[];
  readinessDistribution: FpiReadinessBucket[];
  topRiskFacilities: FpiTopRiskFacility[];
  latestSignals: string[];
  headline: string;
};

export type FpiProgramDashboard = {
  programData: FpiProgramData;
  dashboardMetrics: FpiDashboardMetrics;
};
