import type { FireAlarmSite } from './fireAlarmTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';
import type { CoordinationRequest, ExternalCoordinationData, ExternalCoordinationFacility } from './externalCoordinationTypes';

export function applyExternalCoordinationScope(data: ExternalCoordinationData, fireSites: FireAlarmSite[], scope: StoreScopeState): ExternalCoordinationData {
  if (scope.mode === 'all') return data;
  if (hasEmptyStoreScope(scope)) return scoped(data, [], []);
  const ids = new Set(getScopedStoreIds(fireSites, scope));
  return scoped(data, data.facilities.filter((facility) => ids.has(facility.facilityId)), data.coordinationRequests.filter((request) => ids.has(request.facilityId)));
}

function scoped(data: ExternalCoordinationData, facilities: ExternalCoordinationFacility[], coordinationRequests: CoordinationRequest[]): ExternalCoordinationData {
  return {
    ...data,
    facilities,
    coordinationRequests,
    summary: {
      ...data.summary,
      facilities: facilities.length,
      agencyContacts: facilities.reduce((total, facility) => total + facility.agencies.length, 0),
      prosecutorContacts: facilities.length,
      securityVendorPartners: new Set(facilities.flatMap((facility) => facility.securityVendorPartners.map((partner) => partner.partnerId))).size,
      escalatedFacilities: facilities.filter((facility) => facility.coordinationReadiness === 'Escalated').length,
      reviewFacilities: facilities.filter((facility) => facility.coordinationReadiness === 'Review').length,
    },
  };
}
