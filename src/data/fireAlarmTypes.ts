export type FireAlarmRawExport = {
  exportDate?: string;
  version?: string;
  description?: string;
  summary?: FireAlarmRawSummary;
  data?: {
    sites?: FireAlarmRawSite[];
    devices?: FireAlarmRawDevice[];
    events?: FireAlarmRawEvent[];
    inspections?: FireAlarmRawInspection[];
    serviceRecords?: FireAlarmRawServiceRecord[];
    deficiencies?: FireAlarmRawDeficiency[];
    complianceReports?: FireAlarmRawComplianceReport[];
    recommendations?: FireAlarmRawRecommendation[];
    workOrders?: unknown[];
    config?: unknown;
  };
};

export type FireAlarmRawSummary = {
  totalSites?: number;
  totalDevices?: number;
  totalEvents?: number;
  totalInspections?: number;
  totalServiceRecords?: number;
  totalDeficiencies?: number;
  totalComplianceReports?: number;
};

export type FireAlarmRawSite = {
  id?: string;
  name?: string;
  city?: string;
  state?: string;
  region?: string;
  format?: string;
  sqft?: number;
  panelType?: string;
  monitoringType?: string;
  lastInspection?: string;
  nextInspectionDue?: string;
  openDeficiencies?: number;
  falseAlarms90Days?: number;
  activeTroubles?: number;
  riskScore?: number;
  complianceStatus?: string;
  contractor?: string;
  ahj?: string;
  status?: string;
};

export type FireAlarmRawDevice = {
  id?: string;
  siteId?: string;
  address?: string;
  type?: string;
  area?: string;
  panel?: string;
  installDate?: string;
  lastTested?: string;
  status?: string;
  serviceCount?: number;
  falseAlarmCount?: number;
};

export type FireAlarmRawEvent = {
  id?: string;
  siteId?: string;
  deviceId?: string;
  date?: string;
  type?: string;
  rootCause?: string;
  area?: string;
  cmsReceived?: string;
  timeToAcknowledge?: number;
  timeToRestore?: number;
  notes?: string;
};

export type FireAlarmRawInspection = {
  id?: string;
  siteId?: string;
  date?: string;
  type?: string;
  inspector?: string;
  contractor?: string;
  result?: string;
  deviceTestCompletion?: number;
  cmsVerified?: boolean;
  documentationComplete?: boolean;
};

export type FireAlarmRawServiceRecord = {
  id?: string;
  siteId?: string;
  dateOpened?: string;
  dateClosed?: string | null;
  issueType?: string;
  area?: string;
  technician?: string;
  rootCause?: string;
  resolution?: string;
  repeatIssue?: boolean;
  slaStatus?: string;
};

export type FireAlarmRawDeficiency = {
  id?: string;
  siteId?: string;
  severity?: string;
  category?: string;
  finding?: string;
  dateIdentified?: string;
  discovered?: string;
  dueDate?: string;
  status?: string;
  retestRequired?: boolean;
};

export type FireAlarmRawComplianceReport = {
  id?: string;
  siteId?: string;
  reportDate?: string;
  reportType?: string;
  inspector?: string;
  status?: string;
  deficienciesFound?: number;
  criticalFindings?: number;
  riskImpact?: string;
  findings?: string;
};

export type FireAlarmRawRecommendation = {
  id?: string;
  siteId?: string;
  severity?: string;
  category?: string;
  title?: string;
  evidence?: string;
  action?: string;
  expectedBenefit?: string;
  suggestedDue?: string;
  confidence?: number;
};

export type FireAlarmSite = Required<Pick<FireAlarmRawSite, 'id' | 'name' | 'city' | 'state' | 'region' | 'format' | 'panelType' | 'monitoringType' | 'complianceStatus' | 'contractor' | 'ahj' | 'status'>> & {
  sqft: number;
  lastInspection: string;
  nextInspectionDue: string;
  openDeficiencies: number;
  falseAlarms90Days: number;
  activeTroubles: number;
  riskScore: number;
};

export type FireAlarmData = {
  sites: FireAlarmSite[];
  devices: FireAlarmRawDevice[];
  events: FireAlarmRawEvent[];
  inspections: FireAlarmRawInspection[];
  serviceRecords: FireAlarmRawServiceRecord[];
  deficiencies: FireAlarmRawDeficiency[];
  complianceReports: FireAlarmRawComplianceReport[];
  recommendations?: FireAlarmRawRecommendation[];
};

export type FireAlarmSummary = Required<FireAlarmRawSummary>;
export type FireAlarmExport = FireAlarmRawExport;
export type FireAlarmDevice = FireAlarmRawDevice;
export type FireAlarmEvent = FireAlarmRawEvent;
export type FireAlarmInspection = FireAlarmRawInspection;
export type FireAlarmServiceRecord = FireAlarmRawServiceRecord;
export type FireAlarmDeficiency = FireAlarmRawDeficiency;
export type FireAlarmComplianceReport = FireAlarmRawComplianceReport;

export type FireAlarmProgramData = {
  exportDate: string;
  version: string;
  description: string;
  summary: Required<FireAlarmRawSummary>;
  sites: FireAlarmSite[];
  devices: FireAlarmRawDevice[];
  events: FireAlarmRawEvent[];
  inspections: FireAlarmRawInspection[];
  serviceRecords: FireAlarmRawServiceRecord[];
  deficiencies: FireAlarmRawDeficiency[];
  complianceReports: FireAlarmRawComplianceReport[];
  recommendations: FireAlarmRawRecommendation[];
};

export type FireAlarmKpi = {
  label: string;
  value: string | number;
  status: string;
  tone: 'ready' | 'watch' | 'critical' | 'stable' | 'track' | 'buildout' | 'expanding';
  caption: string;
};

export type FireAlarmSiteSummary = FireAlarmSite & {
  events: number;
  devices: number;
  openServiceRecords: number;
  criticalDeficiencies: number;
  recommendations: number;
  primaryConcern: string;
};

export type FireAlarmDashboardModel = {
  status: 'READY' | 'WATCH' | 'ESCALATED';
  kpis: FireAlarmKpi[];
  highRiskSites: number;
  activeTroubleSites: number;
  openDeficiencies: number;
  falseAlarms90Days: number;
  overdueInspections: number;
  panelTypeBreakdown: Array<{ label: string; count: number }>;
  monitoringTypeBreakdown: Array<{ label: string; count: number }>;
  complianceBreakdown: Array<{ label: string; count: number }>;
  contractorBreakdown: Array<{ label: string; count: number }>;
  ahjCoordination: FireAlarmSiteSummary[];
  prioritySites: FireAlarmSiteSummary[];
  recentEvents: FireAlarmRawEvent[];
  openDeficiencyRecords: FireAlarmRawDeficiency[];
  recommendations: FireAlarmRawRecommendation[];
};
