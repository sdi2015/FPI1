import type {
  FpiAlarmSignal,
  FpiCameraIssue,
  FpiPanel,
  FpiProgramData,
  FpiRemediation,
  FpiRiskTier,
  FpiWorkItem,
} from './fpiTypes';

const CLOSED_STATUSES = new Set(['Closed', 'Completed']);
const CRITICAL_SEVERITIES = new Set(['Critical']);
const FIRE_KEYWORDS = ['fire', 'sprinkler', 'supervisory', 'smoke', 'life safety', 'life-safety', 'alarm panel', 'panel trouble'];

export type FireSystemStatus = 'READY' | 'WATCH' | 'ESCALATED';

export type FireSystemFacilitySummary = {
  facilityId: string;
  facilityName: string;
  region: string;
  market: string;
  riskTier: FpiRiskTier;
  troubledPanelCount: number;
  fireSignals: number;
  openFireSystemWorkItems: number;
  primaryConcern: string;
};

export type FireSystemServiceModel = {
  status: FireSystemStatus;
  troubledPanels: number;
  warningPanels: number;
  fireAlarmControlPanels: number;
  sprinklerSupervisoryPanels: number;
  fireSignals: number;
  supervisorySignals: number;
  panicSignals: number;
  fireCriticalExceptions: number;
  fireSystemWorkItems: number;
  openTasks: number;
  blockedTasks: number;
  p1Tasks: number;
  monitoringTasks: number;
  closedTasks: number;
  openRemediationActions: number;
  blockedRemediationActions: number;
  completedRemediationActions: number;
  followUpFacilities: number;
  topLifeSafetySignalType: string;
  troubledFacilities: FireSystemFacilitySummary[];
  panelTypeBreakdown: Array<{ label: string; count: number }>;
  signalTypeBreakdown: Array<{ label: string; count: number }>;
  panelHealthRecords: FpiPanel[];
  lifeSafetySignals: FpiAlarmSignal[];
  criticalExceptions: Array<FpiAlarmSignal | FpiCameraIssue | FpiRemediation | FpiWorkItem>;
  workItems: FpiWorkItem[];
  remediationRecords: FpiRemediation[];
};

export function getFireSystemServiceModel(programData: FpiProgramData): FireSystemServiceModel {
  const panels = safeArray(programData.panelInventory).filter(isFireSystemPanel);
  const lifeSafetySignals = safeArray(programData.alarmSignals).filter(isLifeSafetySignal);
  const workItems = safeArray(programData.tasks).filter(isFireSystemWorkItem);
  const workItemIds = new Set(workItems.map((task) => task.id));
  const remediationRecords = safeArray(programData.remediations).filter(
    (remediation) => workItemIds.has(remediation.taskId) || textIncludesFire(remediation.riskType),
  );
  const criticalExceptions = [
    ...lifeSafetySignals.filter((signal) => CRITICAL_SEVERITIES.has(signal.severity) && !CLOSED_STATUSES.has(signal.status)),
    ...workItems.filter((task) => task.priority === 'P1' && !CLOSED_STATUSES.has(task.status)),
    ...remediationRecords.filter(
      (remediation) => CRITICAL_SEVERITIES.has(remediation.severity) && !CLOSED_STATUSES.has(remediation.status),
    ),
  ];
  const troubledPanels = panels.filter((panel) => panel.status === 'Trouble').length;
  const warningPanels = panels.filter((panel) => panel.status === 'Warning').length;
  const fireCriticalExceptions = criticalExceptions.length;

  return {
    status: fireCriticalExceptions > 10 || troubledPanels > 20 ? 'ESCALATED' : fireCriticalExceptions > 0 || troubledPanels > 0 ? 'WATCH' : 'READY',
    troubledPanels,
    warningPanels,
    fireAlarmControlPanels: panels.filter((panel) => panel.panelType.toLowerCase().includes('fire alarm')).length,
    sprinklerSupervisoryPanels: panels.filter((panel) => panel.panelType.toLowerCase().includes('sprinkler')).length,
    fireSignals: lifeSafetySignals.filter((signal) => signal.category === 'Fire' || textIncludes(signal.type, ['fire'])).length,
    supervisorySignals: lifeSafetySignals.filter((signal) => textIncludes(signal.type, ['supervisory']) || textIncludes(signal.category, ['supervisory'])).length,
    panicSignals: lifeSafetySignals.filter((signal) => textIncludes(signal.type, ['panic']) || textIncludes(signal.category, ['panic'])).length,
    fireCriticalExceptions,
    fireSystemWorkItems: workItems.length,
    openTasks: workItems.filter((task) => !CLOSED_STATUSES.has(task.status)).length,
    blockedTasks: workItems.filter((task) => task.status === 'Blocked').length,
    p1Tasks: workItems.filter((task) => task.priority === 'P1').length,
    monitoringTasks: workItems.filter((task) => task.status === 'Monitoring').length,
    closedTasks: workItems.filter((task) => task.status === 'Closed').length,
    openRemediationActions: remediationRecords.filter((remediation) => !CLOSED_STATUSES.has(remediation.status)).length,
    blockedRemediationActions: remediationRecords.filter((remediation) => remediation.status === 'Blocked').length,
    completedRemediationActions: remediationRecords.filter((remediation) => CLOSED_STATUSES.has(remediation.status)).length,
    followUpFacilities: buildTroubledFacilities(programData, panels, lifeSafetySignals, workItems).length,
    topLifeSafetySignalType: topType(lifeSafetySignals.map((signal) => signal.type)),
    troubledFacilities: buildTroubledFacilities(programData, panels, lifeSafetySignals, workItems),
    panelTypeBreakdown: makeBreakdown(panels.map((panel) => panel.panelType)),
    signalTypeBreakdown: makeBreakdown(lifeSafetySignals.map((signal) => signal.type)),
    panelHealthRecords: panels,
    lifeSafetySignals,
    criticalExceptions,
    workItems,
    remediationRecords,
  };
}

function buildTroubledFacilities(
  programData: FpiProgramData,
  panels: FpiPanel[],
  lifeSafetySignals: FpiAlarmSignal[],
  workItems: FpiWorkItem[],
): FireSystemFacilitySummary[] {
  return safeArray(programData.facilities)
    .map((facility) => {
      const facilityPanels = panels.filter((panel) => panel.facilityId === facility.facilityId);
      const troubledPanelCount = facilityPanels.filter((panel) => panel.status === 'Trouble').length;
      const facilitySignals = lifeSafetySignals.filter((signal) => signal.facilityId === facility.facilityId);
      const facilityWorkItems = workItems.filter((task) => task.facilityId === facility.facilityId && !CLOSED_STATUSES.has(task.status));

      return {
        facilityId: facility.facilityId,
        facilityName: facility.facilityName,
        region: facility.region,
        market: facility.market,
        riskTier: facility.riskTier,
        troubledPanelCount,
        fireSignals: facilitySignals.length,
        openFireSystemWorkItems: facilityWorkItems.length,
        primaryConcern: choosePrimaryConcern(facilityPanels, facilitySignals, facilityWorkItems),
      };
    })
    .filter((facility) => facility.troubledPanelCount > 0 || facility.fireSignals > 0 || facility.openFireSystemWorkItems > 0)
    .sort(
      (a, b) =>
        b.troubledPanelCount - a.troubledPanelCount ||
        b.fireSignals - a.fireSignals ||
        b.openFireSystemWorkItems - a.openFireSystemWorkItems,
    )
    .slice(0, 8);
}

function choosePrimaryConcern(panels: FpiPanel[], signals: FpiAlarmSignal[], workItems: FpiWorkItem[]): string {
  const troubledPanel = panels.find((panel) => panel.status === 'Trouble');
  if (troubledPanel) return `${troubledPanel.panelType} trouble`;

  const criticalSignal = signals.find((signal) => CRITICAL_SEVERITIES.has(signal.severity));
  if (criticalSignal) return `${formatLabel(criticalSignal.type)} signal`;

  const priorityTask = workItems.find((task) => task.priority === 'P1' || task.priority === 'P2');
  if (priorityTask) return priorityTask.title;

  return 'Fire-system posture review';
}

function isFireSystemPanel(panel: FpiPanel): boolean {
  return textIncludesFire(`${panel.panelType} ${panel.status}`);
}

function isLifeSafetySignal(signal: FpiAlarmSignal): boolean {
  return signal.category === 'Fire' || textIncludesFire(`${signal.type} ${signal.category}`);
}

function isFireSystemWorkItem(task: FpiWorkItem): boolean {
  return textIncludesFire(`${task.title} ${task.riskType} ${task.ownerRole}`);
}

function textIncludesFire(value: string): boolean {
  return textIncludes(value, FIRE_KEYWORDS);
}

function textIncludes(value: string, keywords: string[]): boolean {
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function makeBreakdown(values: string[], limit = 5): Array<{ label: string; count: number }> {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    const key = formatLabel(value || 'Unknown');
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function topType(values: string[]): string {
  return makeBreakdown(values, 1)[0]?.label ?? 'Not available in current dataset';
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Not available';
}
