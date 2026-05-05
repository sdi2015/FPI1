import type {
  FireAlarmDashboardModel,
  FireAlarmProgramData,
  FireAlarmRawExport,
  FireAlarmRawSite,
  FireAlarmSite,
  FireAlarmSiteSummary,
} from './fireAlarmTypes';

const UNKNOWN = 'Unknown';
const OPEN_STATUSES = new Set(['Open', 'In Progress', 'Overdue', 'Pending']);
const CRITICAL_SEVERITIES = new Set(['Critical', 'High']);

export function adaptFireAlarmExport(raw: FireAlarmRawExport): FireAlarmProgramData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Fire alarm JSON is malformed or empty.');
  }

  const data = raw.data ?? {};
  const sites = safeArray(data.sites).map(adaptSite).filter((site) => site.id !== UNKNOWN);

  if (sites.length === 0) {
    throw new Error('Fire alarm JSON contains no sites.');
  }

  return {
    exportDate: raw.exportDate ?? UNKNOWN,
    version: raw.version ?? UNKNOWN,
    description: raw.description ?? 'Fire Alarm Operations Intelligence Portal',
    summary: {
      totalSites: toNumber(raw.summary?.totalSites ?? sites.length),
      totalDevices: toNumber(raw.summary?.totalDevices ?? safeArray(data.devices).length),
      totalEvents: toNumber(raw.summary?.totalEvents ?? safeArray(data.events).length),
      totalInspections: toNumber(raw.summary?.totalInspections ?? safeArray(data.inspections).length),
      totalServiceRecords: toNumber(raw.summary?.totalServiceRecords ?? safeArray(data.serviceRecords).length),
      totalDeficiencies: toNumber(raw.summary?.totalDeficiencies ?? safeArray(data.deficiencies).length),
      totalComplianceReports: toNumber(raw.summary?.totalComplianceReports ?? safeArray(data.complianceReports).length),
    },
    sites,
    devices: safeArray(data.devices),
    events: safeArray(data.events),
    inspections: safeArray(data.inspections),
    serviceRecords: safeArray(data.serviceRecords),
    deficiencies: safeArray(data.deficiencies),
    complianceReports: safeArray(data.complianceReports),
    recommendations: safeArray(data.recommendations),
  };
}

export function buildFireAlarmDashboardModel(data: FireAlarmProgramData): FireAlarmDashboardModel {
  const siteSummaries = buildSiteSummaries(data);
  const activeTroubleSites = siteSummaries.filter((site) => site.activeTroubles > 0).length;
  const highRiskSites = siteSummaries.filter((site) => site.riskScore >= 75).length;
  const openDeficiencies = data.deficiencies.filter((deficiency) => isOpenStatus(deficiency.status)).length;
  const falseAlarms90Days = siteSummaries.reduce((total, site) => total + site.falseAlarms90Days, 0);
  const overdueInspections = siteSummaries.filter((site) => isPastDue(site.nextInspectionDue)).length;
  const criticalDeficiencies = data.deficiencies.filter(
    (deficiency) => CRITICAL_SEVERITIES.has(deficiency.severity ?? '') && isOpenStatus(deficiency.status),
  ).length;
  const status = criticalDeficiencies > 20 || activeTroubleSites > 20 ? 'ESCALATED' : criticalDeficiencies > 0 || activeTroubleSites > 0 ? 'WATCH' : 'READY';

  return {
    status,
    kpis: [
      { label: 'Fire Sites', value: data.summary.totalSites, status: 'SITES', tone: 'expanding', caption: 'Sites included in the fire alarm operations intelligence export.' },
      { label: 'Fire Devices', value: formatNumber(data.summary.totalDevices), status: 'DEVICES', tone: 'stable', caption: 'Fire alarm and life-safety devices represented in the handoff dataset.' },
      { label: 'Events', value: formatNumber(data.summary.totalEvents), status: 'SIGNALS', tone: 'watch', caption: 'Fire alarm operational events available for analysis.' },
      { label: 'Open Deficiencies', value: openDeficiencies, status: 'ACTION', tone: openDeficiencies > 0 ? 'critical' : 'ready', caption: 'Open deficiency records requiring remediation, retest, or governance.' },
      { label: 'Active Trouble Sites', value: activeTroubleSites, status: 'TROUBLE', tone: activeTroubleSites > 0 ? 'critical' : 'ready', caption: 'Sites currently reporting active fire-system troubles.' },
      { label: 'False Alarms 90 Days', value: falseAlarms90Days, status: 'QUALITY', tone: falseAlarms90Days > 0 ? 'watch' : 'ready', caption: 'False-alarm volume over the trailing 90-day operational window.' },
      { label: 'Service Records', value: data.summary.totalServiceRecords, status: 'WORK', tone: 'track', caption: 'Service records connected to troubleshooting and maintenance activity.' },
      { label: 'Compliance Reports', value: data.summary.totalComplianceReports, status: 'EVIDENCE', tone: 'stable', caption: 'Inspection and compliance reports available for assurance review.' },
    ],
    highRiskSites,
    activeTroubleSites,
    openDeficiencies,
    falseAlarms90Days,
    overdueInspections,
    panelTypeBreakdown: makeBreakdown(data.sites.map((site) => site.panelType), 6),
    monitoringTypeBreakdown: makeBreakdown(data.sites.map((site) => site.monitoringType), 5),
    complianceBreakdown: makeBreakdown(data.sites.map((site) => site.complianceStatus), 6),
    contractorBreakdown: makeBreakdown(data.sites.map((site) => site.contractor), 6),
    ahjCoordination: siteSummaries
      .filter((site) => site.activeTroubles > 0 || site.openDeficiencies > 0 || site.riskScore >= 75)
      .sort((a, b) => b.riskScore - a.riskScore || b.openDeficiencies - a.openDeficiencies)
      .slice(0, 8),
    prioritySites: siteSummaries
      .sort(
        (a, b) =>
          b.activeTroubles - a.activeTroubles ||
          b.openDeficiencies - a.openDeficiencies ||
          b.criticalDeficiencies - a.criticalDeficiencies ||
          b.falseAlarms90Days - a.falseAlarms90Days ||
          b.riskScore - a.riskScore,
      ),
    recentEvents: [...data.events].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 8),
    openDeficiencyRecords: data.deficiencies.filter((deficiency) => isOpenStatus(deficiency.status)).slice(0, 8),
    recommendations: [...data.recommendations]
      .sort((a, b) => (toNumber(b.confidence) - toNumber(a.confidence)) || severityWeight(b.severity) - severityWeight(a.severity))
      .slice(0, 8),
  };
}

function buildSiteSummaries(data: FireAlarmProgramData): FireAlarmSiteSummary[] {
  return data.sites.map((site) => {
    const siteEvents = data.events.filter((event) => event.siteId === site.id);
    const siteDevices = data.devices.filter((device) => device.siteId === site.id);
    const siteServiceRecords = data.serviceRecords.filter((record) => record.siteId === site.id);
    const siteDeficiencies = data.deficiencies.filter((deficiency) => deficiency.siteId === site.id);
    const siteRecommendations = data.recommendations.filter((recommendation) => recommendation.siteId === site.id);

    return {
      ...site,
      events: siteEvents.length,
      devices: siteDevices.length,
      openServiceRecords: siteServiceRecords.filter((record) => !record.dateClosed || isOpenStatus(record.slaStatus)).length,
      criticalDeficiencies: siteDeficiencies.filter((deficiency) => CRITICAL_SEVERITIES.has(deficiency.severity ?? '') && isOpenStatus(deficiency.status)).length,
      recommendations: siteRecommendations.length,
      primaryConcern: choosePrimaryConcern(site, siteDeficiencies.length, siteEvents.length),
    };
  });
}

function adaptSite(raw: FireAlarmRawSite): FireAlarmSite {
  return {
    id: raw.id ?? UNKNOWN,
    name: raw.name ?? raw.id ?? UNKNOWN,
    city: raw.city ?? UNKNOWN,
    state: raw.state ?? UNKNOWN,
    region: raw.region ?? UNKNOWN,
    format: raw.format ?? UNKNOWN,
    sqft: toNumber(raw.sqft),
    panelType: raw.panelType ?? UNKNOWN,
    monitoringType: raw.monitoringType ?? UNKNOWN,
    lastInspection: raw.lastInspection ?? UNKNOWN,
    nextInspectionDue: raw.nextInspectionDue ?? UNKNOWN,
    openDeficiencies: toNumber(raw.openDeficiencies),
    falseAlarms90Days: toNumber(raw.falseAlarms90Days),
    activeTroubles: toNumber(raw.activeTroubles),
    riskScore: toNumber(raw.riskScore),
    complianceStatus: raw.complianceStatus ?? UNKNOWN,
    contractor: raw.contractor ?? UNKNOWN,
    ahj: raw.ahj ?? UNKNOWN,
    status: raw.status ?? UNKNOWN,
  };
}

function choosePrimaryConcern(site: FireAlarmSite, deficiencies: number, events: number): string {
  if (site.activeTroubles > 0) return `${site.activeTroubles} active troubles`;
  if (site.openDeficiencies > 0 || deficiencies > 0) return `${Math.max(site.openDeficiencies, deficiencies)} open deficiencies`;
  if (site.falseAlarms90Days > 0) return `${site.falseAlarms90Days} false alarms in 90 days`;
  if (events > 0) return `${events} fire alarm events`;
  return 'Routine fire-system assurance';
}

function isOpenStatus(status?: string): boolean {
  return !status || OPEN_STATUSES.has(status) || !['Closed', 'Complete', 'Completed', 'Resolved'].includes(status);
}

function isPastDue(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function makeBreakdown(values: string[], limit: number): Array<{ label: string; count: number }> {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    const key = value || UNKNOWN;
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function severityWeight(value?: string): number {
  if (value === 'Critical') return 4;
  if (value === 'High') return 3;
  if (value === 'Medium') return 2;
  if (value === 'Low') return 1;
  return 0;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
