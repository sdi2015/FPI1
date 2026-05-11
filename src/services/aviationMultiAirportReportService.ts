import { routeDistanceMiles, type AviationAirportRisk } from './aviationTripService';
import type { AviationMultiAirportTrip, AviationSelectedFacility, AviationTripAirportStop, FAAAlert, FacilityWithDistance, WeatherAlert } from '../types/aviation';

export type AviationStopReportData = {
  stop: AviationTripAirportStop;
  facilities: FacilityWithDistance[];
  selectedFacilities: Array<{ facility: FacilityWithDistance; selection: AviationSelectedFacility }>;
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  risk: AviationAirportRisk;
};

export type AviationMultiAirportReportPayload = {
  reportId: string;
  generatedAt: string;
  preparedBy: string;
  dataMode: string;
  trip: AviationMultiAirportTrip;
  stops: AviationStopReportData[];
  overallRisk: AviationAirportRisk;
  missingCoordinateCount: number;
};

export function validateMultiAirportReport(payload: AviationMultiAirportReportPayload): string[] {
  const messages: string[] = [];
  if (!payload.trip.trip_name.trim()) messages.push('Create or select a trip.');
  if (!payload.trip.airports.some((stop) => stop.stop_type === 'Start')) messages.push('Select a starting airport.');
  if (!payload.trip.airports.some((stop) => stop.stop_type === 'End')) messages.push('Select an ending airport.');
  if (!payload.trip.airports.some((stop) => stop.scan_status === 'Scanned')) messages.push('Run at least one airport radius scan.');
  if (!payload.trip.selected_facilities.some((facility) => facility.selected)) messages.push('Select Walmart locations to include or confirm no locations are required.');
  return messages;
}

function esc(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char); }
function dateText(value?: string | null): string { if (!value) return 'Not set'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString(); }
function code(stop?: AviationTripAirportStop | null): string { return stop ? (stop.iata_code ?? stop.faa_id ?? stop.icao_code ?? stop.airport_id) : 'Pending'; }
function tone(band?: string): string { return (band ?? 'Pending').toLowerCase().replace(/\s+/g, '-'); }
function badge(value?: string | number): string { const text = String(value ?? 'Pending'); return `<span class="risk-badge risk-${tone(text)}">${esc(text)}</span>`; }
function section(title: string, body: string): string { return `<section class="report-section"><h2>${esc(title)}</h2>${body}</section>`; }

function routeList(stops: AviationTripAirportStop[]): string {
  return `<ol class="route-list">${stops.map((stop) => `<li><strong>${esc(stop.stop_type)}:</strong> ${esc(stop.airport_name)} (${esc(code(stop))}) · ${esc(stop.city)}, ${esc(stop.state)} · Radius ${esc(stop.radius_miles)} mi · ${badge(stop.airport_risk_band)} · Facilities ${stop.nearby_facility_ids.length} / selected ${stop.selected_facility_ids.length}</li>`).join('')}</ol>`;
}

export function renderMultiAirportTravelRiskReportHtml(payload: AviationMultiAirportReportPayload): string {
  const { trip, stops, overallRisk } = payload;
  const start = trip.airports.find((stop) => stop.stop_type === 'Start');
  const end = trip.airports.find((stop) => stop.stop_type === 'End');
  const selected = stops.flatMap((stop) => stop.selectedFacilities.map((item) => ({ ...item, stop: stop.stop })));
  const highRiskUnselected = stops.flatMap((stop) => stop.facilities.filter((facility) => ['High', 'Critical'].includes(facility.facility_risk_band) && !stop.stop.selected_facility_ids.includes(facility.facility_id)).map((facility) => ({ stop: stop.stop, facility })));
  const allFaa = stops.flatMap((stop) => stop.faaAlerts.map((alert) => ({ stop: stop.stop, alert })));
  const allWeather = stops.flatMap((stop) => stop.weatherAlerts.map((alert) => ({ stop: stop.stop, alert })));
  const topActions = selected.filter((item) => ['High', 'Critical'].includes(item.facility.facility_risk_band) || item.facility.ep_readiness_status === 'Gap').slice(0, 10);
  const caveats = [
    ...trip.airports.filter((stop) => stop.scan_status !== 'Scanned').map((stop) => `${code(stop)} has not been scanned.`),
    payload.missingCoordinateCount ? `${payload.missingCoordinateCount} Walmart facility records are missing coordinates.` : null,
    stops.some((stop) => stop.faaAlerts.length === 0) ? 'One or more airports have no FAA watch data returned.' : null,
    stops.some((stop) => stop.weatherAlerts.length === 0) ? 'One or more airports have no NOAA weather alerts returned.' : null,
    selected.some((item) => ['Unknown', 'Restricted'].includes(item.facility.ep_readiness_status)) ? 'Some selected Walmart locations have missing or restricted EP readiness.' : null,
    payload.dataMode !== 'live' ? `${payload.dataMode} data mode. Validate with approved operational sources before use.` : null,
  ].filter(Boolean) as string[];

  return `<!doctype html><html><head><meta charset="utf-8"><title>FPI Aviation Travel Risk Report</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#f6f8fb;color:#172033;line-height:1.45}.report{max-width:1180px;margin:0 auto;padding:28px}.header{background:#111827;color:#fff;border-radius:18px;padding:24px;margin-bottom:16px}.header h1{margin:4px 0 8px}.risk-banner{border-radius:16px;padding:18px;margin:16px 0;border-left:8px solid #64748b;background:#f1f5f9}.risk-low{border-color:#86efac!important;background:#dcfce7!important;color:#166534!important}.risk-watch{border-color:#fde68a!important;background:#fef3c7!important;color:#854d0e!important}.risk-elevated{border-color:#fed7aa!important;background:#ffedd5!important;color:#9a3412!important}.risk-high{border-color:#fecaca!important;background:#fee2e2!important;color:#991b1b!important}.risk-critical{border-color:#fecdd3!important;background:#ffe4e6!important;color:#7f1d1d!important}.risk-pending,.risk-unknown{border-color:#cbd5e1!important;background:#f1f5f9!important;color:#334155!important}.risk-badge{display:inline-block;border:1px solid #cbd5e1;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700}.report-section{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:14px 0;box-shadow:0 8px 20px rgba(15,23,42,.04)}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.grid div{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:10px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left;vertical-align:top}th{background:#f8fafc}.muted{color:#64748b}.disclaimer{border-left:5px solid #334155;background:#f8fafc;padding:12px;border-radius:10px}@media print{body{background:#fff}.report{padding:0}.report-section,.header{box-shadow:none;break-inside:avoid}}</style></head><body><main class="report"><header class="header"><p>FPI Aviation Travel Readiness</p><h1>FPI AVIATION TRAVEL RISK REPORT</h1><p>${esc(trip.trip_name || 'Draft trip')} · ${esc(code(start))} to ${esc(code(end))} · Generated ${esc(dateText(payload.generatedAt))}</p></header><section class="risk-banner risk-${tone(overallRisk.band)}"><strong>Overall trip risk: ${badge(overallRisk.band)}</strong><br>Risk score: ${esc(overallRisk.score)} · Confidence: ${esc(overallRisk.confidence)}% · Human review required</section>
${section('1. Executive Summary', `<div class="grid"><div><strong>Overall trip risk</strong><br>${badge(overallRisk.band)}</div><div><strong>Risk score</strong><br>${overallRisk.score}</div><div><strong>Confidence</strong><br>${overallRisk.confidence}%</div><div><strong>Recommended posture</strong><br>${overallRisk.band === 'Critical' || overallRisk.band === 'High' ? 'Delay / review with mitigation owner' : overallRisk.band === 'Elevated' ? 'Go with mitigation' : 'Proceed with monitoring'}</div><div><strong>Primary concern</strong><br>${esc(overallRisk.drivers[0] ?? 'No primary concern identified.')}</div><div><strong>Human review required</strong><br>Yes</div></div>`)}
${section('2. Trip Overview', `<div class="grid"><div><strong>Trip name</strong><br>${esc(trip.trip_name)}</div><div><strong>Traveler type</strong><br>${esc(trip.traveler_type)}</div><div><strong>Trip window</strong><br>${esc(dateText(trip.trip_start))} → ${esc(dateText(trip.trip_end))}</div><div><strong>Starting airport</strong><br>${esc(start?.airport_name ?? 'Not selected')}</div><div><strong>Ending airport</strong><br>${esc(end?.airport_name ?? 'Not selected')}</div><div><strong>Intermediate airports</strong><br>${esc(trip.airports.filter((stop) => stop.stop_type === 'Intermediate').map(code).join(', ') || 'None')}</div><div><strong>Default radius</strong><br>${trip.default_radius_miles} mi</div><div><strong>Facility types included</strong><br>${esc(trip.facility_types.length ? trip.facility_types.join(', ') : 'All facility types')}</div><div><strong>Last scanned</strong><br>${esc(dateText(trip.last_scanned))}</div></div>`)}
${section('3. Airport Route', `${routeList(trip.airports)}<p class="muted">Estimated direct airport-to-airport route distance: ${routeDistanceMiles(trip.airports).toFixed(1)} miles.</p>`)}
${section('4. Map / Geographic Context', `<p>Route map in FPI shows ${trip.airports.length} airport marker(s), radius rings, and selected Walmart locations. Radius by airport: ${esc(trip.airports.map((stop) => `${code(stop)} ${stop.radius_miles}mi`).join(' · '))}.</p><p class="muted">Map image export is not supported in this report version; include a current map screenshot manually if needed.</p>`)}
${section('5. Airport-by-Airport Risk Analysis', stops.map((stop) => `<h3>${esc(stop.stop.stop_type)} · ${esc(stop.stop.airport_name)} (${esc(code(stop.stop))}) ${badge(stop.risk.band)}</h3><div class="grid"><div><strong>Radius</strong><br>${stop.stop.radius_miles} mi</div><div><strong>Facilities found</strong><br>${stop.facilities.length}</div><div><strong>Facilities selected</strong><br>${stop.selectedFacilities.length}</div><div><strong>FAA watch items</strong><br>${stop.faaAlerts.length}</div><div><strong>NOAA weather alerts</strong><br>${stop.weatherAlerts.length}</div><div><strong>Risk score</strong><br>${stop.risk.score}</div></div><ul>${stop.risk.drivers.map((driver) => `<li>${esc(driver)}</li>`).join('')}</ul>`).join(''))}
${section('6. Selected Walmart Locations', `<table><thead><tr><th>Airport stop</th><th>Facility</th><th>Type</th><th>City/state</th><th>Distance</th><th>Risk</th><th>EP readiness</th><th>Weather</th><th>Role / notes</th><th>Recommended action</th></tr></thead><tbody>${selected.length ? selected.map((item) => `<tr><td>${esc(code(item.stop))}</td><td>${esc(item.facility.facility_name)} #${esc(item.facility.facility_number)}</td><td>${esc(item.facility.facility_type)}</td><td>${esc(item.facility.city)}, ${esc(item.facility.state)}</td><td>${item.facility.distance_miles.toFixed(1)} mi</td><td>${badge(item.facility.facility_risk_band)}</td><td>${esc(item.facility.ep_readiness_status)}</td><td>${esc(item.facility.weather_exposure)}</td><td>${esc(item.selection.recommended_role ?? 'Monitor')}<br>${esc(item.selection.selection_reason ?? '')}</td><td>${esc(item.facility.recommended_action)}</td></tr>`).join('') : '<tr><td colspan="10" class="muted">No Walmart locations selected.</td></tr>'}</tbody></table>`)}
${section('7. High-Risk Unselected Locations', `<table><thead><tr><th>Facility</th><th>Airport stop</th><th>Distance</th><th>Risk</th><th>Reason for caveat</th></tr></thead><tbody>${highRiskUnselected.length ? highRiskUnselected.map((item) => `<tr><td>${esc(item.facility.facility_name)} #${esc(item.facility.facility_number)}</td><td>${esc(code(item.stop))}</td><td>${item.facility.distance_miles.toFixed(1)} mi</td><td>${badge(item.facility.facility_risk_band)}</td><td>High-risk Walmart facility inside radius was not selected for the trip plan.</td></tr>`).join('') : '<tr><td colspan="5" class="muted">No high-risk unselected locations identified.</td></tr>'}</tbody></table>`)}
${section('8. FAA / Airport Watch', `<table><thead><tr><th>Airport</th><th>Type</th><th>Severity</th><th>Title</th><th>Summary</th><th>Effective</th><th>Source</th><th>Status</th></tr></thead><tbody>${allFaa.length ? allFaa.map((item) => `<tr><td>${esc(code(item.stop))}</td><td>${esc(item.alert.alert_type)}</td><td>${badge(item.alert.severity)}</td><td>${esc(item.alert.title)}</td><td>${esc(item.alert.summary)}</td><td>${esc(dateText(item.alert.effective_start))} → ${esc(dateText(item.alert.effective_end))}</td><td>${esc(item.alert.source)} / ${esc(item.alert.confidence)}%</td><td>${esc(item.alert.status)}</td></tr>`).join('') : '<tr><td colspan="8" class="muted">No FAA watch items returned.</td></tr>'}</tbody></table>`)}
${section('9. NOAA Weather Outlook', `<table><thead><tr><th>Airport</th><th>Type</th><th>Severity</th><th>Timing</th><th>Affected facilities</th><th>Source</th><th>Status</th></tr></thead><tbody>${allWeather.length ? allWeather.map((item) => `<tr><td>${esc(code(item.stop))}</td><td>${esc(item.alert.alert_type)}</td><td>${badge(item.alert.severity)}</td><td>${esc(dateText(item.alert.effective_start))} → ${esc(dateText(item.alert.effective_end))}</td><td>${esc(item.alert.affected_facility_ids.join(', ') || 'None listed')}</td><td>${esc(item.alert.source)} / ${esc(item.alert.confidence)}%</td><td>${esc(item.alert.status)}</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No NOAA weather alerts returned.</td></tr>'}</tbody></table>`)}
${section('10. Travel Risk Score', `<div class="grid"><div><strong>Overall score</strong><br>${overallRisk.score}</div><div><strong>Overall band</strong><br>${badge(overallRisk.band)}</div><div><strong>Route stops</strong><br>${trip.airports.length}</div></div><table><thead><tr><th>Airport</th><th>Score</th><th>Band</th><th>Confidence</th><th>Top drivers</th></tr></thead><tbody>${stops.map((stop) => `<tr><td>${esc(code(stop.stop))}</td><td>${stop.risk.score}</td><td>${badge(stop.risk.band)}</td><td>${stop.risk.confidence}%</td><td>${esc(stop.risk.drivers.slice(0, 3).join('; '))}</td></tr>`).join('')}</tbody></table><h3>Top overall drivers</h3><ol>${overallRisk.drivers.slice(0, 5).map((driver) => `<li>${esc(driver)}</li>`).join('')}</ol>`)}
${section('11. Readiness Actions', `<table><thead><tr><th>Group</th><th>Action</th><th>Owner role</th><th>Priority</th><th>Due time</th><th>Evidence required</th><th>Status</th></tr></thead><tbody>${topActions.length ? topActions.map((item) => `<tr><td>${esc(code(item.stop))} / ${esc(item.facility.facility_number)}</td><td>Verify ${esc(item.facility.facility_name)} readiness<br><span class="muted">${esc(item.facility.recommended_action)}</span></td><td>FPI / EP coordination</td><td>${badge(item.facility.facility_risk_band === 'Critical' ? 'Critical' : 'High')}</td><td>Before departure</td><td>Yes</td><td>Open</td></tr>`).join('') : '<tr><td colspan="7" class="muted">No high-priority selected location actions generated.</td></tr>'}</tbody></table>`)}
${section('12. Missing Data / Caveats', `<ul>${caveats.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`)}
${section('13. Advisory Disclaimer', `<p class="disclaimer">FPI provides advisory readiness analysis only. Aviation, executive protection, and security leadership retain final decision authority. This report does not make autonomous flight, dispatch, security deployment, or go/no-go decisions.</p>`)}
${section('14. Prepared By', `<div class="grid"><div><strong>Prepared by</strong><br>${esc(payload.preparedBy)}</div><div><strong>Generated at</strong><br>${esc(dateText(payload.generatedAt))}</div><div><strong>Report ID</strong><br>${esc(payload.reportId)}</div><div><strong>Data mode</strong><br>${esc(payload.dataMode)}</div></div>`)}
</main></body></html>`;
}

export function renderMultiAirportTravelRiskReportText(payload: AviationMultiAirportReportPayload): string {
  const start = payload.trip.airports.find((stop) => stop.stop_type === 'Start');
  const end = payload.trip.airports.find((stop) => stop.stop_type === 'End');
  const selectedCount = payload.trip.selected_facilities.filter((facility) => facility.selected).length;
  return `FPI AVIATION TRAVEL RISK REPORT\n\nExecutive Summary\nOverall risk: ${payload.overallRisk.band}\nRisk score: ${payload.overallRisk.score}\nConfidence: ${payload.overallRisk.confidence}%\nPrimary concern: ${payload.overallRisk.drivers[0] ?? 'None identified'}\nHuman review required: Yes\n\nTrip Overview\nTrip name: ${payload.trip.trip_name}\nTraveler type: ${payload.trip.traveler_type}\nTrip window: ${dateText(payload.trip.trip_start)} to ${dateText(payload.trip.trip_end)}\nRoute: ${code(start)} to ${code(end)}\nIntermediate airports: ${payload.trip.airports.filter((stop) => stop.stop_type === 'Intermediate').map(code).join(', ') || 'None'}\nDefault radius: ${payload.trip.default_radius_miles} miles\nSelected Walmart locations: ${selectedCount}\n\nAirport Route\n${payload.trip.airports.map((stop) => `${stop.sequence}. ${stop.stop_type}: ${stop.airport_name} (${code(stop)}) - ${stop.airport_risk_band ?? 'Pending'} - facilities ${stop.nearby_facility_ids.length}, selected ${stop.selected_facility_ids.length}`).join('\n')}\n\nTop Risk Drivers\n${payload.overallRisk.drivers.slice(0, 5).map((driver, index) => `${index + 1}. ${driver}`).join('\n')}\n\nTop Actions\n- Verify high-risk selected Walmart locations and EP readiness gaps before departure.\n- Monitor FAA and NOAA changes for each airport stop.\n- Confirm support/staging locations selected in the trip plan.\n\nFull formatted report can be copied or downloaded from FPI.\n\nDisclaimer\nFPI provides advisory readiness analysis only. Aviation, executive protection, and security leadership retain final decision authority. This report does not make autonomous flight, dispatch, security deployment, or go/no-go decisions.\n`;
}

export function downloadMultiAirportReportHtml(payload: AviationMultiAirportReportPayload): void {
  const html = renderMultiAirportTravelRiskReportHtml(payload);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const start = payload.trip.airports.find((stop) => stop.stop_type === 'Start');
  const end = payload.trip.airports.find((stop) => stop.stop_type === 'End');
  const link = document.createElement('a');
  link.href = url;
  link.download = `FPI-Aviation-Travel-Risk-Report-${code(start)}-to-${code(end)}-${new Date(payload.generatedAt).toISOString().slice(0, 10)}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function prepareMultiAirportRiskEmail(payload: AviationMultiAirportReportPayload): void {
  const start = payload.trip.airports.find((stop) => stop.stop_type === 'Start');
  const end = payload.trip.airports.find((stop) => stop.stop_type === 'End');
  const subject = `FPI Aviation Travel Risk Report - ${code(start)} to ${code(end)} - ${payload.overallRisk.band}`;
  const body = `${renderMultiAirportTravelRiskReportText(payload)}\n\nFull formatted report can be copied or downloaded from FPI.`;
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 7500))}`;
}
