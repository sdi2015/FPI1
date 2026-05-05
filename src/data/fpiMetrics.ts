import type {
  FpiDashboardMetrics,
  FpiFacility,
  FpiProgramData,
  FpiReadinessBucket,
  FpiTopRiskFacility,
} from './fpiTypes';

const CLOSED_STATUSES = new Set(['Closed']);
const ACTIVE_STATUSES = new Set(['Open', 'In Progress', 'Blocked', 'Monitoring']);
const CRITICAL_SEVERITIES = new Set(['Critical']);
const HIGH_OR_CRITICAL = new Set(['High', 'Critical']);

export function calculateFpiDashboardMetrics(programData: FpiProgramData): FpiDashboardMetrics {
  try {
    const facilitiesProfiled = programData.facilities.length;
    const activeWorkQueue = programData.tasks.filter((task) => !CLOSED_STATUSES.has(task.status)).length;
    const activeSignals = programData.alarmSignals.length;
    const cameraIssues = programData.cameraIssues.length;
    const panelTrouble = programData.panelInventory.filter((panel) => panel.status === 'Trouble').length;
    const criticalExceptions = calculateCriticalExceptions(programData);
    const overallStatus = criticalExceptions >= 50 ? 'CRITICAL' : criticalExceptions > 0 ? 'WATCH' : 'READY';
    const readinessDistribution = calculateReadinessDistribution(programData.facilities);
    const topRiskFacilities = calculateTopRiskFacilities(programData);

    return {
      overallStatus,
      facilitiesProfiled,
      criticalExceptions,
      activeSignals,
      cameraIssues,
      panelTrouble,
      activeWorkQueue,
      executiveStatus: [
        { label: 'Overall Status', value: overallStatus, tone: overallStatus === 'READY' ? 'ready' : 'watch', trend: 'program posture' },
        { label: 'Facilities Profiled', value: formatNumber(facilitiesProfiled), tone: 'expanding', trend: 'master JSON' },
        { label: 'Critical Exceptions', value: formatNumber(criticalExceptions), tone: 'watch', trend: 'active critical' },
        { label: 'Active Signals', value: formatNumber(activeSignals), tone: 'stable', trend: 'alarm stream' },
        { label: 'Panel Trouble', value: formatNumber(panelTrouble), tone: 'critical', trend: 'device health' },
        { label: 'Active Work Queue', value: formatNumber(activeWorkQueue), tone: 'track', trend: 'under governance' },
      ],
      kpis: [
        {
          label: 'Facilities profiled',
          value: formatNumber(facilitiesProfiled),
          trend: `${programData.metadata.region}`,
          status: 'LIVE',
          tone: 'expanding',
          caption: 'Facility profiles loaded from the local master JSON dataset.',
        },
        {
          label: 'Critical exceptions',
          value: formatNumber(criticalExceptions),
          trend: 'active critical/P1 records',
          status: 'WATCH',
          tone: 'watch',
          caption: 'Critical active tasks, remediations, alarm signals, and camera issues requiring governance.',
        },
        {
          label: 'Active signals',
          value: formatNumber(activeSignals),
          trend: 'alarm signal records',
          status: 'MONITOR',
          tone: 'stable',
          caption: 'Security, fire, panic, supervisory, and technical signals available for analysis.',
        },
        {
          label: 'Camera issues',
          value: formatNumber(cameraIssues),
          trend: 'CCTV/VMS records',
          status: 'WATCH',
          tone: 'watch',
          caption: 'Camera and technical-control issue inventory available for service-area drilldown.',
        },
        {
          label: 'Panel trouble',
          value: formatNumber(panelTrouble),
          trend: 'Trouble status panels',
          status: 'DEVICE RISK',
          tone: 'critical',
          caption: 'Fire, intrusion, access, VMS, NVR, and sprinkler panels currently reporting trouble.',
        },
        {
          label: 'Active work queue',
          value: formatNumber(activeWorkQueue),
          trend: 'open / in progress / blocked / monitoring',
          status: 'GOVERN',
          tone: 'track',
          caption: 'Non-closed tasks requiring action, monitoring, blocker removal, or verification.',
        },
      ],
      readinessDistribution,
      topRiskFacilities,
      latestSignals: buildLatestSignals(programData, criticalExceptions, panelTrouble, activeWorkQueue),
      headline: `Overall posture is ${overallStatus} across ${formatNumber(
        facilitiesProfiled,
      )} profiled facilities, with ${formatNumber(criticalExceptions)} active critical exceptions, ${formatNumber(
        activeSignals,
      )} alarm signals, and ${formatNumber(activeWorkQueue)} active work items under governance.`,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Metric calculation failed.');
  }
}

function calculateCriticalExceptions(programData: FpiProgramData): number {
  const criticalTasks = programData.tasks.filter(
    (task) => task.priority === 'P1' && !CLOSED_STATUSES.has(task.status),
  ).length;
  const criticalRemediations = programData.remediations.filter(
    (remediation) => CRITICAL_SEVERITIES.has(remediation.severity) && !CLOSED_STATUSES.has(remediation.status),
  ).length;
  const criticalSignals = programData.alarmSignals.filter(
    (signal) => CRITICAL_SEVERITIES.has(signal.severity) && !CLOSED_STATUSES.has(signal.status),
  ).length;
  const criticalCameraIssues = programData.cameraIssues.filter(
    (issue) => CRITICAL_SEVERITIES.has(issue.severity) && !CLOSED_STATUSES.has(issue.status),
  ).length;

  return criticalTasks + criticalRemediations + criticalSignals + criticalCameraIssues;
}

function calculateReadinessDistribution(facilities: FpiFacility[]): FpiReadinessBucket[] {
  const total = Math.max(facilities.length, 1);
  const countByTier = {
    Stable: facilities.filter((facility) => facility.riskTier === 'Low').length,
    'In Review': facilities.filter((facility) => facility.riskTier === 'Medium').length,
    'Needs Action': facilities.filter((facility) => facility.riskTier === 'High').length,
    Escalated: facilities.filter((facility) => facility.riskTier === 'Critical').length,
  };

  return [
    makeBucket('Stable', countByTier.Stable, total, '#4DBDF5', 'ready', 'Low risk tier'),
    makeBucket('In Review', countByTier['In Review'], total, '#A9DDF7', 'stable', 'Medium risk tier'),
    makeBucket('Needs Action', countByTier['Needs Action'], total, '#FFC220', 'watch', 'High risk tier'),
    makeBucket('Escalated', countByTier.Escalated, total, '#FFFFFF', 'critical', 'Critical risk tier'),
  ];
}

function makeBucket(
  label: string,
  count: number,
  total: number,
  color: string,
  tone: FpiReadinessBucket['tone'],
  note: string,
): FpiReadinessBucket {
  return { label, count, value: Math.round((count / total) * 100), color, tone, note };
}

function calculateTopRiskFacilities(programData: FpiProgramData): FpiTopRiskFacility[] {
  return programData.facilities
    .map((facility) => {
      const activeFacilityTasks = programData.tasks.filter(
        (task) => task.facilityId === facility.facilityId && !CLOSED_STATUSES.has(task.status),
      );
      const facilitySignals = programData.alarmSignals.filter(
        (signal) => signal.facilityId === facility.facilityId && !CLOSED_STATUSES.has(signal.status),
      );
      const facilityCameraIssues = programData.cameraIssues.filter(
        (issue) => issue.facilityId === facility.facilityId && !CLOSED_STATUSES.has(issue.status),
      );
      const facilityRemediations = programData.remediations.filter(
        (remediation) => activeFacilityTasks.some((task) => task.id === remediation.taskId) && !CLOSED_STATUSES.has(remediation.status),
      );
      const panelTrouble = programData.panelInventory.filter(
        (panel) => panel.facilityId === facility.facilityId && panel.status === 'Trouble',
      ).length;
      const criticalExceptions =
        activeFacilityTasks.filter((task) => task.priority === 'P1').length +
        facilityRemediations.filter((remediation) => CRITICAL_SEVERITIES.has(remediation.severity)).length +
        facilitySignals.filter((signal) => CRITICAL_SEVERITIES.has(signal.severity)).length +
        facilityCameraIssues.filter((issue) => CRITICAL_SEVERITIES.has(issue.severity)).length;

      return {
        facilityId: facility.facilityId,
        facilityName: facility.facilityName,
        region: facility.region,
        market: facility.market,
        riskTier: facility.riskTier,
        riskScore: facility.riskScore,
        criticalExceptions,
        activeSignals: facilitySignals.length,
        openWorkItems: activeFacilityTasks.length,
        panelTrouble,
        primaryIssueType: choosePrimaryIssueType(activeFacilityTasks, facilitySignals, facilityCameraIssues, panelTrouble),
      };
    })
    .sort(
      (a, b) =>
        b.criticalExceptions - a.criticalExceptions ||
        riskTierWeight(b.riskTier) - riskTierWeight(a.riskTier) ||
        b.openWorkItems - a.openWorkItems ||
        b.activeSignals - a.activeSignals ||
        b.panelTrouble - a.panelTrouble ||
        b.riskScore - a.riskScore,
    )
    .slice(0, 5);
}

function choosePrimaryIssueType(
  tasks: FpiProgramData['tasks'],
  signals: FpiProgramData['alarmSignals'],
  cameraIssues: FpiProgramData['cameraIssues'],
  panelTrouble: number,
): string {
  const criticalCameraIssue = cameraIssues.find((issue) => HIGH_OR_CRITICAL.has(issue.severity));
  if (criticalCameraIssue) return formatLabel(criticalCameraIssue.issueType);

  const criticalSignal = signals.find((signal) => HIGH_OR_CRITICAL.has(signal.severity));
  if (criticalSignal) return formatLabel(criticalSignal.type);

  const priorityTask = tasks.find((task) => task.priority === 'P1' || task.priority === 'P2');
  if (priorityTask) return priorityTask.riskType;

  if (panelTrouble > 0) return 'Panel/device trouble';
  return 'Protection posture review';
}

function buildLatestSignals(programData: FpiProgramData, criticalExceptions: number, panelTrouble: number, activeWorkQueue: number): string[] {
  const fireSignals = programData.alarmSignals.filter((signal) => signal.category === 'Fire').length;
  const blockedTasks = programData.tasks.filter((task) => task.status === 'Blocked').length;
  const criticalFacilities = programData.facilities.filter((facility) => facility.riskTier === 'Critical').length;

  return [
    `Loaded ${formatNumber(programData.facilities.length)} facility profiles from ${programData.metadata.datasetName}.`,
    `Detected ${formatNumber(criticalExceptions)} active critical exceptions across tasks, remediations, alarm signals, and camera issues.`,
    `Monitoring ${formatNumber(programData.alarmSignals.length)} alarm signals, including ${formatNumber(fireSignals)} fire/life-safety signals.`,
    `${formatNumber(panelTrouble)} panels are in Trouble status and ${formatNumber(blockedTasks)} tasks are blocked in the active work queue.`,
    `${formatNumber(criticalFacilities)} facilities are escalated by risk tier with ${formatNumber(activeWorkQueue)} active work items under governance.`,
  ];
}

function riskTierWeight(tier: FpiFacility['riskTier']): number {
  if (tier === 'Critical') return 4;
  if (tier === 'High') return 3;
  if (tier === 'Medium') return 2;
  if (tier === 'Low') return 1;
  return 0;
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
