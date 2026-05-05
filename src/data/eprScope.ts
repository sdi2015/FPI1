import type { EprData, EprIncident } from './eprTypes';
import type { FireAlarmSite } from './fireAlarmTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';

export function applyEprScope(data: EprData, fireSites: FireAlarmSite[], scope: StoreScopeState): EprData {
  if (scope.mode === 'all') return data;
  if (hasEmptyStoreScope(scope)) return emptyEprData(data);

  const facilityIds = new Set(getScopedStoreIds(fireSites, scope).map(Number));
  const facilities = data.field_operations.facilities.filter((facility) => facilityIds.has(Number(facility.facility_id)));
  const routeFacilities = data.visit_planner.route_facilities.filter((facility) => facilityIds.has(Number(facility.facility_id)));

  const tasks = data.tasks_governance.tasks.filter((task) => facilityIds.has(Number(task.facility_id)));
  const recentIncidents = data.incident_intelligence.recent_incident_sample.filter((incident) => !incident.facility_id || facilityIds.has(Number(incident.facility_id)));
  const mitigationIncidents = data.security_mitigation.incidents.filter((incident) => !incident.facility_id || facilityIds.has(Number(incident.facility_id)));

  return {
    ...data,
    kpis: {
      ...data.kpis,
      visit_facilities: routeFacilities.length,
      tasks: tasks.length,
      remediations: data.tasks_governance.remediations.length,
      markets: new Set(facilities.map((facility) => facility.market)).size,
      incident_records: recentIncidents.length,
      recent_incidents: recentIncidents.length,
      security_incidents: mitigationIncidents.length,
    },
    field_operations: {
      ...data.field_operations,
      facilities,
      top_facilities_by_incident_sample: data.field_operations.top_facilities_by_incident_sample.filter(([facilityId]) => facilityIds.has(Number(facilityId))),
    },
    visit_planner: {
      ...data.visit_planner,
      route_facilities: routeFacilities,
    },
    incident_intelligence: {
      ...data.incident_intelligence,
      recent_incident_sample: recentIncidents,
      incident_type_counts: countIncidentTypes(recentIncidents),
      severity_counts: countIncidentSeverity(recentIncidents),
      state_counts: countIncidentsBy(recentIncidents, (incident) => incident.state || 'Unknown'),
    },
    security_mitigation: {
      ...data.security_mitigation,
      incidents: mitigationIncidents,
      incident_type_counts: countIncidentTypes(mitigationIncidents),
      store_counts: countIncidentsBy(mitigationIncidents, (incident) => String(incident.facility_id ?? 'Unknown')),
    },
    tasks_governance: {
      ...data.tasks_governance,
      tasks,
    },
  };
}

function emptyEprData(data: EprData): EprData {
  return {
    ...data,
    kpis: { ...data.kpis, visit_facilities: 0, tasks: 0, markets: 0, incident_records: 0, recent_incidents: 0, security_incidents: 0 },
    field_operations: { ...data.field_operations, facilities: [], top_facilities_by_incident_sample: [] },
    visit_planner: { ...data.visit_planner, route_facilities: [], nearby_facilities: [] },
    incident_intelligence: { ...data.incident_intelligence, recent_incident_sample: [], incident_type_counts: [], severity_counts: [], state_counts: [] },
    security_mitigation: { ...data.security_mitigation, incidents: [], incident_type_counts: [], store_counts: [] },
    tasks_governance: { ...data.tasks_governance, tasks: [] },
  };
}

function countIncidentTypes(incidents: EprIncident[]): Array<[string, number]> {
  return countIncidentsBy(incidents, (incident) => incident.incident_type || 'Unknown');
}

function countIncidentSeverity(incidents: EprIncident[]): Array<[string, number]> {
  return countIncidentsBy(incidents, (incident) => String(incident.severity ?? 'Unknown'));
}

function countIncidentsBy(incidents: EprIncident[], getKey: (incident: EprIncident) => string): Array<[string, number]> {
  const counts = incidents.reduce<Record<string, number>>((accumulator, incident) => {
    const key = getKey(incident);
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}
