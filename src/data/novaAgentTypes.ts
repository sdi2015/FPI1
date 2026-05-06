import type { StatusTone } from './fpiTypes';

export type NovaTaskStatus = 'idle' | 'requested' | 'plan-generated' | 'awaiting-approval' | 'running' | 'completed' | 'failed';
export type NovaMessageRole = 'user' | 'nova' | 'system';
export type NovaIntent = 'analysis' | 'recommendation' | 'draft' | 'task-plan' | 'code-puppy-task';

export type NovaContextSignal = {
  label: string;
  value: string | number;
  tone: StatusTone;
  detail?: string;
};

export type NovaContextStore = {
  id: string;
  name: string;
  location: string;
  region?: string;
  riskLevel?: string;
  riskScore?: number;
  activeTroubles?: number;
  openDeficiencies?: number;
  falseAlarms90Days?: number;
  nextInspectionDue?: string;
};

export type NovaContext = {
  activeModule: string;
  selectedScope: string;
  selectedStoreIds: string[];
  selectedFilters: string[];
  portfolioPosture: string;
  syntheticDataMode: boolean;
  kpis: NovaContextSignal[];
  riskSignals: NovaContextSignal[];
  relevantAlerts: NovaContextSignal[];
  fireLifeSafety?: {
    totalSites: number;
    activeTroubles: number;
    openDeficiencies: number;
    falseAlarms90Days: number;
    overdueInspections: number;
    highRiskSites: number;
  };
  topStores: NovaContextStore[];
  vendorProviderRecords: NovaContextSignal[];
  remediationTasks: NovaContextSignal[];
};

export type NovaTaskPlan = {
  id: string;
  title: string;
  intent: NovaIntent;
  requiresApproval: boolean;
  status: NovaTaskStatus;
  requestedAction: string;
  steps: string[];
  approvalReason?: string;
  resultSummary?: string;
  error?: string;
};

export type NovaResponseSection = {
  title: string;
  items: string[];
};

export type NovaMessage = {
  id: string;
  role: NovaMessageRole;
  content: string;
  timestamp: string;
  sections?: NovaResponseSection[];
  taskPlan?: NovaTaskPlan;
};

export type NovaAgentRequest = {
  message: string;
  context: NovaContext;
  history: NovaMessage[];
};

export type NovaAgentResponse = {
  message: NovaMessage;
  taskPlan?: NovaTaskPlan;
};
