import { aviationApiRequest } from './aviationApiClient';
import { getAviationPermissions } from './aviationAuthorizationService';
import {isAviationApiEnabled, isAviationProductionMode } from './aviationRuntimeConfig';
import type { AviationPermissions, AviationUserRole } from '../types/aviation';

export type AviationIdentity = {
  user_id: string;
  display_name: string;
  email?: string;
  roles: AviationUserRole[];
  active_role: AviationUserRole;
  permissions: AviationPermissions;
  source: 'enterprise_iam' | 'demo_fallback';
};

const fallbackRole: AviationUserRole = 'aviation_admin';

function isAviationRole(value: unknown): value is AviationUserRole {
  return ['aviation_admin', 'aviation_user', 'executive_protection', 'global_security', 'field_security', 'fpi_admin', 'viewer'].includes(String(value));
}

function normalizeIdentity(raw: unknown): AviationIdentity {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const roles = Array.isArray(item.roles) ? item.roles.filter(isAviationRole) : [];
  const activeRole = isAviationRole(item.active_role) ? item.active_role : roles[0] ?? 'viewer';
  const permissions = item.permissions && typeof item.permissions === 'object' ? item.permissions as AviationPermissions : getAviationPermissions(activeRole);
  return {
    user_id: String(item.user_id ?? item.id ?? 'unknown-user'),
    display_name: String(item.display_name ?? item.name ?? item.email ?? 'Authorized aviation user'),
    email: typeof item.email === 'string' ? item.email : undefined,
    roles: roles.length ? roles : [activeRole],
    active_role: activeRole,
    permissions,
    source: 'enterprise_iam',
  };
}

export function canUseLocalAviationRoleSelector(): boolean {
  return !isAviationProductionMode();
}

export async function getCurrentAviationIdentity(): Promise<AviationIdentity> {
  if (isAviationApiEnabled()) {
    try {
      return normalizeIdentity(await aviationApiRequest<unknown>('/me/aviation-permissions'));
    } catch (error) {
      if (isAviationProductionMode()) throw error;
    }
  }

  return {
    user_id: 'demo-user',
    display_name: 'Demo aviation user',
    roles: [fallbackRole],
    active_role: fallbackRole,
    permissions: getAviationPermissions(fallbackRole),
    source: 'demo_fallback',
  };
}
