import type { StatusTone } from './fpiTypes';
import { SERVICE_IDS, type ServiceId } from './serviceIds';

export type NavigationSectionId = 'command' | 'modules' | 'aviation' | 'workspace';

export type NavigationItemConfig = {
  id: string;
  serviceId: ServiceId;
  capabilityId?: string;
  label: string;
  description?: string;
  section: NavigationSectionId;
  enabled: boolean;
  locked?: boolean;
  order: number;
  statusTone?: StatusTone;
};

export const NAVIGATION_STORAGE_KEY = 'fpi_navigation_config_v1';

export const DEFAULT_NAVIGATION_CONFIG: NavigationItemConfig[] = [
  { id: 'command-center', serviceId: SERVICE_IDS.COMMAND_CENTER, capabilityId: 'command-center', label: 'Command Center', description: 'FPI operating dashboard for facility protection posture, active risk, exceptions, and work queues.', section: 'command', enabled: true, locked: true, order: 0 },
  { id: 'epr', serviceId: SERVICE_IDS.EPR, capabilityId: 'executive-readiness', label: 'Executive Protection Readiness', description: 'Executive protection readiness workspace.', section: 'modules', enabled: true, order: 1 },
  { id: 'fire-system', serviceId: SERVICE_IDS.FIRE_SYSTEM, capabilityId: 'fire-system-monitoring', label: 'Fire & Life Safety', description: 'Fire-system monitoring and assurance.', section: 'modules', enabled: true, order: 2 },
  { id: 'camera-controls', serviceId: SERVICE_IDS.CAMERA_CONTROLS, capabilityId: 'camera-technical-control', label: 'Camera / Technical Controls', description: 'Camera and technical-control monitoring.', section: 'modules', enabled: true, order: 3 },
  { id: 'device-posture', serviceId: SERVICE_IDS.DEVICE_POSTURE, capabilityId: 'network-device-posture', label: 'Device Posture', description: 'Network and security device posture.', section: 'modules', enabled: true, order: 4 },
  { id: 'threat-risk', serviceId: SERVICE_IDS.THREAT_RISK, capabilityId: 'threat-risk-scoring', label: 'Risk Intelligence', description: 'Threat detection and risk scoring.', section: 'modules', enabled: true, order: 5 },
  { id: 'remediation', serviceId: SERVICE_IDS.REMEDIATION, capabilityId: 'remediation-orchestration', label: 'Remediation Orchestration', description: 'Findings to accountable work queues.', section: 'modules', enabled: true, order: 6 },
  { id: 'vendor-intelligence', serviceId: SERVICE_IDS.VENDOR_INTELLIGENCE, capabilityId: 'vendor-intelligence', label: 'Vendor Intelligence', description: 'Vendor intelligence and recommendations.', section: 'modules', enabled: true, order: 7 },
  { id: 'external-coordination', serviceId: SERVICE_IDS.EXTERNAL_COORDINATION, capabilityId: 'external-coordination', label: 'External Coordination', description: 'Law enforcement, prosecutor, vendor, and external coordination readiness.', section: 'modules', enabled: true, order: 8 },
  { id: 'nova', serviceId: SERVICE_IDS.NOVA, capabilityId: 'nova-agent', label: 'NOVA', description: 'Operational AI agent.', section: 'modules', enabled: true, order: 9 },
  { id: 'aviation-travel-readiness', serviceId: SERVICE_IDS.AVIATION_TRAVEL_READINESS, capabilityId: 'aviation-travel-readiness', label: 'Aviation Travel Readiness', description: 'Airport radius scanning, nearby facility posture, FAA/NOAA watch items, trip risk scoring, readiness actions, and aviation travel briefs.', section: 'aviation', enabled: true, order: 10, statusTone: 'buildout' },
  { id: 'settings', serviceId: SERVICE_IDS.SETTINGS, label: 'Settings', description: 'Workspace scope, navigation preferences, and application settings.', section: 'workspace', enabled: true, locked: true, order: 11, statusTone: 'track' },
];

const VALID_SECTIONS: NavigationSectionId[] = ['command', 'modules', 'aviation', 'workspace'];

function isNavigationSectionId(value: unknown): value is NavigationSectionId {
  return typeof value === 'string' && VALID_SECTIONS.includes(value as NavigationSectionId);
}

function defaultById() {
  return new Map(DEFAULT_NAVIGATION_CONFIG.map((item) => [item.id, item]));
}

function normalizeOrder(items: NavigationItemConfig[]): NavigationItemConfig[] {
  return [...items].sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index }));
}

export function normalizeNavigationConfig(raw: unknown): NavigationItemConfig[] {
  const defaults = defaultById();
  const source = Array.isArray(raw) ? raw : [];
  const normalized: NavigationItemConfig[] = [];

  for (const defaultItem of DEFAULT_NAVIGATION_CONFIG) {
    const saved = source.find((item) => item && typeof item === 'object' && (item as Partial<NavigationItemConfig>).id === defaultItem.id) as Partial<NavigationItemConfig> | undefined;
    const section = saved && isNavigationSectionId(saved.section) ? saved.section : defaultItem.section;
    const locked = Boolean(defaultItem.locked);
    normalized.push({
      ...defaultItem,
      label: typeof saved?.label === 'string' && saved.label.trim() ? saved.label.trim() : defaultItem.label,
      description: typeof saved?.description === 'string' ? saved.description : defaultItem.description,
      section: locked ? defaultItem.section : section,
      enabled: locked ? true : typeof saved?.enabled === 'boolean' ? saved.enabled : defaultItem.enabled,
      locked,
      order: typeof saved?.order === 'number' && Number.isFinite(saved.order) ? saved.order : defaultItem.order,
      statusTone: saved?.statusTone ?? defaultItem.statusTone,
    });
  }

  for (const saved of source) {
    if (!saved || typeof saved !== 'object') continue;
    const item = saved as Partial<NavigationItemConfig>;
    if (!item.id || defaults.has(item.id) || typeof item.serviceId !== 'string') continue;
    if (!Object.values(SERVICE_IDS).includes(item.serviceId as ServiceId)) continue;
    normalized.push({
      id: item.id,
      serviceId: item.serviceId as ServiceId,
      capabilityId: typeof item.capabilityId === 'string' ? item.capabilityId : undefined,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : item.id,
      description: typeof item.description === 'string' ? item.description : undefined,
      section: isNavigationSectionId(item.section) ? item.section : 'modules',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
      locked: false,
      order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : normalized.length,
      statusTone: item.statusTone,
    });
  }

  return normalizeOrder(normalized);
}

export function loadNavigationConfig(): NavigationItemConfig[] {
  if (typeof window === 'undefined') return DEFAULT_NAVIGATION_CONFIG;
  try {
    const raw = window.localStorage.getItem(NAVIGATION_STORAGE_KEY);
    const config = normalizeNavigationConfig(raw ? JSON.parse(raw) : null);
    saveNavigationConfig(config);
    return config;
  } catch {
    const config = normalizeNavigationConfig(null);
    saveNavigationConfig(config);
    return config;
  }
}

export function saveNavigationConfig(config: NavigationItemConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify(normalizeNavigationConfig(config)));
  } catch {
    // Local storage can be unavailable in hardened or private browsing contexts.
  }
}
