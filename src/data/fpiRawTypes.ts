export type RawRiskTier = 'Low' | 'Medium' | 'High' | 'Critical' | string;
export type RawSeverity = 'Low' | 'Medium' | 'High' | 'Critical' | string;
export type RawWorkStatus = 'Open' | 'In Progress' | 'Blocked' | 'Monitoring' | 'Closed' | string;

export type RawFpiMaster = {
  metadata?: RawMetadata[];
  facilities?: RawFacility[];
  security_technology?: RawSecurityTechnology[];
  panel_inventory?: RawPanelInventory[];
  alarm_signals?: RawAlarmSignal[];
  camera_issues?: RawCameraIssue[];
  incidents?: RawIncident[];
  tasks?: RawTask[];
  remediations?: RawRemediation[];
  store_leadership?: RawStoreLeadership[];
  users?: RawUser[];
  schema_column_catalog?: RawSchemaColumn[];
  data_dictionary?: RawDataDictionaryEntry[];
};

export type RawMetadata = {
  dataset_name?: string;
  classification?: string;
  data_mode?: string;
  generated_at?: string;
  region?: string;
  source_note?: string;
  facility_count?: number;
};

export type RawFacility = {
  facility_id: string;
  facility_name?: string;
  market?: string;
  region?: string;
  division?: string;
  city?: string;
  state?: string;
  address?: string;
  banner?: string;
  open_task_count?: number;
  overdue_task_count?: number;
  critical_task_count?: number;
  avg_remediation_hours?: number;
  risk_score?: number;
  risk_tier?: RawRiskTier;
  data_mode?: string;
};

export type RawSecurityTechnology = {
  facility_id: string;
  facility_name?: string;
  cctv_system?: string;
  camera_count?: number;
  dvr_model?: string;
  access_control_system?: string;
  card_readers?: number;
  intrusion_detection?: string;
  fire_suppression?: string;
  emergency_lighting?: string;
  panic_buttons?: number;
  asset_protection_towers?: number;
  rfid_gates?: number;
  license_plate_recognition?: string;
  facial_recognition?: string;
  network_security?: string;
  last_audit_date?: string;
  data_mode?: string;
};

export type RawPanelInventory = {
  panel_id: string;
  facility_id: string;
  facility_name?: string;
  panel_type?: string;
  panel_vendor?: string;
  panel_model?: string;
  firmware_version?: string;
  health_score?: number;
  status?: 'Normal' | 'Warning' | 'Trouble' | string;
  last_inspection_date?: string;
  next_inspection_due?: string;
  battery_health?: string;
  line_supervision?: string;
  data_mode?: string;
};

export type RawAlarmSignal = {
  signal_id: string;
  facility_id: string;
  facility_name?: string;
  region?: string;
  market?: string;
  signal_type?: string;
  signal_category?: string;
  severity?: RawSeverity;
  priority?: string;
  occurred_at?: string;
  acknowledged_at?: string;
  status?: RawWorkStatus;
  source_panel_type?: string;
  source_zone?: string;
  false_alarm_likelihood?: number;
  dispatch_required?: boolean;
  notes?: string;
};

export type RawCameraIssue = {
  camera_issue_id: string;
  facility_id: string;
  facility_name?: string;
  region?: string;
  market?: string;
  camera_id?: string;
  camera_area?: string;
  camera_issue_type?: string;
  severity?: RawSeverity;
  status?: RawWorkStatus;
  detected_at?: string;
  retention_days_available?: number;
  last_good_frame_at?: string;
  vms_health?: string;
  network_health?: string;
  vendor_ticket_id?: string;
  notes?: string;
};

export type RawIncident = {
  Location?: string;
  City?: string;
  State?: string;
  Address?: string;
  Banner?: string;
  Region?: string;
  Market?: string;
  'Incident Occurred Date'?: string;
  'Incident Occurred Time'?: string;
  'Incident Type'?: string;
  Comments?: string;
};

export type RawTask = {
  task_id: string;
  facility_id: string;
  facility_name?: string;
  market?: string;
  region?: string;
  owner_role?: string;
  owner_name?: string;
  priority?: 'P1' | 'P2' | 'P3' | string;
  status?: RawWorkStatus;
  evidence_required?: boolean;
  title?: string;
  description?: string;
  created_at?: string;
  due_date?: string;
  updated_at?: string;
  sla_hours?: number;
  evidence_url?: string;
  closed_at?: string;
};

export type RawRemediation = {
  remediation_id: string;
  risk_id?: string;
  task_id?: string;
  risk_type?: string;
  severity?: RawSeverity;
  status?: RawWorkStatus;
  sla_hours?: number;
  reopened_count?: number;
  created_at?: string;
  last_reopened_at?: string;
  verified_at?: string;
  notes?: string;
};

export type RawStoreLeadership = {
  facility_id: string;
  facility_name?: string;
  market?: string;
  city?: string;
  state?: string;
  address?: string;
  store_manager?: string;
  comanager?: string;
  co_manager?: string;
  asset_protection_manager?: string;
  people_lead?: string;
  facility_manager?: string;
  security_tech_lead?: string;
};

export type RawUser = {
  user_id: string;
  full_name?: string;
  role?: string;
  email?: string;
  market?: string;
  region?: string;
  division?: string;
  store_assignment?: string;
  title?: string;
  reports_to?: string;
};

export type RawSchemaColumn = {
  source_file?: string;
  column_name?: string;
  position?: number;
  source_type?: string;
};

export type RawDataDictionaryEntry = {
  sheet?: string;
  description?: string;
};
