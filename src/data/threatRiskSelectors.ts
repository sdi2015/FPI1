import type { ThreatRiskFacility, ThreatRiskSignal, ThreatRiskTier, ThreatSeverity } from './threatRiskTypes';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getTierTone(tier: ThreatRiskTier): 'ready' | 'watch' | 'critical' | 'stable' {
  if (tier === 'Critical') return 'critical';
  if (tier === 'High') return 'watch';
  if (tier === 'Medium') return 'stable';
  return 'ready';
}

export function getSeverityTone(severity: ThreatSeverity): 'ready' | 'watch' | 'critical' | 'stable' {
  if (severity === 'Critical') return 'critical';
  if (severity === 'High' || severity === 'Medium') return 'watch';
  return 'ready';
}

export function getTopRiskFacilities(facilities: ThreatRiskFacility[], limit = 8): ThreatRiskFacility[] {
  return [...facilities].sort((a, b) => b.riskScore - a.riskScore).slice(0, limit);
}

export function getTopThreatSignals(signals: ThreatRiskSignal[], limit = 10): ThreatRiskSignal[] {
  return [...signals].sort((a, b) => b.riskContribution - a.riskContribution).slice(0, limit);
}

export function getCoordinationCandidates(facilities: ThreatRiskFacility[]): ThreatRiskFacility[] {
  return facilities.filter((facility) => facility.riskTier === 'Critical' || facility.severeIncidentCount > 0 || facility.criticalTaskCount > 0).slice(0, 6);
}
