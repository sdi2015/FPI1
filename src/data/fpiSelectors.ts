import type {
  FpiAlarmSignal,
  FpiCameraIssue,
  FpiFacility,
  FpiPanel,
  FpiProgramData,
  FpiRemediation,
  FpiRiskTier,
  FpiWorkItem,
} from './fpiTypes';

const CLOSED_STATUSES = new Set(['Closed']);
const CRITICAL_SEVERITIES = new Set(['Critical']);
const HIGH_OR_CRITICAL = new Set(['High', 'Critical']);

export type FacilityDetailModel = {
  facilityId: string;
  facilityName: string;
  region: string;
  market: string;
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
  criticalExceptions: number;
  activeSignals: number;
  cameraIssues: number;
  panelTrouble: number;
  openWorkItems: number;
  primaryIssueType: string;
  signals: FpiAlarmSignal[];
  cameraIssueRecords: FpiCameraIssue[];
  panelRecords: FpiPanel[];
  workItems: FpiWorkItem[];
  remediations: FpiRemediation[];
};

export function getFacilityProfile(programData: FpiProgramData, facilityId: string): FpiFacility | null {
  return safeArray(programData.facilities).find((facility) => facility.facilityId === facilityId) ?? null;
}

export function getFacilityTasks(programData: FpiProgramData, facilityId: string): FpiWorkItem[] {
  return safeArray(programData.tasks).filter((task) => task.facilityId === facilityId);
}

export function getFacilitySignals(programData: FpiProgramData, facilityId: string): FpiAlarmSignal[] {
  return safeArray(programData.alarmSignals).filter((signal) => signal.facilityId === facilityId);
}

export function getFacilityCameraIssues(programData: FpiProgramData, facilityId: string): FpiCameraIssue[] {
  return safeArray(programData.cameraIssues).filter((issue) => issue.facilityId === facilityId);
}

export function getFacilityPanels(programData: FpiProgramData, facilityId: string): FpiPanel[] {
  return safeArray(programData.panelInventory).filter((panel) => panel.facilityId === facilityId);
}

export function getFacilityRemediations(programData: FpiProgramData, facilityId: string): FpiRemediation[] {
  const taskIds = new Set(getFacilityTasks(programData, facilityId).map((task) => task.id));
  return safeArray(programData.remediations).filter((remediation) => taskIds.has(remediation.taskId));
}

export function getFacilityDetailModel(programData: FpiProgramData, facilityId: string): FacilityDetailModel | null {
  const facility = getFacilityProfile(programData, facilityId);
  if (!facility) return null;

  const workItems = getFacilityTasks(programData, facilityId);
  const signals = getFacilitySignals(programData, facilityId);
  const cameraIssueRecords = getFacilityCameraIssues(programData, facilityId);
  const panelRecords = getFacilityPanels(programData, facilityId);
  const remediations = getFacilityRemediations(programData, facilityId);
  const openWorkItems = workItems.filter((task) => !CLOSED_STATUSES.has(task.status));
  const activeSignals = signals.filter((signal) => !CLOSED_STATUSES.has(signal.status));
  const activeCameraIssues = cameraIssueRecords.filter((issue) => !CLOSED_STATUSES.has(issue.status));
  const activeRemediations = remediations.filter((remediation) => !CLOSED_STATUSES.has(remediation.status));
  const panelTrouble = panelRecords.filter((panel) => panel.status === 'Trouble').length;

  const criticalExceptions =
    openWorkItems.filter((task) => task.priority === 'P1').length +
    activeSignals.filter((signal) => CRITICAL_SEVERITIES.has(signal.severity)).length +
    activeCameraIssues.filter((issue) => CRITICAL_SEVERITIES.has(issue.severity)).length +
    activeRemediations.filter((remediation) => CRITICAL_SEVERITIES.has(remediation.severity)).length;

  return {
    facilityId: facility.facilityId,
    facilityName: facility.facilityName,
    region: facility.region,
    market: facility.market,
    city: facility.city,
    state: facility.state,
    address: facility.address,
    latitude: facility.latitude,
    longitude: facility.longitude,
    locationSource: facility.locationSource,
    locationName: facility.locationName,
    zipCode: facility.zipCode,
    finalStatus: facility.finalStatus,
    finalPriority: facility.finalPriority,
    finalNotes: facility.finalNotes,
    googleStatus: facility.googleStatus,
    googlePriority: facility.googlePriority,
    banner: facility.banner,
    riskScore: facility.riskScore,
    riskTier: facility.riskTier,
    criticalExceptions,
    activeSignals: activeSignals.length,
    cameraIssues: cameraIssueRecords.length,
    panelTrouble,
    openWorkItems: openWorkItems.length,
    primaryIssueType: choosePrimaryIssueType(openWorkItems, activeSignals, activeCameraIssues, panelTrouble),
    signals,
    cameraIssueRecords,
    panelRecords,
    workItems: openWorkItems,
    remediations,
  };
}

function choosePrimaryIssueType(
  tasks: FpiWorkItem[],
  signals: FpiAlarmSignal[],
  cameraIssues: FpiCameraIssue[],
  panelTrouble: number,
): string {
  const criticalCameraIssue = cameraIssues.find((issue) => HIGH_OR_CRITICAL.has(issue.severity));
  if (criticalCameraIssue) return formatLabel(criticalCameraIssue.issueType);

  const criticalSignal = signals.find((signal) => HIGH_OR_CRITICAL.has(signal.severity));
  if (criticalSignal) return formatLabel(criticalSignal.type);

  const priorityTask = tasks.find((task) => task.priority === 'P1' || task.priority === 'P2');
  if (priorityTask) return priorityTask.riskType || 'Priority work item';

  if (panelTrouble > 0) return 'Panel/device trouble';
  return 'Protection posture review';
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Not available in current dataset';
}
