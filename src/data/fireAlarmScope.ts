import type { FireAlarmProgramData } from './fireAlarmTypes';
import type { StoreScopeState } from './storeScope';
import { getScopedStoreIds } from './storeScope';

export function applyFireAlarmScope(data: FireAlarmProgramData, scope: StoreScopeState): FireAlarmProgramData {
  const scopedSiteIds = new Set(getScopedStoreIds(data.sites, scope));
  const sites = data.sites.filter((site) => scopedSiteIds.has(site.id));

  if (scope.mode === 'all') return data;

  return {
    ...data,
    summary: {
      totalSites: sites.length,
      totalDevices: data.devices.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
      totalEvents: data.events.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
      totalInspections: data.inspections.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
      totalServiceRecords: data.serviceRecords.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
      totalDeficiencies: data.deficiencies.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
      totalComplianceReports: data.complianceReports.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)).length,
    },
    sites,
    devices: data.devices.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    events: data.events.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    inspections: data.inspections.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    serviceRecords: data.serviceRecords.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    deficiencies: data.deficiencies.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    complianceReports: data.complianceReports.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
    recommendations: data.recommendations.filter((record) => record.siteId && scopedSiteIds.has(record.siteId)),
  };
}
