import type { FireAlarmSite } from './fireAlarmTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';
import type { ThreatRiskData, ThreatRiskFacility, ThreatRiskSignal } from './threatRiskTypes';

export function applyThreatRiskScope(data: ThreatRiskData, fireSites: FireAlarmSite[], scope: StoreScopeState): ThreatRiskData {
  if (scope.mode === 'all') return data;
  if (hasEmptyStoreScope(scope)) return emptyThreatRiskData(data);

  const scopedIds = new Set(getScopedStoreIds(fireSites, scope));
  const facilities = data.facilities.filter((facility) => scopedIds.has(facility.facilityId));
  const signals = data.signals.filter((signal) => scopedIds.has(signal.facilityId));

  return {
    ...data,
    summary: summarize(facilities, signals),
    facilities,
    signals,
    incidentTypeCounts: countBy(signals.filter((signal) => signal.id.startsWith('THR-INC')), (signal) => signal.signalType),
    marketRiskCounts: countBy(facilities.filter((facility) => ['High', 'Critical'].includes(facility.riskTier)), (facility) => facility.market),
  };
}

function emptyThreatRiskData(data: ThreatRiskData): ThreatRiskData {
  return {
    ...data,
    summary: summarize([], []),
    facilities: [],
    signals: [],
    incidentTypeCounts: [],
    marketRiskCounts: [],
  };
}

function summarize(facilities: ThreatRiskFacility[], signals: ThreatRiskSignal[]): ThreatRiskData['summary'] {
  const averageRiskScore = facilities.length > 0 ? Math.round((facilities.reduce((total, facility) => total + facility.riskScore, 0) / facilities.length) * 10) / 10 : 0;
  return {
    facilities: facilities.length,
    criticalFacilities: facilities.filter((facility) => facility.riskTier === 'Critical').length,
    highFacilities: facilities.filter((facility) => facility.riskTier === 'High').length,
    threatSignals: signals.length,
    severeSignals: signals.filter((signal) => signal.severity === 'High' || signal.severity === 'Critical').length,
    openThreatTasks: facilities.reduce((total, facility) => total + facility.criticalTaskCount + facility.highTaskCount, 0),
    averageRiskScore,
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string): Array<[string, number]> {
  const counts = items.reduce<Record<string, number>>((accumulator, item) => {
    const key = getKey(item) || 'Unknown';
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
}
