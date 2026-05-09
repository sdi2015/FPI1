import type { AviationPermissions, AviationUserRole } from '../types/aviation';

const ROLE_PERMISSIONS: Record<AviationUserRole, AviationPermissions> = {
  aviation_admin: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: true,
    canViewTravelerDetails: true,
    canViewEPReadiness: true,
    canGenerateBrief: true,
    canCopyBrief: true,
    canCreateReadinessActions: true,
    canViewGoNoGoRecommendation: true,
  },
  fpi_admin: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: true,
    canViewTravelerDetails: false,
    canViewEPReadiness: true,
    canGenerateBrief: true,
    canCopyBrief: true,
    canCreateReadinessActions: true,
    canViewGoNoGoRecommendation: true,
  },
  executive_protection: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: true,
    canViewTravelerDetails: true,
    canViewEPReadiness: true,
    canGenerateBrief: true,
    canCopyBrief: true,
    canCreateReadinessActions: true,
    canViewGoNoGoRecommendation: true,
  },
  global_security: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: true,
    canViewTravelerDetails: false,
    canViewEPReadiness: true,
    canGenerateBrief: true,
    canCopyBrief: true,
    canCreateReadinessActions: true,
    canViewGoNoGoRecommendation: true,
  },
  aviation_user: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: true,
    canViewTravelerDetails: false,
    canViewEPReadiness: false,
    canGenerateBrief: true,
    canCopyBrief: true,
    canCreateReadinessActions: false,
    canViewGoNoGoRecommendation: true,
  },
  field_security: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: false,
    canViewTravelerDetails: false,
    canViewEPReadiness: false,
    canGenerateBrief: false,
    canCopyBrief: false,
    canCreateReadinessActions: true,
    canViewGoNoGoRecommendation: true,
  },
  viewer: {
    canViewAviationModule: true,
    canViewSensitiveTripDetails: false,
    canViewTravelerDetails: false,
    canViewEPReadiness: false,
    canGenerateBrief: false,
    canCopyBrief: false,
    canCreateReadinessActions: false,
    canViewGoNoGoRecommendation: false,
  },
};

export function getAviationPermissions(role: AviationUserRole): AviationPermissions {
  return ROLE_PERMISSIONS[role];
}

export function redactIfUnauthorized(value: string, allowed: boolean): string {
  return allowed ? value : 'Restricted — requires Aviation, EP, or Global Security authorization';
}
