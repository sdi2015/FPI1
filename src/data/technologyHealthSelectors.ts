import type { StoreCameraHealth, TechnologyHealthData, TechnologyIssue } from './technologyHealthTypes';

export type HealthThresholdTone = 'green' | 'yellow' | 'red';

export function healthToneForPercent(value: number): HealthThresholdTone {
  if (value >= 98) return 'green';
  if (value >= 85) return 'yellow';
  return 'red';
}

export function healthLabelForPercent(value: number): 'Healthy' | 'Warning' | 'Critical' {
  const tone = healthToneForPercent(value);
  if (tone === 'green') return 'Healthy';
  if (tone === 'yellow') return 'Warning';
  return 'Critical';
}

export function getHealthyStores(stores: StoreCameraHealth[]): StoreCameraHealth[] {
  return stores.filter((store) => healthToneForPercent(store.onlinePercent) === 'green');
}

export function getUnhealthyStores(stores: StoreCameraHealth[]): StoreCameraHealth[] {
  return sortStoresByTechnicalRisk(stores).filter((store) => healthToneForPercent(store.onlinePercent) !== 'green');
}

export function getOfflineCameraStores(stores: StoreCameraHealth[]): StoreCameraHealth[] {
  return sortStoresByTechnicalRisk(stores).filter((store) => store.offlineCameras > 0);
}

export function getCameraTechnologyIssues(data: TechnologyHealthData): TechnologyIssue[] {
  return data.technologyIssues.filter((issue) => issue.domain === 'Camera/VMS' || issue.domain === 'Recorder');
}

export function getDevicePostureIssues(data: TechnologyHealthData): TechnologyIssue[] {
  return data.technologyIssues.filter((issue) => ['Access Control', 'LPR', 'Network/Security Device', 'Recorder', 'Other'].includes(issue.domain));
}

export function sortStoresByTechnicalRisk(stores: StoreCameraHealth[]): StoreCameraHealth[] {
  return [...stores].sort((a, b) => riskValue(b) - riskValue(a));
}

export function riskValue(store: StoreCameraHealth): number {
  return (
    (100 - store.onlinePercent) * 2 +
    store.offlineCameras * 0.8 +
    store.issueCameraCount * 0.4 +
    store.missingProfileCount * 0.12 +
    store.misplacedSubnetCount * 2 +
    (store.healthStatus === 'Critical' ? 35 : store.healthStatus === 'Warning' ? 12 : 0)
  );
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(1)}%`;
}

export function formatDate(value?: string | null): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}
