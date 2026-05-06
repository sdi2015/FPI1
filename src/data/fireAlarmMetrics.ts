import type {
  FireAlarmProgramData,
  FireAlarmRawComplianceReport,
  FireAlarmRawDeficiency,
  FireAlarmRawDevice,
  FireAlarmRawEvent,
  FireAlarmRawInspection,
  FireAlarmRawRecommendation,
  FireAlarmRawServiceRecord,
  FireAlarmSite,
} from './fireAlarmTypes';

export type FireAlarmKpiTone = 'normal' | 'good' | 'warning' | 'danger' | 'info';
export type FireAlarmRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type FireAlarmKpi = {
  label: string;
  value: number | string;
  tone: FireAlarmKpiTone;
  actionLabel?: string;
};

export type ChartPoint = { label: string; value: number };
export type BarChartPoint = ChartPoint & { tone?: FireAlarmKpiTone; color?: string };

export type FireAlarmSiteSummary = {
  siteId: string;
  siteName: string;
  city: string;
  state: string;
  region: string;
  riskScore: number;
  riskLevel: FireAlarmRiskLevel;
  complianceStatus: string;
  activeTroubles: number;
  openDeficiencies: number;
  falseAlarms90Days: number;
  nextInspectionDue: string;
};

export type FireAlarmSiteDirectoryRow = FireAlarmSiteSummary & {
  format: string;
  sqft: number;
  panelType: string;
  monitoringType: string;
  lastInspection: string;
  contractor: string;
  ahj: string;
  status: string;
  devices: number;
  events: number;
  serviceTickets: number;
};

export type FireAlarmSiteDetailModel = {
  site: FireAlarmSite;
  riskLevel: FireAlarmRiskLevel;
  devices: FireAlarmRawDevice[];
  events: FireAlarmRawEvent[];
  inspections: FireAlarmRawInspection[];
  serviceRecords: FireAlarmRawServiceRecord[];
  deficiencies: FireAlarmRawDeficiency[];
  complianceReports: FireAlarmRawComplianceReport[];
  recommendations: FireAlarmRawRecommendation[];
};

export type FireAlarmDashboardModel = {
  kpis: FireAlarmKpi[];
  falseAlarmsByMonth: ChartPoint[];
  topSitesByFalseAlarms: BarChartPoint[];
  sitesByRiskLevel: BarChartPoint[];
  serviceTicketsByRootCause: BarChartPoint[];
  deficienciesBySeverity: BarChartPoint[];
  inspectionCompliance: ChartPoint[];
  topRiskSites: FireAlarmSiteSummary[];
  troubledSites: FireAlarmSiteSummary[];
  openDeficiencySites: FireAlarmSiteSummary[];
  pmRecommendationSites: FireAlarmSiteSummary[];
  siteDirectoryRows: FireAlarmSiteDirectoryRow[];
  siteDetailsById: Record<string, FireAlarmSiteDetailModel>;
  scopedSiteIds: string[];
};

export function getFireAlarmDashboardModel(data: FireAlarmProgramData, selectedSiteIds?: string[]): FireAlarmDashboardModel {
  const selectedIds = selectedSiteIds && selectedSiteIds.length > 0 ? new Set(selectedSiteIds) : null;
  const sites = selectedIds ? data.sites.filter((site) => selectedIds.has(site.id)) : data.sites;
  const siteIdSet = new Set(sites.map((site) => site.id));
  const devices = data.devices.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const events = data.events.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const inspections = data.inspections.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const serviceRecords = data.serviceRecords.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const deficiencies = data.deficiencies.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const complianceReports = data.complianceReports.filter((record) => record.siteId && siteIdSet.has(record.siteId));
  const recommendations = data.recommendations.filter((record) => record.siteId && siteIdSet.has(record.siteId));

  const summaries = sites.map((site) => toSiteSummary(site));
  const overdueInspections = sites.filter((site) => isPastDue(site.nextInspectionDue)).length;
  const activeTroubles = sites.reduce((sum, site) => sum + site.activeTroubles, 0);
  const falseNuisanceAlarms = sites.reduce((sum, site) => sum + site.falseAlarms90Days, 0);
  const openDeficiencies = sites.reduce((sum, site) => sum + site.openDeficiencies, 0);
  const criticalLifeSafetyIssues = sites.filter((site) => site.riskScore >= 90 || site.activeTroubles > 0 || site.openDeficiencies >= 3).length;
  const normalCondition = sites.filter((site) => site.complianceStatus === 'Normal' && site.activeTroubles === 0 && site.openDeficiencies === 0).length;
  const inspectionComplianceRate = sites.length > 0 ? Math.round(((sites.length - overdueInspections) / sites.length) * 100) : 100;
  const pmRecommendations = derivePmRecommendations(sites, devices, recommendations);

  return {
    kpis: [
      { label: 'Total Sites', value: sites.length, tone: 'info', actionLabel: 'Portfolio' },
      { label: 'Normal Condition', value: normalCondition, tone: 'good', actionLabel: 'Healthy' },
      { label: 'Active Troubles', value: activeTroubles, tone: activeTroubles > 0 ? 'warning' : 'good', actionLabel: 'Investigate' },
      { label: 'Overdue Inspections', value: overdueInspections, tone: overdueInspections > 0 ? 'danger' : 'good', actionLabel: 'Schedule' },
      { label: 'False/Nuisance Alarms', value: falseNuisanceAlarms, tone: falseNuisanceAlarms > 0 ? 'warning' : 'good', actionLabel: 'Trailing 90d' },
      { label: 'Open Deficiencies', value: openDeficiencies, tone: openDeficiencies > 0 ? 'danger' : 'good', actionLabel: 'Remediate' },
      { label: 'Critical Life-Safety Issues', value: criticalLifeSafetyIssues, tone: criticalLifeSafetyIssues > 0 ? 'danger' : 'good', actionLabel: 'Escalate' },
      { label: 'Inspection Compliance Rate', value: `${inspectionComplianceRate}%`, tone: inspectionComplianceRate >= 95 ? 'good' : inspectionComplianceRate >= 85 ? 'warning' : 'danger', actionLabel: 'Target 95%' }, 
    ],
    falseAlarmsByMonth: buildFalseAlarmsByMonth(events, sites),
    topSitesByFalseAlarms: [...sites]
      .sort((a, b) => b.falseAlarms90Days - a.falseAlarms90Days)
      .slice(0, 10)
      .map((site) => ({ label: `${site.id} - ${site.name}, ${site.city}, ${site.state} · ${site.region}`, value: site.falseAlarms90Days, tone: site.falseAlarms90Days >= 6 ? 'danger' : site.falseAlarms90Days >= 4 ? 'warning' : site.falseAlarms90Days >= 2 ? 'info' : 'good', color: site.falseAlarms90Days >= 6 ? '#ef4444' : site.falseAlarms90Days >= 4 ? '#f97316' : site.falseAlarms90Days >= 2 ? '#facc15' : '#22c55e' })),
    sitesByRiskLevel: ['Low', 'Medium', 'High', 'Critical'].map((riskLevel) => ({
      label: riskLevel,
      value: summaries.filter((site) => site.riskLevel === riskLevel).length,
      tone: riskTone(riskLevel as FireAlarmRiskLevel),
      color: riskColor(riskLevel as FireAlarmRiskLevel),
    })),
    serviceTicketsByRootCause: makeTopBreakdown(serviceRecords.map((record) => record.rootCause || record.issueType || record.slaStatus || 'Unknown'), 8),
    deficienciesBySeverity: ['Critical', 'High', 'Medium', 'Low'].map((severity) => ({
      label: severity,
      value: deficiencies.filter((deficiency) => deficiency.severity === severity).length,
      tone: severity === 'Critical' || severity === 'High' ? 'danger' : severity === 'Medium' ? 'warning' : 'good',
      color: severity === 'Critical' || severity === 'High' ? '#dc2626' : severity === 'Medium' ? '#f59e0b' : '#16a34a',
    })),
    inspectionCompliance: buildInspectionCompliance(inspections, complianceReports),
    topRiskSites: [...summaries].sort((a, b) => b.riskScore - a.riskScore).slice(0, 12),
    troubledSites: summaries.filter((site) => site.activeTroubles > 0).sort((a, b) => b.activeTroubles - a.activeTroubles || b.riskScore - a.riskScore),
    openDeficiencySites: summaries.filter((site) => site.openDeficiencies > 0).sort((a, b) => b.openDeficiencies - a.openDeficiencies || b.riskScore - a.riskScore),
    pmRecommendationSites: summaries.filter((site) => site.falseAlarms90Days >= 3 || site.activeTroubles > 0 || site.riskScore >= 70 || site.openDeficiencies > 0).sort((a, b) => b.riskScore - a.riskScore).slice(0, 12),
    siteDirectoryRows: sites.map((site) => ({
      ...toSiteSummary(site),
      format: site.format,
      sqft: site.sqft,
      panelType: site.panelType,
      monitoringType: site.monitoringType,
      lastInspection: site.lastInspection,
      contractor: site.contractor,
      ahj: site.ahj,
      status: site.status,
      devices: devices.filter((device) => device.siteId === site.id).length,
      events: events.filter((event) => event.siteId === site.id).length,
      serviceTickets: serviceRecords.filter((record) => record.siteId === site.id).length,
    })).sort((a, b) => b.riskScore - a.riskScore),
    siteDetailsById: Object.fromEntries(sites.map((site) => [site.id, {
      site,
      riskLevel: getRiskLevel(site.riskScore),
      devices: devices.filter((record) => record.siteId === site.id),
      events: events.filter((record) => record.siteId === site.id),
      inspections: inspections.filter((record) => record.siteId === site.id),
      serviceRecords: serviceRecords.filter((record) => record.siteId === site.id),
      deficiencies: deficiencies.filter((record) => record.siteId === site.id),
      complianceReports: complianceReports.filter((record) => record.siteId === site.id),
      recommendations: recommendations.filter((record) => record.siteId === site.id),
    }])),
    scopedSiteIds: sites.map((site) => site.id),
  };
}

export function getRiskLevel(riskScore: number): FireAlarmRiskLevel {
  if (riskScore >= 90) return 'Critical';
  if (riskScore >= 70) return 'High';
  if (riskScore >= 40) return 'Medium';
  return 'Low';
}

export function riskTone(riskLevel: FireAlarmRiskLevel): FireAlarmKpiTone {
  if (riskLevel === 'Critical' || riskLevel === 'High') return 'danger';
  if (riskLevel === 'Medium') return 'warning';
  return 'good';
}

export function riskColor(riskLevel: FireAlarmRiskLevel): string {
  if (riskLevel === 'Critical') return '#ef4444';
  if (riskLevel === 'High') return '#f97316';
  if (riskLevel === 'Medium') return '#facc15';
  return '#22c55e';
}

function toSiteSummary(site: FireAlarmSite): FireAlarmSiteSummary {
  return {
    siteId: site.id,
    siteName: site.name,
    city: site.city,
    state: site.state,
    region: site.region,
    riskScore: site.riskScore,
    riskLevel: getRiskLevel(site.riskScore),
    complianceStatus: site.complianceStatus,
    activeTroubles: site.activeTroubles,
    openDeficiencies: site.openDeficiencies,
    falseAlarms90Days: site.falseAlarms90Days,
    nextInspectionDue: site.nextInspectionDue,
  };
}

function buildFalseAlarmsByMonth(events: FireAlarmRawEvent[], sites: FireAlarmSite[]): ChartPoint[] {
  const falseAlarmEvents = events.filter((event) => `${event.type ?? ''} ${event.rootCause ?? ''}`.toLowerCase().includes('false'));
  const counts = falseAlarmEvents.reduce<Record<string, number>>((accumulator, event) => {
    const label = monthLabel(event.date);
    if (!label) return accumulator;
    accumulator[label] = (accumulator[label] ?? 0) + 1;
    return accumulator;
  }, {});

  const points = Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => Date.parse(`1 ${a.label}`) - Date.parse(`1 ${b.label}`));
  if (points.length > 0) return points.slice(-8);

  const total = sites.reduce((sum, site) => sum + site.falseAlarms90Days, 0);
  return [{ label: 'Trailing 90d', value: total }];
}

function buildInspectionCompliance(inspections: FireAlarmRawInspection[], reports: FireAlarmRawComplianceReport[]): ChartPoint[] {
  if (inspections.length > 0) {
    const grouped = inspections.reduce<Record<string, { total: number; completion: number }>>((accumulator, inspection) => {
      const label = monthLabel(inspection.date);
      if (!label) return accumulator;
      accumulator[label] = accumulator[label] ?? { total: 0, completion: 0 };
      accumulator[label].total += 1;
      accumulator[label].completion += inspection.deviceTestCompletion ?? (inspection.result?.toLowerCase().includes('pass') ? 100 : 75);
      return accumulator;
    }, {});
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value: Math.round(value.completion / Math.max(value.total, 1)) }))
      .sort((a, b) => Date.parse(`1 ${a.label}`) - Date.parse(`1 ${b.label}`))
      .slice(-8);
  }

  const groupedReports = reports.reduce<Record<string, { total: number; complete: number }>>((accumulator, report) => {
    const label = monthLabel(report.reportDate);
    if (!label) return accumulator;
    accumulator[label] = accumulator[label] ?? { total: 0, complete: 0 };
    accumulator[label].total += 1;
    accumulator[label].complete += report.status?.toLowerCase().includes('complete') ? 1 : 0;
    return accumulator;
  }, {});
  return Object.entries(groupedReports).map(([label, value]) => ({ label, value: Math.round((value.complete / Math.max(value.total, 1)) * 100) })).sort((a, b) => Date.parse(`1 ${a.label}`) - Date.parse(`1 ${b.label}`)).slice(-8);
}

function makeTopBreakdown(values: string[], limit: number): BarChartPoint[] {
  const counts = values.reduce<Record<string, number>>((accumulator, value) => {
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts).map(([label, value]) => ({ label, value, tone: 'info' as FireAlarmKpiTone, color: '#2563eb' })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function derivePmRecommendations(sites: FireAlarmSite[], devices: FireAlarmRawDevice[], recommendations: FireAlarmRawRecommendation[]): number {
  const recommendedSiteCount = sites.filter((site) => site.falseAlarms90Days >= 3 || site.activeTroubles > 0 || site.riskScore >= 70).length;
  const repeatDeviceCount = devices.filter((device) => (device.serviceCount ?? 0) >= 2 || (device.falseAlarmCount ?? 0) >= 2).length;
  return Math.max(recommendations.length, recommendedSiteCount + repeatDeviceCount);
}

function isPastDue(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function monthLabel(value?: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(timestamp));
}
