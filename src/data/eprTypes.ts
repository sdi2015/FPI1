export type EprMetadata = {
  source_folder: string;
  data_environment: string;
  classification: string;
  analysis_status: string;
  file_count_analyzed: number;
};

export type EprKpis = {
  visit_facilities: number;
  tasks: number;
  remediations: number;
  markets: number;
  incident_records: number;
  recent_incidents: number;
  security_incidents: number;
  security_solutions: number;
  hotel_recommendations: number;
};

export type EprFacility = {
  facility_id: number;
  facility_name: string;
  market: string;
  region: string;
  division: string;
  open_task_count: number;
  overdue_task_count: number;
  critical_task_count: number;
  avg_remediation_hours: number;
  risk_score: number;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
};

export type EprHotel = {
  hotel_id: string;
  name: string;
  brand: string;
  address: string;
  city: string;
  state: string;
  rating: number;
  price_per_night: number;
  walmart_preferred: boolean;
  image_url?: string;
  distance_from_airport?: number;
  amenities?: string[];
  safety_score?: {
    overall_score: number;
    crime_index: number;
    store_incidents: number;
    news_sentiment: string;
    safety_features: string[];
    risk_factors: string[];
  };
};

export type EprIncident = {
  id: number;
  facility_id?: number;
  incident_date?: string;
  incident_time?: string;
  incident_type: string;
  severity: number | string;
  description: string;
  city?: string;
  state?: string;
  region?: number;
  market?: number;
};

export type EprSecuritySolution = {
  id: number;
  name: string;
  solution_type: string;
  upfront_cost: number;
  annual_cost: number;
  coverage_area: string;
  effectiveness_rating: number;
  prevents_incident_types: string;
  notes?: string;
};

export type EprTask = {
  task_id: string;
  facility_id: number;
  facility_name: string;
  market: string;
  region: string;
  owner_role: string;
  owner_name: string;
  priority: string;
  status: string;
  evidence_required: boolean;
  title: string;
  description: string;
  due_date: string;
  sla_hours: number;
};

export type EprData = {
  metadata: EprMetadata;
  executive_summary: {
    modules: string[];
    recommended_ui_home: string;
    business_value: Record<string, unknown>;
  };
  kpis: EprKpis;
  field_operations: {
    facilities: EprFacility[];
    markets: Array<Record<string, unknown>>;
    top_facilities_by_incident_sample: Array<[string, number]>;
  };
  visit_planner: {
    route_facilities: EprFacility[];
    nearby_facilities: Array<Record<string, unknown>>;
    workflow: string[];
  };
  hotel_intelligence: {
    workflow: Record<string, unknown>;
    safety_scoring: Record<string, unknown>;
    recommendation_ranking: Record<string, unknown>;
    hotels: EprHotel[];
  };
  incident_intelligence: {
    stats: Record<string, unknown>;
    recent_incident_sample: EprIncident[];
    incident_type_counts: Array<[string, number]>;
    severity_counts: Array<[string, number]>;
    state_counts: Array<[string, number]>;
  };
  security_mitigation: {
    incidents: EprIncident[];
    solutions: EprSecuritySolution[];
    incident_type_counts: Array<[string, number]>;
    store_counts: Array<[string, number]>;
    cost_by_type: Array<[string, number]>;
    recommender_rules: string[];
    roi_formula: Record<string, string>;
  };
  tasks_governance: {
    tasks: EprTask[];
    remediations: Array<Record<string, unknown>>;
    features: Array<Record<string, unknown>>;
  };
  source_inventory: Array<{ path: string; bytes: number; extension: string }>;
};
