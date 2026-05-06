import type { FireAlarmProgramData } from './fireAlarmTypes';
import type { FpiDashboardMetrics, FpiProgramData } from './fpiTypes';
import { getRiskLevel } from './fireAlarmMetrics';
import type { Capability } from './program';
import type { StoreScopeState } from './storeScope';
import type { NovaContext, NovaContextSignal, NovaContextStore } from './novaAgentTypes';

export function buildNovaContext({
  activeCapability,
  metrics,
  programData,
  fireAlarmData,
  scopeSummary,
  storeScope,
}: {
  activeCapability: Capability;
  metrics?: FpiDashboardMetrics;
  programData?: FpiProgramData;
  fireAlarmData?: FireAlarmProgramData | null;
  scopeSummary: string;
  storeScope: StoreScopeState;
}): NovaContext {
  const scopedStoreIds = storeScope.mode === 'stores' ? storeScope.selectedStoreIds : [];
  const fireSites = fireAlarmData?.sites ?? [];
  const selectedFireSites = scopedStoreIds.length > 0 ? fireSites.filter((site) => scopedStoreIds.includes(site.id)) : fireSites;
  const totalFalseAlarms = selectedFireSites.reduce((sum, site) => sum + site.falseAlarms90Days, 0);
  const activeTroubles = selectedFireSites.reduce((sum, site) => sum + site.activeTroubles, 0);
  const openDeficiencies = selectedFireSites.reduce((sum, site) => sum + site.openDeficiencies, 0);
  const overdueInspections = selectedFireSites.filter((site) => isPastDue(site.nextInspectionDue)).length;
  const highRiskSites = selectedFireSites.filter((site) => site.riskScore >= 70).length;
  const topStores: NovaContextStore[] = selectedFireSites
    .map((site) => ({
      id: site.id,
      name: site.name,
      location: `${site.city}, ${site.state}`,
      region: site.region,
      riskLevel: getRiskLevel(site.riskScore),
      riskScore: site.riskScore,
      activeTroubles: site.activeTroubles,
      openDeficiencies: site.openDeficiencies,
      falseAlarms90Days: site.falseAlarms90Days,
      nextInspectionDue: site.nextInspectionDue,
    }))
    .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
    .slice(0, 8);

  const kpis: NovaContextSignal[] = [
    { label: 'Overall Posture', value: metrics?.overallStatus ?? 'WATCH', tone: metrics?.overallStatus === 'CRITICAL' ? 'critical' : metrics?.overallStatus === 'WATCH' ? 'watch' : 'ready' },
    { label: 'Facilities Profiled', value: metrics?.facilitiesProfiled ?? programData?.facilities.length ?? selectedFireSites.length, tone: 'track' },
    { label: 'Critical Exceptions', value: metrics?.criticalExceptions ?? highRiskSites, tone: highRiskSites > 0 ? 'critical' : 'ready' },
    { label: 'Active Work Queue', value: metrics?.activeWorkQueue ?? openDeficiencies, tone: openDeficiencies > 0 ? 'watch' : 'ready' },
  ];

  const riskSignals: NovaContextSignal[] = [
    { label: 'Fire/Life Safety Troubles', value: activeTroubles, tone: activeTroubles > 0 ? 'watch' : 'ready', detail: 'Active panel/device trouble conditions in scope.' },
    { label: 'Open Deficiencies', value: openDeficiencies, tone: openDeficiencies > 0 ? 'critical' : 'ready', detail: 'Remediation pressure from fire/life-safety findings.' },
    { label: 'False/Nuisance Alarms 90D', value: totalFalseAlarms, tone: totalFalseAlarms > 10 ? 'watch' : 'stable', detail: 'Trailing 90-day nuisance alarm concentration.' },
    { label: 'Overdue Inspections', value: overdueInspections, tone: overdueInspections > 0 ? 'critical' : 'ready', detail: 'Inspection governance exposure.' },
  ];

  return {
    activeModule: activeCapability.navLabel ?? activeCapability.title,
    selectedScope: scopeSummary,
    selectedStoreIds: scopedStoreIds,
    selectedFilters: [`Scope: ${scopeSummary}`],
    portfolioPosture: String(metrics?.overallStatus ?? 'WATCH'),
    syntheticDataMode: true,
    kpis,
    riskSignals,
    relevantAlerts: riskSignals.filter((signal) => signal.tone === 'critical' || signal.tone === 'watch'),
    fireLifeSafety: {
      totalSites: selectedFireSites.length,
      activeTroubles,
      openDeficiencies,
      falseAlarms90Days: totalFalseAlarms,
      overdueInspections,
      highRiskSites,
    },
    topStores,
    vendorProviderRecords: [
      { label: 'Vendor Intelligence', value: 'Provider scorecards available', tone: 'track' },
      { label: 'Parking lot issue routing', value: 'Use vendor recommendation workflow', tone: 'stable' },
    ],
    remediationTasks: [
      { label: 'Active Work Queue', value: metrics?.activeWorkQueue ?? openDeficiencies, tone: openDeficiencies > 0 ? 'watch' : 'ready' },
      { label: 'Evidence Needed', value: 'Inspection reports, photos, service tickets', tone: 'track' },
    ],
  };
}

function isPastDue(value?: string): boolean {
  const timestamp = Date.parse(value ?? '');
  return Number.isFinite(timestamp) && timestamp < Date.now();
}
