export type RiskBand = 'Low' | 'Watch' | 'Elevated' | 'High' | 'Critical';
export type FacilityRiskBand = RiskBand | 'Unknown';
export type SourceFreshness = 'uploaded_geojson' | 'seeded_demo' | 'api' | 'live' | 'mixed' | 'verified' | 'stale' | 'missing' | 'unknown';
export type ProviderSourceStatus = 'seeded_demo' | 'live' | 'verified' | 'stale' | 'missing' | 'unknown';

export type Airport = {
  airport_id: string;
  faa_id?: string;
  iata_code?: string;
  icao_code?: string;
  airport_name: string;
  airport_type?: string;
  city?: string;
  state?: string;
  latitude: number;
  longitude: number;
  status: 'active' | 'inactive' | 'unknown';
  source_freshness: SourceFreshness;
  last_updated: string;
};

export type NormalizedFacility = {
  facility_id: string;
  facility_number?: string;
  facility_name: string;
  facility_type: 'Walmart Supercenter' | 'Neighborhood Market' | "Sam's Club" | 'Distribution Center' | 'Fulfillment Center' | 'Corporate / Critical Support' | 'Other';
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  facility_risk_score: number;
  facility_risk_band: FacilityRiskBand;
  top_risk_driver: string;
  ep_readiness_status: 'Stable' | 'Watch' | 'Gap' | 'Unknown' | 'Restricted';
  aviation_support_candidate: boolean;
  source_freshness: ProviderSourceStatus;
};

export type Facility = NormalizedFacility & {
  facility_number: string;
  latitude: number;
  longitude: number;
  facility_risk_band: RiskBand;
  ep_readiness_status: 'Stable' | 'Watch' | 'Gap' | 'Unknown';
};

export type FacilitySortMode = 'risk' | 'distance' | 'support';

export type FacilityWithDistance = NormalizedFacility & {
  facility_number: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  estimated_drive_time_minutes: number;
  drive_time_source: 'estimated' | 'routing_live' | 'unavailable' | 'unknown';
  weather_exposure: 'Low' | 'Watch' | 'Elevated' | 'High' | 'Critical' | 'Unknown';
  recommended_action: string;
  support_candidate_rank?: number;
};

export type FAAAlert = {
  alert_id: string;
  airport_id: string;
  alert_type: string;
  severity: RiskBand;
  title: string;
  summary: string;
  effective_start: string;
  effective_end: string;
  source: 'FAA';
  source_url?: string | null;
  confidence: number;
  status: 'active' | 'inactive' | 'expired';
};

export type WeatherAlert = {
  weather_alert_id: string;
  airport_id: string;
  affected_facility_ids: string[];
  alert_type: string;
  severity: RiskBand;
  summary: string;
  effective_start: string;
  effective_end: string;
  source: 'NOAA';
  source_url?: string | null;
  confidence: number;
  status: 'active' | 'inactive' | 'expired';
};

export type TripRecommendation = 'GO' | 'GO_WITH_MITIGATION' | 'DELAY_REVIEW' | 'NO_GO_RECOMMENDED' | 'INSUFFICIENT_DATA';
export type RecommendationLabel = 'GO' | 'GO WITH MITIGATION' | 'DELAY / REVIEW' | 'NO-GO RECOMMENDED' | 'INSUFFICIENT DATA';

export type RiskDriver = {
  id: string;
  label: string;
  domain: RiskDomainBreakdown['domain'];
  severity: RiskBand;
  evidence?: string;
};

export type RiskDomainBreakdown = {
  domain: 'Weather' | 'FAA/Airport' | 'Nearby Facility' | 'EP/Visit Readiness' | 'Incident/Safety Pattern' | 'Support/Vendor Readiness' | 'Data Confidence/Freshness';
  weight: number;
  raw_score: number;
  weighted_contribution: number;
  evidence: string[];
  source_status: ProviderSourceStatus;
  confidence: number;
};

export type AviationTripStatus = 'Draft' | 'Planned' | 'Scanned' | 'Report Generated' | 'Closed';
export type AviationTravelerType = 'Executive' | 'Crew' | 'Support' | 'Field / Security';
export type AviationRiskBandWithPending = 'Pending' | RiskBand;

export type AviationTripAirportStop = {
  stop_id: string;
  sequence: number;
  stop_type: 'Start' | 'Intermediate' | 'End';
  airport_id: string;
  airport_name: string;
  faa_id?: string;
  iata_code?: string;
  icao_code?: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  arrival_time?: string;
  departure_time?: string;
  scan_status: 'Not Scanned' | 'Scanned' | 'Needs Refresh';
  nearby_facility_ids: string[];
  selected_facility_ids: string[];
  airport_risk_score?: number;
  airport_risk_band?: AviationRiskBandWithPending;
  faa_watch_count?: number;
  weather_alert_count?: number;
};

export type AviationSelectedFacility = {
  trip_id: string;
  stop_id: string;
  airport_id: string;
  facility_id: string;
  selected: boolean;
  selection_reason?: string;
  recommended_role?: 'Support / Staging' | 'Monitor' | 'Verification Required' | 'Avoid' | 'Visit Site';
  distance_miles: number;
  facility_risk_score?: number;
  facility_risk_band?: FacilityRiskBand;
};

export type AviationMultiAirportTrip = {
  trip_id: string;
  trip_name: string;
  trip_status: AviationTripStatus;
  traveler_type: AviationTravelerType;
  trip_start: string;
  trip_end: string;
  default_radius_miles: number;
  facility_types: string[];
  airports: AviationTripAirportStop[];
  selected_facilities: AviationSelectedFacility[];
  overall_risk_score?: number;
  overall_risk_band?: AviationRiskBandWithPending;
  confidence?: number;
  last_scanned?: string;
};

export type TripRiskResult = {
  score: number;
  band: RiskBand;
  confidence: number;
  recommendation: TripRecommendation;
  recommendation_label: RecommendationLabel;
  recommendation_rationale: string;
  drivers: string[];
  risk_drivers: RiskDriver[];
  domain_breakdown: RiskDomainBreakdown[];
  caveats: string[];
  required_mitigations: string[];
};

export type TripReadinessAction = {
  action_id: string;
  trip_id: string;
  title: string;
  description: string;
  owner_role: string;
  due_time: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Verified' | 'Closed';
  evidence_required: boolean;
  evidence_type?: string;
  evidence_note?: string;
  evidence_file_name?: string;
  evidence_received?: boolean;
  verifier_name?: string;
  verified_at?: string;
  created_from_driver: string;
  source_domain: 'Weather' | 'FAA' | 'Facility' | 'EP' | 'Incident' | 'Support' | 'Data Freshness';
  related_facility_id?: string;
  created_at: string;
  updated_at: string;
};

export type AviationBriefStatus = 'Draft' | 'Reviewed' | 'Final';

export type AviationGeneratedBrief = {
  brief_id: string;
  trip_id: string | null;
  brief_name: string;
  airport_id: string | null;
  airport_label: string;
  trip_window: string;
  risk_band: string;
  risk_score: number;
  content: string;
  generated_by: string;
  generated_at: string;
  status: AviationBriefStatus;
  source_freshness: ProviderSourceStatus;
};

export type AviationTripClosureSummary = {
  closed_at: string;
  closed_by_role: string;
  final_review_status: string;
  final_risk_score: number;
  final_risk_band: string;
  completed_actions_count: number;
  open_actions_count: number;
  unresolved_risk_drivers: string[];
  final_notes: string;
};

export type AviationTripPlan = {
  trip_id: string;
  trip_name: string;
  airport_id: string;
  airport_snapshot: Airport;
  trip_start: string | null;
  trip_end: string | null;
  radius_miles: number;
  facility_types: string[];
  traveler_type?: string;
  nearby_facilities: FacilityWithDistance[];
  faa_alerts: FAAAlert[];
  weather_alerts: WeatherAlert[];
  risk_score: number;
  risk_band: string;
  confidence: number;
  primary_drivers: string[];
  readiness_actions: TripReadinessAction[];
  generated_brief?: string;
  status: 'draft' | 'active' | 'reviewed' | 'closed';
  created_at: string;
  updated_at: string;
  last_scanned: string;
  source_freshness: 'seeded_demo' | 'live' | 'mixed' | 'stale' | 'unknown';
  closure_summary?: AviationTripClosureSummary;
};

export type AviationUserRole =
  | 'aviation_admin'
  | 'aviation_user'
  | 'executive_protection'
  | 'global_security'
  | 'field_security'
  | 'fpi_admin'
  | 'viewer';

export type AviationPermissions = {
  canViewAviationModule: boolean;
  canViewSensitiveTripDetails: boolean;
  canViewTravelerDetails: boolean;
  canViewEPReadiness: boolean;
  canGenerateBrief: boolean;
  canCopyBrief: boolean;
  canCreateReadinessActions: boolean;
  canViewGoNoGoRecommendation: boolean;
};
