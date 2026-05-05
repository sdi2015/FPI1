export type ThreatRiskTier = 'Low' | 'Medium' | 'High' | 'Critical';
export type ThreatSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type ThreatConfidence = 'Low' | 'Medium' | 'High' | 'Reference';

export type ThreatRiskSource = {
  sourceId: string;
  sourceName: string;
  sourceType: 'Internal System' | 'Walmart Program' | 'Public Safety Guidance' | 'Security Vendor' | 'Law Enforcement' | 'Manual Upload';
  integrationStatus: 'Loaded' | 'Adapter Planned' | 'Reference Only' | 'Requires Approval' | 'Unavailable';
  freshnessStatus: 'Current' | 'Aging' | 'Stale' | 'Unknown';
  confidence: ThreatConfidence;
  recordsLoaded: number;
  notes: string;
};

export type ThreatRiskFacility = {
  facilityId: string;
  facilityName: string;
  market: string;
  region: string;
  city: string;
  state: string;
  riskScore: number;
  riskTier: ThreatRiskTier;
  incidentCount: number;
  severeIncidentCount: number;
  openTaskCount: number;
  criticalTaskCount: number;
  highTaskCount: number;
  technicalIssueCount: number;
  fireTroubleCount: number;
  topDriver: string;
  drivers: string[];
  recommendedAction: string;
};

export type ThreatRiskSignal = {
  id: string;
  facilityId: string;
  facilityName: string;
  city: string;
  state: string;
  category: 'Violence' | 'Weapon' | 'Trespass' | 'Theft' | 'Technology Gap' | 'Fire/Life Safety' | 'Access Control' | 'Vendor' | 'External Coordination';
  signalType: string;
  severity: ThreatSeverity;
  confidence: Exclude<ThreatConfidence, 'Reference'>;
  occurredAt: string;
  summary: string;
  riskContribution: number;
  sourceIds: string[];
  recommendedAction: string;
  bestPracticeRefs: string[];
};

export type ThreatScoringFactor = {
  factor: string;
  weight: number;
  description: string;
};

export type ThreatBestPractice = {
  id: string;
  issuingBody: 'FBI' | 'DHS/CISA' | 'OSHA' | 'NFPA' | 'Local Law Enforcement' | 'Internal FPI';
  title: string;
  appliesTo: string[];
  guidanceSummary: string;
  recommendedActions: string[];
  evidenceNeeded: string[];
};

export type ThreatRiskData = {
  metadata: {
    generatedAt: string;
    dataMode: string;
    classification: string;
    scopeKey: 'facility_id';
    sourceFiles: string[];
    governanceNote: string;
  };
  summary: {
    facilities: number;
    criticalFacilities: number;
    highFacilities: number;
    threatSignals: number;
    severeSignals: number;
    openThreatTasks: number;
    averageRiskScore: number;
  };
  sources: ThreatRiskSource[];
  facilities: ThreatRiskFacility[];
  signals: ThreatRiskSignal[];
  incidentTypeCounts: Array<[string, number]>;
  marketRiskCounts: Array<[string, number]>;
  scoringModel: ThreatScoringFactor[];
  bestPractices: ThreatBestPractice[];
};
