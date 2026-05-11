import type { Airport, FAAAlert, FacilityWithDistance, RiskBand, TripReadinessAction, TripRiskResult, WeatherAlert } from '../types/aviation';

export type AviationReportRiskBand = RiskBand | 'Pending' | 'Unknown';

export type AviationTravelRiskReportPayload = {
  reportId: string;
  generatedAt: string;
  preparedBy: string;
  dataMode: string;
  isDemo: boolean;
  tripName: string;
  airport: Airport | null;
  radiusMiles: number;
  travelerType: string;
  tripStart: string;
  tripEnd: string;
  selectedFacilityTypes: string[];
  nearbyFacilities: FacilityWithDistance[];
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  risk: TripRiskResult;
  scanHasRun: boolean;
  lastScannedAt: string | null;
  readinessActions: TripReadinessAction[];
  missingCoordinateCount: number;
};

export type AviationTravelRiskReportValidation = {
  canGenerate: boolean;
  messages: string[];
};

export function validateAviationTravelRiskReport(payload: AviationTravelRiskReportPayload): AviationTravelRiskReportValidation {
  const messages: string[] = [];
  if (!payload.tripName.trim()) messages.push('Create or select a trip before generating the report.');
  if (!payload.airport) messages.push('Select an airport before generating the report.');
  if (!payload.scanHasRun) messages.push('Run scan before generating the report.');
  return { canGenerate: messages.length === 0, messages };
}

export function getRiskBandTone(riskBand: string | null | undefined): 'neutral' | 'stable' | 'watch' | 'elevated' | 'high' | 'critical' {
  const normalized = (riskBand ?? 'Pending').toLowerCase();
  if (normalized === 'low') return 'stable';
  if (normalized === 'watch') return 'watch';
  if (normalized === 'elevated') return 'elevated';
  if (normalized === 'high') return 'high';
  if (normalized === 'critical') return 'critical';
  return 'neutral';
}

export function getRiskBadgeClass(riskBand: string | null | undefined): string {
  return `risk-badge risk-badge-${getRiskBandTone(riskBand)}`;
}

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function dateText(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function airportCode(airport: Airport | null): string {
  return airport?.iata_code ?? airport?.faa_id ?? airport?.icao_code ?? 'Airport pending';
}

function airportCodes(airport: Airport | null): string {
  if (!airport) return 'Not selected';
  return [airport.iata_code, airport.icao_code, airport.faa_id ? `FAA: ${airport.faa_id}` : null].filter(Boolean).join(' / ') || 'Codes unavailable';
}

function highestRiskFacility(facilities: FacilityWithDistance[]): FacilityWithDistance | null {
  return facilities[0] ?? null;
}

function closestFacility(facilities: FacilityWithDistance[]): FacilityWithDistance | null {
  return facilities.reduce<FacilityWithDistance | null>((best, facility) => !best || facility.distance_miles < best.distance_miles ? facility : best, null);
}

function supportFacility(facilities: FacilityWithDistance[]): FacilityWithDistance | null {
  return facilities.find((facility) => facility.aviation_support_candidate) ?? null;
}

function facilityLabel(facility: FacilityWithDistance | null): string {
  return facility ? `${facility.facility_name} #${facility.facility_number} (${facility.facility_risk_band}, ${facility.distance_miles.toFixed(1)} mi)` : 'None identified';
}

function primaryConcern(payload: AviationTravelRiskReportPayload): string {
  return payload.risk.drivers[0] ?? payload.risk.risk_drivers[0]?.label ?? 'No primary concern identified after scan.';
}

function recommendedPosture(payload: AviationTravelRiskReportPayload): string {
  if (!payload.scanHasRun) return 'Pending scan';
  return payload.risk.recommendation_label || 'Review with aviation, EP, and security leadership';
}

function missingDataItems(payload: AviationTravelRiskReportPayload): string[] {
  const items: string[] = [];
  if (payload.missingCoordinateCount > 0) items.push(`${payload.missingCoordinateCount} facilities hidden or excluded because coordinates are missing.`);
  if (!payload.faaAlerts.length) items.push('Missing FAA source or no FAA / airport watch items returned for selected context.');
  if (!payload.weatherAlerts.length) items.push('Missing NOAA source or no NOAA weather alerts returned for selected context.');
  if (payload.nearbyFacilities.some((facility) => ['Unknown', 'Restricted'].includes(facility.ep_readiness_status))) items.push('Some facility readiness statuses are unknown or restricted.');
  if (payload.dataMode !== 'live') items.push(`${payload.dataMode} data mode. Validate with approved operational sources before use.`);
  if (payload.isDemo) items.push('Demo dataset - not for operational use.');
  if (!payload.lastScannedAt) items.push('Scan timestamp missing.');
  return items.length ? items : ['No additional missing-data caveats identified in the current scan context.'];
}

function actionRows(actions: TripReadinessAction[]): TripReadinessAction[] {
  return actions.length ? actions : [];
}

function badge(label: string | number, band: string | null | undefined): string {
  return `<span class="${getRiskBadgeClass(band)}">${esc(label)}</span>`;
}

function tableRows<T>(items: T[], render: (item: T, index: number) => string, emptyColspan: number, emptyText: string): string {
  if (!items.length) return `<tr><td colspan="${emptyColspan}" class="muted">${esc(emptyText)}</td></tr>`;
  return items.map(render).join('');
}

export function renderAviationTravelRiskReportHtml(payload: AviationTravelRiskReportPayload): string {
  const band: AviationReportRiskBand = payload.scanHasRun ? payload.risk.band : 'Pending';
  const highest = highestRiskFacility(payload.nearbyFacilities);
  const closest = closestFacility(payload.nearbyFacilities);
  const support = supportFacility(payload.nearbyFacilities);
  const verificationCount = payload.nearbyFacilities.filter((facility) => ['High', 'Critical'].includes(facility.facility_risk_band) || facility.ep_readiness_status === 'Gap').length;
  const topDrivers = (payload.risk.drivers.length ? payload.risk.drivers : payload.risk.risk_drivers.map((driver) => driver.label)).slice(0, 5);
  const missing = missingDataItems(payload);
  const openActions = actionRows(payload.readinessActions).filter((action) => action.status !== 'Closed');

  return `<!doctype html><html><head><meta charset="utf-8"><title>FPI Aviation Travel Risk Report</title><style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f6f8fb;color:#172033;line-height:1.45}.report{max-width:1120px;margin:0 auto;padding:28px}.aviation-report-header{background:#0f172a;color:#fff;border-radius:18px;padding:24px;margin-bottom:18px}.aviation-report-header h1{margin:4px 0 8px;font-size:28px}.muted{color:#64748b}.demo{background:#78350f;color:#fde68a;border-radius:999px;padding:5px 10px;display:inline-block;font-size:12px}.aviation-risk-banner{border-radius:16px;padding:18px;margin:16px 0;border-left:8px solid #64748b;background:#eef2f7}.tone-stable{border-color:#15803d;background:#ecfdf3}.tone-watch{border-color:#ca8a04;background:#fffbeb}.tone-elevated{border-color:#ea580c;background:#fff7ed}.tone-high{border-color:#dc2626;background:#fef2f2}.tone-critical{border-color:#7f1d1d;background:#fff1f2}.tone-neutral{border-color:#64748b;background:#f1f5f9}.risk-badge{display:inline-block;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700;border:1px solid #cbd5e1;background:#f8fafc;color:#334155}.risk-badge-stable{border-color:#86efac;background:#dcfce7;color:#166534}.risk-badge-watch{border-color:#fde68a;background:#fef3c7;color:#854d0e}.risk-badge-elevated{border-color:#fed7aa;background:#ffedd5;color:#9a3412}.risk-badge-high{border-color:#fecaca;background:#fee2e2;color:#991b1b}.risk-badge-critical{border-color:#fecdd3;background:#ffe4e6;color:#7f1d1d}.risk-badge-neutral{border-color:#cbd5e1;background:#f1f5f9;color:#334155}.aviation-report-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:14px 0;box-shadow:0 8px 20px rgba(15,23,42,.04)}.aviation-report-section h2{margin:0 0 12px;font-size:18px}.aviation-report-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.aviation-report-grid div{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.aviation-report-table{width:100%;border-collapse:collapse;font-size:13px}.aviation-report-table th,.aviation-report-table td{border-bottom:1px solid #e2e8f0;padding:9px;text-align:left;vertical-align:top}.aviation-report-table th{background:#f8fafc;color:#334155}.driver-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.driver-list span{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#f8fafc}.disclaimer{border-left:5px solid #334155;background:#f8fafc;padding:12px;border-radius:10px}@media print{body{background:#fff}.report{padding:0}.aviation-report-section,.aviation-report-header{box-shadow:none;break-inside:avoid}}
</style></head><body><main class="report"><header class="aviation-report-header"><p>FPI Aviation Travel Readiness</p><h1>FPI AVIATION TRAVEL RISK REPORT</h1><p>${esc(payload.tripName || 'Draft trip')} · ${esc(airportCode(payload.airport))} · Generated ${esc(dateText(payload.generatedAt))}</p>${payload.isDemo ? '<span class="demo">Demo dataset - not for operational use</span>' : ''}</header><section class="aviation-risk-banner tone-${getRiskBandTone(band)}"><strong>Overall risk: ${badge(band, band)}</strong><br><span>Risk score: ${payload.scanHasRun ? esc(payload.risk.score) : 'Pending'} · Confidence: ${payload.scanHasRun ? esc(`${payload.risk.confidence}%`) : 'Pending'} · Recommended posture: ${esc(recommendedPosture(payload))}</span></section>
${section('1. Executive Summary', `<div class="aviation-report-grid"><div><strong>Overall risk:</strong><br>${badge(band, band)}</div><div><strong>Risk score:</strong><br>${payload.scanHasRun ? esc(payload.risk.score) : 'Pending'}</div><div><strong>Confidence:</strong><br>${payload.scanHasRun ? esc(`${payload.risk.confidence}%`) : 'Pending'}</div><div><strong>Recommended posture:</strong><br>${esc(recommendedPosture(payload))}</div><div><strong>Primary concern:</strong><br>${esc(primaryConcern(payload))}</div><div><strong>Human review required:</strong><br>Yes</div></div>`)}
${section('2. Trip Overview', `<div class="aviation-report-grid"><div><strong>Trip name:</strong><br>${esc(payload.tripName || 'Not named')}</div><div><strong>Airport:</strong><br>${esc(payload.airport?.airport_name ?? 'Not selected')}</div><div><strong>Airport codes:</strong><br>${esc(airportCodes(payload.airport))}</div><div><strong>City/state:</strong><br>${esc(payload.airport ? `${payload.airport.city}, ${payload.airport.state}` : 'Not selected')}</div><div><strong>Trip window:</strong><br>${esc(dateText(payload.tripStart))} → ${esc(dateText(payload.tripEnd))}</div><div><strong>Radius:</strong><br>${esc(payload.radiusMiles)} miles</div><div><strong>Traveler type:</strong><br>${esc(payload.travelerType)}</div><div><strong>Facility types included:</strong><br>${esc(payload.selectedFacilityTypes.length ? payload.selectedFacilityTypes.join(', ') : 'All facility types')}</div><div><strong>Last scanned:</strong><br>${esc(dateText(payload.lastScannedAt))}</div></div>`)}
${section('3. Airport Radius Scan', `<div class="aviation-report-grid"><div><strong>Walmart facilities inside radius:</strong><br>${payload.nearbyFacilities.length}</div><div><strong>Highest-risk facility:</strong><br>${esc(facilityLabel(highest))}</div><div><strong>Closest facility:</strong><br>${esc(facilityLabel(closest))}</div><div><strong>Recommended support/staging facility:</strong><br>${esc(facilityLabel(support))}</div><div><strong>Facilities requiring verification:</strong><br>${verificationCount}</div></div>`)}
${section('4. Map / Geographic Context', `<div class="aviation-report-grid"><div><strong>Selected airport:</strong><br>${esc(payload.airport?.airport_name ?? 'Not selected')}</div><div><strong>Radius:</strong><br>${esc(payload.radiusMiles)} miles</div><div><strong>Facility count:</strong><br>${payload.nearbyFacilities.length}</div></div><p class="muted"><strong>Notes:</strong> Map view is available in FPI Aviation Travel Readiness. Map snapshot export is not supported in this report version; include current map screenshot manually if needed.</p>`)}
${section('5. Nearby Walmart Facilities', `<table class="aviation-report-table"><thead><tr><th>Facility</th><th>Type</th><th>City/state</th><th>Distance</th><th>Facility risk</th><th>EP readiness</th><th>Weather exposure</th><th>Recommended action</th></tr></thead><tbody>${tableRows(payload.nearbyFacilities, (facility) => `<tr><td>${esc(facility.facility_name)} #${esc(facility.facility_number)}</td><td>${esc(facility.facility_type)}</td><td>${esc(facility.city)}, ${esc(facility.state)}</td><td>${facility.distance_miles.toFixed(1)} mi</td><td>${badge(`${facility.facility_risk_band} (${facility.facility_risk_score})`, facility.facility_risk_band)}</td><td>${esc(facility.ep_readiness_status)}</td><td>${esc(facility.weather_exposure)}</td><td>${esc(facility.recommended_action)}</td></tr>`, 8, 'No Walmart facilities found inside selected radius.')}</tbody></table>`)}
${section('6. FAA / Airport Watch', `<table class="aviation-report-table"><thead><tr><th>Current airport status</th><th>FAA / NOTAM items</th><th>Severity</th><th>Effective time window</th><th>Operational concern</th><th>Source / confidence</th></tr></thead><tbody>${tableRows(payload.faaAlerts, (alert) => `<tr><td>${esc(alert.status)}</td><td>${esc(alert.title)}</td><td>${badge(alert.severity, alert.severity)}</td><td>${esc(dateText(alert.effective_start))} → ${esc(dateText(alert.effective_end))}</td><td>${esc(alert.summary)}</td><td>${esc(alert.source)} / ${esc(alert.confidence)}%</td></tr>`, 6, 'No FAA or airport watch items found for the selected trip window.')}</tbody></table>`)}
${section('7. NOAA Weather Outlook', `<table class="aviation-report-table"><thead><tr><th>Active alerts</th><th>Timing versus trip window</th><th>Affected facilities</th><th>Wind / lightning / flooding / winter weather concerns</th><th>Source / confidence</th></tr></thead><tbody>${tableRows(payload.weatherAlerts, (alert) => `<tr><td>${badge(alert.severity, alert.severity)} ${esc(alert.alert_type)}</td><td>${esc(dateText(alert.effective_start))} → ${esc(dateText(alert.effective_end))}</td><td>${esc(alert.affected_facility_ids.length ? alert.affected_facility_ids.join(', ') : 'None listed')}</td><td>${esc(alert.summary)}</td><td>${esc(alert.source)} / ${esc(alert.confidence)}%</td></tr>`, 5, 'No NOAA weather alerts found for the selected trip window.')}</tbody></table>`)}
${section('8. Travel Risk Score', `<div class="aviation-report-grid"><div><strong>Overall score:</strong><br>${payload.scanHasRun ? esc(payload.risk.score) : 'Pending'}</div><div><strong>Risk band:</strong><br>${badge(band, band)}</div><div><strong>Weather:</strong><br>${domain(payload, 'Weather')}</div><div><strong>FAA / Airport:</strong><br>${domain(payload, 'FAA')}</div><div><strong>Nearby Facility Risk:</strong><br>${domain(payload, 'Facility')}</div><div><strong>EP / Visit Readiness:</strong><br>${domain(payload, 'EP')}</div><div><strong>Incident / Safety Pattern:</strong><br>${domain(payload, 'Incident')}</div><div><strong>Support / Vendor Readiness:</strong><br>${domain(payload, 'Support')}</div><div><strong>Data Confidence / Freshness:</strong><br>${domain(payload, 'Data')}</div></div><h3>Top risk drivers</h3><div class="driver-list">${(topDrivers.length ? topDrivers : ['No risk drivers available.']).map((driver) => `<span>${esc(driver)}</span>`).join('')}</div>`)}
${section('9. Recommended Actions Before Departure', `<table class="aviation-report-table"><thead><tr><th>#</th><th>Action</th><th>Owner role</th><th>Priority</th><th>Due time</th><th>Evidence required</th><th>Status</th></tr></thead><tbody>${tableRows(openActions, (action, index) => `<tr><td>${index + 1}</td><td>${esc(action.title)}<br><span class="muted">${esc(action.description)}</span></td><td>${esc(action.owner_role)}</td><td>${badge(action.priority, action.priority === 'Critical' ? 'Critical' : action.priority === 'High' ? 'High' : action.priority === 'Medium' ? 'Elevated' : 'Low')}</td><td>${esc(dateText(action.due_time))}</td><td>${action.evidence_required ? 'Yes' : 'No'}</td><td>${esc(action.status)}</td></tr>`, 7, 'No readiness actions created yet. Generate actions from risk drivers after scan.')}</tbody></table>`)}
${section('10. Recommended Actions Upon Arrival', `<ol><li>Validate facility contact and escalation path.</li><li>Confirm support/staging site availability and access expectations.</li><li>Monitor FAA/weather changes through approved aviation sources.</li><li>Confirm EP/security readiness and local facility support posture.</li><li>Escalate if risk changes or new alerts affect the trip window.</li></ol>`)}
${section('11. Missing Data / Caveats', `<ul>${missing.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`)}
${section('12. Advisory Disclaimer', `<p class="disclaimer">FPI provides advisory readiness analysis only. Aviation, executive protection, and security leadership retain final decision authority. This report does not make autonomous flight, dispatch, security deployment, or go/no-go decisions.</p>`)}
${section('13. Prepared By', `<div class="aviation-report-grid"><div><strong>Prepared by:</strong><br>${esc(payload.preparedBy)}</div><div><strong>Generated at:</strong><br>${esc(dateText(payload.generatedAt))}</div><div><strong>Data mode:</strong><br>${esc(payload.dataMode)}</div><div><strong>Report ID:</strong><br>${esc(payload.reportId)}</div></div>`)}
</main></body></html>`;
}

function section(title: string, body: string): string {
  return `<section class="aviation-report-section"><h2>${esc(title)}</h2>${body}</section>`;
}

function domain(payload: AviationTravelRiskReportPayload, key: string): string {
  const found = payload.risk.domain_breakdown.find((item) => item.domain.toLowerCase().includes(key.toLowerCase()));
  if (!found) return 'No signal available';
  return `${found.weighted_contribution} contribution · confidence ${found.confidence}%`;
}

export function renderAviationTravelRiskReportText(payload: AviationTravelRiskReportPayload): string {
  const band = payload.scanHasRun ? payload.risk.band : 'Pending';
  const topDrivers = (payload.risk.drivers.length ? payload.risk.drivers : payload.risk.risk_drivers.map((driver) => driver.label)).slice(0, 5);
  const actions = actionRows(payload.readinessActions).filter((action) => action.status !== 'Closed').slice(0, 6);
  return `FPI AVIATION TRAVEL RISK REPORT\n\n1. Executive Summary\n- Overall risk: ${band}\n- Risk score: ${payload.scanHasRun ? payload.risk.score : 'Pending'}\n- Confidence: ${payload.scanHasRun ? `${payload.risk.confidence}%` : 'Pending'}\n- Recommended posture: ${recommendedPosture(payload)}\n- Primary concern: ${primaryConcern(payload)}\n- Human review required: Yes\n\n2. Trip Overview\n- Trip name: ${payload.tripName || 'Not named'}\n- Airport: ${payload.airport?.airport_name ?? 'Not selected'}\n- Airport codes: ${airportCodes(payload.airport)}\n- City/state: ${payload.airport ? `${payload.airport.city}, ${payload.airport.state}` : 'Not selected'}\n- Trip window: ${dateText(payload.tripStart)} to ${dateText(payload.tripEnd)}\n- Radius: ${payload.radiusMiles} miles\n- Traveler type: ${payload.travelerType}\n- Facility types included: ${payload.selectedFacilityTypes.length ? payload.selectedFacilityTypes.join(', ') : 'All facility types'}\n- Last scanned: ${dateText(payload.lastScannedAt)}\n\nKey Counts\n- Walmart facilities inside radius: ${payload.nearbyFacilities.length}\n- FAA watch items: ${payload.faaAlerts.length}\n- NOAA weather alerts: ${payload.weatherAlerts.length}\n- Open readiness actions: ${payload.readinessActions.filter((action) => action.status !== 'Closed').length}\n\nTop Risk Drivers\n${(topDrivers.length ? topDrivers : ['No risk drivers available.']).map((driver, index) => `${index + 1}. ${driver}`).join('\n')}\n\nRecommended Actions Before Departure\n${(actions.length ? actions : []).map((action, index) => `${index + 1}. ${action.title} — ${action.owner_role} — ${action.priority} — ${action.status}`).join('\n') || 'No readiness actions created yet.'}\n\nMissing Data / Caveats\n${missingDataItems(payload).map((item) => `- ${item}`).join('\n')}\n\nAdvisory Disclaimer\nFPI provides advisory readiness analysis only. Aviation, executive protection, and security leadership retain final decision authority. This report does not make autonomous flight, dispatch, security deployment, or go/no-go decisions.\n\nPrepared By\n- Prepared by: ${payload.preparedBy}\n- Generated at: ${dateText(payload.generatedAt)}\n- Data mode: ${payload.dataMode}\n- Report ID: ${payload.reportId}\n`;
}

export function downloadAviationTravelRiskReportHtml(payload: AviationTravelRiskReportPayload): void {
  const html = renderAviationTravelRiskReportHtml(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const airport = airportCode(payload.airport).replace(/[^a-z0-9-]/gi, '_');
  link.href = url;
  link.download = `FPI-Aviation-Travel-Risk-Report-${airport}-${new Date(payload.generatedAt).toISOString().slice(0, 10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function prepareAviationTravelRiskEmail(payload: AviationTravelRiskReportPayload): void {
  const band = payload.scanHasRun ? payload.risk.band : 'Pending';
  const subject = `FPI Aviation Travel Risk Report - ${airportCode(payload.airport)} - ${band}`;
  const body = `${renderAviationTravelRiskReportText(payload)}\n\nUse Copy Report or Download HTML from FPI to attach or paste the full formatted report.`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 7500))}`;
}
