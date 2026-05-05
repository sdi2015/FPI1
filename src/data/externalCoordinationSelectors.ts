export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function readinessTone(readiness: string): 'ready' | 'watch' | 'critical' | 'stable' {
  if (readiness === 'Escalated') return 'critical';
  if (readiness === 'Review') return 'watch';
  if (readiness === 'Ready') return 'ready';
  return 'stable';
}

export function riskTone(riskTier: string): 'ready' | 'watch' | 'critical' | 'stable' {
  if (riskTier === 'Critical') return 'critical';
  if (riskTier === 'High' || riskTier === 'Medium') return 'watch';
  if (riskTier === 'Low') return 'ready';
  return 'stable';
}
