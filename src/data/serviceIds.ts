export const SERVICE_IDS = {
  READINESS: 'readiness',
  FIRE_SYSTEM: 'fire-system',
  CAMERA_CONTROLS: 'camera-controls',
  DEVICE_POSTURE: 'device-posture',
  THREAT_RISK: 'threat-risk',
  REMEDIATION: 'remediation',
  VENDOR_INTELLIGENCE: 'vendor-intelligence',
  EXTERNAL_COORDINATION: 'external-coordination',
  SETTINGS: 'settings',
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS];

const CAPABILITY_TO_SERVICE_ID: Record<string, ServiceId> = {
  'executive-readiness': SERVICE_IDS.READINESS,
  'fire-system-monitoring': SERVICE_IDS.FIRE_SYSTEM,
  'camera-technical-control': SERVICE_IDS.CAMERA_CONTROLS,
  'network-device-posture': SERVICE_IDS.DEVICE_POSTURE,
  'threat-risk-scoring': SERVICE_IDS.THREAT_RISK,
  'remediation-orchestration': SERVICE_IDS.REMEDIATION,
  'vendor-intelligence': SERVICE_IDS.VENDOR_INTELLIGENCE,
  'external-coordination': SERVICE_IDS.EXTERNAL_COORDINATION,
};

const SERVICE_TO_CAPABILITY_ID: Record<ServiceId, string> = Object.entries(CAPABILITY_TO_SERVICE_ID).reduce(
  (accumulator, [capabilityId, serviceId]) => ({ ...accumulator, [serviceId]: capabilityId }),
  {} as Record<ServiceId, string>,
);

export function serviceIdForCapability(capabilityId: string): ServiceId {
  return CAPABILITY_TO_SERVICE_ID[capabilityId] ?? SERVICE_IDS.READINESS;
}

export function capabilityIdForService(serviceId: ServiceId): string {
  return SERVICE_TO_CAPABILITY_ID[serviceId] ?? 'executive-readiness';
}
