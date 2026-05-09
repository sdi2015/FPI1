export type AviationEnvironmentMode = 'demo' | 'pilot' | 'production_pending' | 'production';

export type AviationPilotConfig = {
  environment_mode: AviationEnvironmentMode;
  pilot_name: string;
  pilot_owner_role: string;
  pilot_start_date: string | null;
  pilot_end_date: string | null;
  approved_user_roles: string[];
  allowed_data_sources: string[];
  restricted_data_categories: string[];
  human_decision_authority: string;
  advisory_disclaimer: string;
  pilot_success_criteria: string[];
};

export const aviationPilotConfig: AviationPilotConfig = {
  environment_mode: 'pilot',
  pilot_name: 'FPI Aviation Travel Readiness Controlled Pilot',
  pilot_owner_role: 'Aviation / Global Security',
  pilot_start_date: null,
  pilot_end_date: null,
  approved_user_roles: ['aviation_admin', 'aviation_user', 'executive_protection', 'global_security', 'fpi_admin'],
  allowed_data_sources: ['seeded_demo', 'static_json', 'localStorage', 'approved_live_weather_if_enabled'],
  restricted_data_categories: ['traveler identity', 'sensitive executive itinerary', 'law enforcement sensitive details', 'security vulnerability details beyond authorized role'],
  human_decision_authority: 'Final aviation, executive protection, security, and travel decisions remain with authorized Walmart leaders.',
  advisory_disclaimer: 'FPI Aviation Travel Readiness provides decision-support recommendations only. It does not make autonomous flight, security, or travel decisions.',
  pilot_success_criteria: ['Airport search supports both major and regional airports.', 'Radius scan returns relevant Walmart facilities.', 'Risk score is explainable to aviation/security stakeholders.', 'Generated brief is useful for leadership review.', 'Readiness actions support pre-trip coordination.', 'Source confidence and missing data are clearly labeled.', 'Role restrictions protect sensitive EP/traveler data.'],
};

export function getAviationPilotConfig(): AviationPilotConfig {
  return aviationPilotConfig;
}

export function isApprovedPilotRole(role: string): boolean {
  return aviationPilotConfig.approved_user_roles.includes(role);
}
