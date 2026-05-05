import type { FireAlarmSite } from './fireAlarmTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';
import type { StoreCameraHealth, TechnologyHealthData } from './technologyHealthTypes';

export function applyTechnologyHealthScope(data: TechnologyHealthData, fireSites: FireAlarmSite[], scope: StoreScopeState): TechnologyHealthData {
  if (scope.mode === 'all') return data;
  if (hasEmptyStoreScope(scope)) return createEmptyTechnologyHealth(data);

  const selectedAliases = new Set(getScopedStoreIds(fireSites, scope));
  const storeHealth = data.storeHealth.filter((store) => selectedAliases.has(store.siteAlias));
  const recorderHealth = data.recorderHealth.filter((recorder) => selectedAliases.has(recorder.siteAlias));
  const workQueue = data.workQueue.filter((item) => selectedAliases.has(item.siteAlias));
  const predictiveCandidates = data.predictiveSummary.candidates.filter((candidate) => selectedAliases.has(candidate.siteAlias));

  return {
    ...data,
    regionSummary: {
      ...data.regionSummary,
      stores: storeHealth.length,
      recorders: recorderHealth.length,
      totalCameras: sum(storeHealth, 'totalCameras'),
      onlineCameras: sum(storeHealth, 'onlineCameras'),
      offlineCameras: sum(storeHealth, 'offlineCameras'),
      issueCameras: sum(storeHealth, 'issueCameraCount'),
      ipCameras: sum(storeHealth, 'ipTotal'),
      analogCameras: sum(storeHealth, 'analogTotal'),
      onlinePercent: percent(sum(storeHealth, 'onlineCameras'), sum(storeHealth, 'totalCameras')),
      healthStatus: scopedHealthStatus(storeHealth),
      storeHealthDistribution: countBy(storeHealth, (store) => store.healthStatus),
      recordingProfileMissing: sum(storeHealth, 'missingProfileCount'),
    },
    storeHealth,
    recorderHealth,
    analytics: {
      ...data.analytics,
      storeStatusCounts: countBy(storeHealth, (store) => store.healthStatus),
      recorderStatusCounts: countBy(recorderHealth, (recorder) => recorder.recorderStatus),
      topOfflineStores: [...storeHealth].sort((a, b) => b.offlineCameras - a.offlineCameras).slice(0, 12),
      topIssueStores: [...storeHealth].sort((a, b) => (b.issueCameraCount + b.missingProfileCount + b.misplacedSubnetCount) - (a.issueCameraCount + a.missingProfileCount + a.misplacedSubnetCount)).slice(0, 12),
    },
    complianceSummary: {
      ...data.complianceSummary,
      storeComplianceCards: storeHealth.length,
      criticalServiceTicketCandidates: storeHealth.filter((store) => store.healthStatus === 'Critical' || store.offlineCameras >= 20).length,
      profileWarnings: sum(storeHealth, 'missingProfileCount'),
      networkPlacementFlags: sum(storeHealth, 'misplacedSubnetCount'),
    },
    predictiveSummary: {
      ...data.predictiveSummary,
      candidates: predictiveCandidates,
    },
    workQueue,
  };
}

function createEmptyTechnologyHealth(data: TechnologyHealthData): TechnologyHealthData {
  return {
    ...data,
    regionSummary: {
      ...data.regionSummary,
      stores: 0,
      recorders: 0,
      totalCameras: 0,
      onlineCameras: 0,
      offlineCameras: 0,
      issueCameras: 0,
      ipCameras: 0,
      analogCameras: 0,
      onlinePercent: 0,
      healthStatus: 'Unknown',
      storeHealthDistribution: {},
      recordingProfileMissing: 0,
    },
    storeHealth: [],
    recorderHealth: [],
    analytics: { ...data.analytics, storeStatusCounts: {}, recorderStatusCounts: {}, topOfflineStores: [], topIssueStores: [] },
    complianceSummary: { ...data.complianceSummary, storeComplianceCards: 0, criticalServiceTicketCandidates: 0, profileWarnings: 0, networkPlacementFlags: 0 },
    predictiveSummary: { ...data.predictiveSummary, candidates: [] },
    workQueue: [],
  };
}

function sum<K extends keyof StoreCameraHealth>(stores: StoreCameraHealth[], key: K): number {
  return stores.reduce((total, store) => total + Number(store[key] ?? 0), 0);
}

function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function scopedHealthStatus(stores: StoreCameraHealth[]): string {
  if (stores.length === 0) return 'Unknown';
  if (stores.some((store) => store.healthStatus === 'Critical')) return 'Critical';
  if (stores.some((store) => store.healthStatus === 'Warning')) return 'Warning';
  return 'Healthy';
}

function countBy<T>(items: T[], getKey: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const key = getKey(item) || 'Unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
}
