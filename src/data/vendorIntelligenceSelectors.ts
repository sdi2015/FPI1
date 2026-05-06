import type { VendorSolution } from './vendorIntelligenceTypes';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export type VendorScoreBand = {
  id: 'strategic' | 'recommended' | 'watchlist' | 'review' | 'deprioritized';
  label: string;
  range: string;
  tone: 'ready' | 'watch' | 'critical' | 'stable';
  guidance: string;
};

export function getVendorScoreBand(score: number): VendorScoreBand {
  if (score >= 85) return { id: 'strategic', label: 'Strategic Fit', range: '85-100', tone: 'ready', guidance: 'Strong candidate for SENTRY/FPI shortlist and executive review.' };
  if (score >= 75) return { id: 'recommended', label: 'Recommended', range: '75-84', tone: 'ready', guidance: 'Good candidate; validate fit, evidence, and implementation readiness.' };
  if (score >= 60) return { id: 'watchlist', label: 'Watchlist', range: '60-74', tone: 'watch', guidance: 'Promising but needs assessment, pilot evidence, or clearer use-case fit.' };
  if (score >= 35) return { id: 'review', label: 'Review Required', range: '35-59', tone: 'stable', guidance: 'Do not prioritize until maturity, value, or governance gaps are resolved.' };
  return { id: 'deprioritized', label: 'Do Not Prioritize', range: '0-34', tone: 'critical', guidance: 'Low current fit or explicit no-go signal; keep for record only.' };
}

export function scoreTone(score: number): 'ready' | 'watch' | 'critical' | 'stable' {
  return getVendorScoreBand(score).tone;
}

export function scorePercent(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function scoreComponent(vendor: VendorSolution, key: keyof NonNullable<VendorSolution['scoreBreakdown']>): number {
  return vendor.scoreBreakdown?.[key] ?? 0;
}

function recencyValue(vendor: VendorSolution): number {
  const date = vendor.dateTracked ? Date.parse(vendor.dateTracked) : Number.NaN;
  if (!Number.isNaN(date)) return date;
  const match = vendor.trackerMonth.match(/(20\d{2})[-_]?(\d{2})/);
  return match ? Date.parse(`${match[1]}-${match[2]}-01`) : 0;
}

export function compareVendorRecommendations(a: VendorSolution, b: VendorSolution): number {
  return (
    b.recommendationScore - a.recommendationScore ||
    scoreComponent(b, 'evidenceQuality') - scoreComponent(a, 'evidenceQuality') ||
    scoreComponent(b, 'maturityReadiness') - scoreComponent(a, 'maturityReadiness') ||
    scoreComponent(b, 'capabilityCoverage') - scoreComponent(a, 'capabilityCoverage') ||
    recencyValue(b) - recencyValue(a)
  );
}

export function getTopVendorSolutions(vendors: VendorSolution[], limit = 10): VendorSolution[] {
  return [...vendors].sort(compareVendorRecommendations).slice(0, limit);
}

export function getCapabilityOptions(vendors: VendorSolution[]): string[] {
  return Array.from(new Set(vendors.flatMap((vendor) => vendor.capabilityTags))).sort((a, b) => a.localeCompare(b));
}

export function filterVendors(vendors: VendorSolution[], search: string, capability: string): VendorSolution[] {
  const term = search.trim().toLowerCase();
  return vendors
    .filter((vendor) => capability === 'all' || vendor.capabilityTags.includes(capability))
    .filter((vendor) => !term || [vendor.company, vendor.technologyProduct, vendor.category, vendor.useCase, vendor.maturityLevel, vendor.assessmentStatus, vendor.addsValueToWalmart, vendor.evidenceLevel ?? '', vendor.strategicFitRationale ?? '', ...vendor.capabilityTags, ...vendor.riskDomains].join(' ').toLowerCase().includes(term))
    .sort(compareVendorRecommendations);
}
