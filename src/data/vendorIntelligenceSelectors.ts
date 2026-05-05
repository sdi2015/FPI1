import type { VendorSolution } from './vendorIntelligenceTypes';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function scoreTone(score: number): 'ready' | 'watch' | 'critical' | 'stable' {
  if (score >= 75) return 'ready';
  if (score >= 60) return 'watch';
  if (score < 35) return 'critical';
  return 'stable';
}

export function getTopVendorSolutions(vendors: VendorSolution[], limit = 10): VendorSolution[] {
  return [...vendors].sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, limit);
}

export function getCapabilityOptions(vendors: VendorSolution[]): string[] {
  return Array.from(new Set(vendors.flatMap((vendor) => vendor.capabilityTags))).sort((a, b) => a.localeCompare(b));
}

export function filterVendors(vendors: VendorSolution[], search: string, capability: string): VendorSolution[] {
  const term = search.trim().toLowerCase();
  return vendors
    .filter((vendor) => capability === 'all' || vendor.capabilityTags.includes(capability))
    .filter((vendor) => !term || [vendor.company, vendor.technologyProduct, vendor.category, vendor.useCase, vendor.maturityLevel, vendor.assessmentStatus, vendor.addsValueToWalmart].join(' ').toLowerCase().includes(term))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}
