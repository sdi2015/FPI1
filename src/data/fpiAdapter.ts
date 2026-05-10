import type {
  RawAlarmSignal,
  RawCameraIssue,
  RawFacility,
  RawFpiMaster,
  RawPanelInventory,
  RawRemediation,
  RawTask,
} from './fpiRawTypes';
import type {
  FpiAlarmSignal,
  FpiCameraIssue,
  FpiFacility,
  FpiMetadata,
  FpiPanel,
  FpiProgramData,
  FpiRemediation,
  FpiRiskTier,
  FpiWorkItem,
} from './fpiTypes';

const UNKNOWN = 'Unknown';

type RawFpiMasterWithArrays = RawFpiMaster & {
  facilities: RawFacility[];
  tasks: RawTask[];
  remediations: RawRemediation[];
  alarm_signals: RawAlarmSignal[];
  camera_issues: RawCameraIssue[];
  panel_inventory: RawPanelInventory[];
};

export function adaptFpiMaster(raw: RawFpiMaster): FpiProgramData {
  assertMasterShape(raw);

  const master = raw as RawFpiMasterWithArrays;
  const metadata = adaptMetadata(master);
  const facilities = master.facilities.map(adaptFacility);

  return {
    metadata,
    facilities,
    tasks: master.tasks.map(adaptTask),
    remediations: master.remediations.map(adaptRemediation),
    alarmSignals: master.alarm_signals.map(adaptAlarmSignal),
    cameraIssues: master.camera_issues.map(adaptCameraIssue),
    panelInventory: master.panel_inventory.map(adaptPanel),
  };
}

function assertMasterShape(raw: RawFpiMaster): asserts raw is Required<
  Pick<RawFpiMaster, 'facilities' | 'tasks' | 'remediations' | 'alarm_signals' | 'camera_issues' | 'panel_inventory'>
> & RawFpiMaster {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Master JSON is malformed or empty.');
  }

  const requiredArrays: Array<keyof RawFpiMaster> = [
    'facilities',
    'tasks',
    'remediations',
    'alarm_signals',
    'camera_issues',
    'panel_inventory',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(raw[key])) {
      throw new Error(`Master JSON is missing expected array: ${key}.`);
    }
  }

  if (!raw.facilities || raw.facilities.length === 0) {
    throw new Error('Master JSON contains no facilities to profile.');
  }
}

function adaptMetadata(raw: RawFpiMaster): FpiMetadata {
  const source = raw.metadata?.[0];

  return {
    datasetName: source?.dataset_name ?? 'synthetic_single_region_master',
    classification: source?.classification ?? UNKNOWN,
    dataMode: source?.data_mode ?? UNKNOWN,
    generatedAt: source?.generated_at ?? UNKNOWN,
    region: source?.region ?? 'Synthetic Region 75',
  };
}

function adaptFacility(raw: RawFacility): FpiFacility {
  return {
    facilityId: raw.facility_id,
    facilityName: raw.facility_name ?? raw.facility_id,
    market: raw.market ?? UNKNOWN,
    region: raw.region ?? UNKNOWN,
    division: raw.division ?? UNKNOWN,
    city: raw.city ?? UNKNOWN,
    state: raw.state ?? UNKNOWN,
    address: raw.address,
    latitude: toNullableNumber(raw.latitude),
    longitude: toNullableNumber(raw.longitude),
    locationSource: raw.location_source,
    banner: raw.banner ?? UNKNOWN,
    riskScore: toNumber(raw.risk_score),
    riskTier: normalizeRiskTier(raw.risk_tier),
  };
}

function adaptTask(raw: RawTask): FpiWorkItem {
  return {
    id: raw.task_id,
    facilityId: raw.facility_id,
    title: raw.title ?? raw.description ?? raw.task_id,
    priority: raw.priority ?? UNKNOWN,
    status: raw.status ?? UNKNOWN,
    ownerRole: raw.owner_role ?? UNKNOWN,
    riskType: inferRiskType(raw.title ?? raw.description ?? ''),
  };
}

function adaptRemediation(raw: RawRemediation): FpiRemediation {
  return {
    id: raw.remediation_id,
    taskId: raw.task_id ?? '',
    riskType: raw.risk_type ?? UNKNOWN,
    severity: raw.severity ?? UNKNOWN,
    status: raw.status ?? UNKNOWN,
  };
}

function adaptAlarmSignal(raw: RawAlarmSignal): FpiAlarmSignal {
  return {
    id: raw.signal_id,
    facilityId: raw.facility_id,
    type: raw.signal_type ?? UNKNOWN,
    category: raw.signal_category ?? UNKNOWN,
    severity: raw.severity ?? UNKNOWN,
    priority: raw.priority ?? UNKNOWN,
    status: raw.status ?? UNKNOWN,
    occurredAt: raw.occurred_at ?? UNKNOWN,
  };
}

function adaptCameraIssue(raw: RawCameraIssue): FpiCameraIssue {
  return {
    id: raw.camera_issue_id,
    facilityId: raw.facility_id,
    issueType: raw.camera_issue_type ?? UNKNOWN,
    severity: raw.severity ?? UNKNOWN,
    status: raw.status ?? UNKNOWN,
    area: raw.camera_area ?? UNKNOWN,
  };
}

function adaptPanel(raw: RawPanelInventory): FpiPanel {
  return {
    id: raw.panel_id,
    facilityId: raw.facility_id,
    panelType: raw.panel_type ?? UNKNOWN,
    vendor: raw.panel_vendor ?? UNKNOWN,
    healthScore: toNumber(raw.health_score),
    status: raw.status ?? UNKNOWN,
  };
}

function normalizeRiskTier(value: unknown): FpiRiskTier {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value;
  }
  return 'Unknown';
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function inferRiskType(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes('camera') || normalized.includes('vms')) return 'Camera coverage degradation';
  if (normalized.includes('fire') || normalized.includes('suppression')) return 'Fire/life-safety assurance';
  if (normalized.includes('network') || normalized.includes('dvr')) return 'Network/security device posture';
  if (normalized.includes('access') || normalized.includes('door')) return 'Access control exception';
  if (normalized.includes('intrusion') || normalized.includes('alarm')) return 'Alarm/signal review';
  return 'Protection posture review';
}
