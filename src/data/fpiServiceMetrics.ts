import type { FpiProgramData } from './fpiTypes';

const CLOSED_STATUSES = new Set(['Closed']);
const CRITICAL_SEVERITIES = new Set(['Critical']);
const HIGH_SEVERITIES = new Set(['High']);

export type FpiServiceMetric = {
  label: string;
  value: string | number;
  helperText?: string;
};

export type FpiServiceMetricsModel = {
  serviceName: string;
  metrics: FpiServiceMetric[];
};

export function getServiceMetrics(
  programData: FpiProgramData,
  selectedServiceId: string,
  selectedServiceName: string,
): FpiServiceMetricsModel {
  switch (selectedServiceId) {
    case 'fire-system-monitoring':
      return getFireSystemMetrics(programData, selectedServiceName);
    case 'camera-technical-control':
      return getCameraControlMetrics(programData, selectedServiceName);
    case 'remediation-orchestration':
      return getRemediationMetrics(programData, selectedServiceName);
    case 'threat-risk-scoring':
      return getThreatRiskMetrics(programData, selectedServiceName);
    default:
      return getFallbackMetrics(programData, selectedServiceName);
  }
}

function getFireSystemMetrics(programData: FpiProgramData, serviceName: string): FpiServiceMetricsModel {
  const panels = safeArray(programData.panelInventory);
  const signals = safeArray(programData.alarmSignals);

  return {
    serviceName,
    metrics: [
      { label: 'Troubled panels', value: countWhere(panels, (panel) => panel.status === 'Trouble') },
      { label: 'Warning panels', value: countWhere(panels, (panel) => panel.status === 'Warning') },
      {
        label: 'Fire alarm control panels',
        value: countWhere(panels, (panel) => panel.panelType.toLowerCase().includes('fire alarm')),
      },
      {
        label: 'Sprinkler supervisory panels',
        value: countWhere(panels, (panel) => panel.panelType.toLowerCase().includes('sprinkler')),
      },
      { label: 'Fire signals', value: countWhere(signals, (signal) => signal.category === 'Fire') },
    ],
  };
}

function getCameraControlMetrics(programData: FpiProgramData, serviceName: string): FpiServiceMetricsModel {
  const issues = safeArray(programData.cameraIssues);

  return {
    serviceName,
    metrics: [
      { label: 'Camera issues', value: issues.length },
      { label: 'Critical camera issues', value: countWhere(issues, (issue) => CRITICAL_SEVERITIES.has(issue.severity)) },
      { label: 'Offline cameras', value: countWhere(issues, (issue) => issue.issueType === 'offline') },
      { label: 'Retention gaps', value: countWhere(issues, (issue) => issue.issueType === 'retention_gap') },
      { label: 'Network latency issues', value: countWhere(issues, (issue) => issue.issueType === 'network_latency') },
    ],
  };
}

function getRemediationMetrics(programData: FpiProgramData, serviceName: string): FpiServiceMetricsModel {
  const tasks = safeArray(programData.tasks);

  return {
    serviceName,
    metrics: [
      { label: 'Active work queue', value: countWhere(tasks, (task) => !CLOSED_STATUSES.has(task.status)) },
      { label: 'Blocked tasks', value: countWhere(tasks, (task) => task.status === 'Blocked') },
      { label: 'P1 tasks', value: countWhere(tasks, (task) => task.priority === 'P1') },
      { label: 'Closed tasks', value: countWhere(tasks, (task) => task.status === 'Closed') },
      { label: 'Monitoring tasks', value: countWhere(tasks, (task) => task.status === 'Monitoring') },
    ],
  };
}

function getThreatRiskMetrics(programData: FpiProgramData, serviceName: string): FpiServiceMetricsModel {
  const signals = safeArray(programData.alarmSignals);
  const topSignalType = getTopSignalType(signals.map((signal) => signal.type));

  return {
    serviceName,
    metrics: [
      { label: 'Critical signals', value: countWhere(signals, (signal) => CRITICAL_SEVERITIES.has(signal.severity)) },
      { label: 'High signals', value: countWhere(signals, (signal) => HIGH_SEVERITIES.has(signal.severity)) },
      {
        label: 'Incident count',
        value: 'N/A',
        helperText: 'Not available in the current normalized dashboard model.',
      },
      { label: 'Top signal type', value: topSignalType },
      {
        label: 'Critical-risk facilities',
        value: countWhere(programData.facilities, (facility) => facility.riskTier === 'Critical'),
      },
    ],
  };
}

function getFallbackMetrics(programData: FpiProgramData, serviceName: string): FpiServiceMetricsModel {
  return {
    serviceName,
    metrics: [
      { label: 'Facilities in model', value: safeArray(programData.facilities).length },
      { label: 'Active work items', value: countWhere(programData.tasks, (task) => !CLOSED_STATUSES.has(task.status)) },
      { label: 'Alarm signals', value: safeArray(programData.alarmSignals).length },
      { label: 'Panel records', value: safeArray(programData.panelInventory).length },
      { label: 'Service drilldown', value: 'Planned', helperText: 'Detailed service workflow is not built in Build 2.' },
    ],
  };
}

function countWhere<T>(items: T[] | undefined | null, predicate: (item: T) => boolean): number {
  return safeArray(items).filter(predicate).length;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getTopSignalType(signalTypes: string[]): string {
  const counts = signalTypes.reduce<Record<string, number>>((accumulator, type) => {
    const key = type || 'Unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const [topType] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? [];
  return topType ? formatLabel(topType) : 'Not available in current dataset';
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
