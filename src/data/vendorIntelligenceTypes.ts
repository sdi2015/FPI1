export type VendorScoreBreakdown = {
  strategicRelevance?: number;
  maturityReadiness?: number;
  evidenceQuality?: number;
  capabilityCoverage?: number;
  freshness?: number;
  governanceRisk?: number;
};

export type VendorCandidate = {
  vendorId: string;
  company: string;
  technologyProduct: string;
  category: string;
  recommendationScore: number;
  maturityLevel: string;
  assessmentStatus: string;
  capabilityTags: string[];
  scoreBreakdown?: VendorScoreBreakdown;
  evidenceLevel?: string;
  strategicFitRationale?: string;
  dateTracked?: string;
  rationale: string;
};

export type VendorSolution = {
  id: string;
  company: string;
  technologyProduct: string;
  category: string;
  useCase: string;
  addsValueToWalmart: string;
  maturityLevel: string;
  sourceUrlPublisher: string;
  assessmentStatus: string;
  analysisCompleted: string;
  initialAssessmentResults: string;
  additionalNotes: string;
  trackerMonth: string;
  sourceWorkbook: string;
  sourceSheet: string;
  dateTracked: string;
  capabilityTags: string[];
  riskDomains: string[];
  recommendationScore: number;
  scoreBreakdown?: VendorScoreBreakdown;
  evidenceLevel?: string;
  strategicFitRationale?: string;
};

export type VendorSolutionPlay = {
  playId: string;
  issue: string;
  capabilityTag: string;
  whenToUse: string;
  recommendedCandidates: VendorCandidate[];
};

export type SentryAssessmentRequest = {
  requestId: string;
  company: string;
  technologyProduct: string;
  requestedBy: string;
  storeContext: string;
  status: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  createdAt: string;
};

export type ProviderReportTemplate = {
  apiStatus: string;
  reportTypes: string[];
  requiredFields: string[];
  optionalFields: string[];
};

export type VendorIntelligenceData = {
  metadata: {
    generatedAt: string;
    sponsor: 'SENTRY';
    dataMode: string;
    sourcePath: string;
    sourceFiles: string[];
    governanceNote: string;
  };
  summary: {
    trackedVendors: number;
    trackedSolutions: number;
    assessedSolutions: number;
    recommendedCandidates: number;
    capabilityAreas: number;
    sourceTrackers: number;
  };
  vendors: VendorSolution[];
  solutionPlays: VendorSolutionPlay[];
  assessmentQueue: SentryAssessmentRequest[];
  providerReportTemplate: ProviderReportTemplate;
  categoryCounts: Array<[string, number]>;
  capabilityCounts: Array<[string, number]>;
};

export type ProviderReportDraft = {
  facilityId: string;
  providerName: string;
  reportType: string;
  rating: string;
  summary: string;
  impact: string;
  requestedFollowUp: string;
};
