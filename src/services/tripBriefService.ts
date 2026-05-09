import { getAviationPilotConfig } from './aviationPilotConfig';
import { getAviationProviderConfig } from './aviationProviderConfig';
import type { Airport, FAAAlert, FacilityWithDistance, TripRiskResult, WeatherAlert } from '../types/aviation';

function formatAirport(airport: Airport | null): string {
  if (!airport) return 'Not selected';
  const codes = [airport.faa_id, airport.iata_code, airport.icao_code].filter(Boolean).join('/');
  return `${airport.airport_name}${codes ? ` (${codes})` : ''} — ${airport.city ?? 'Unknown city'}, ${airport.state ?? 'Unknown state'}`;
}

function sourceNotice(): string {
  return getAviationProviderConfig().map((provider) => `- ${provider.display_name}: ${provider.mode}, ${provider.status}, confidence ${provider.confidence}%. ${provider.notes} Next step: ${provider.next_step}`).join('\n');
}

export function generateTripBrief({ airport, radiusMiles, tripStart, tripEnd, facilityTypes, nearbyFacilities, risk, faaAlerts, weatherAlerts }: { airport: Airport | null; radiusMiles: number; tripStart: string; tripEnd: string; facilityTypes: string[]; nearbyFacilities: FacilityWithDistance[]; risk: TripRiskResult; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[] }): string {
  const highestRisk = nearbyFacilities[0];
  const closest = [...nearbyFacilities].sort((a, b) => a.distance_miles - b.distance_miles)[0];
  const support = nearbyFacilities.find((facility) => facility.aviation_support_candidate && facility.ep_readiness_status !== 'Gap') ?? nearbyFacilities.find((facility) => facility.aviation_support_candidate);
  const verification = nearbyFacilities.filter((facility) => facility.ep_readiness_status === 'Gap' || facility.facility_risk_band === 'High' || facility.facility_risk_band === 'Critical');
  const generatedAt = new Date().toISOString();
  const pilotConfig = getAviationPilotConfig();

  return `FPI AVIATION TRAVEL READINESS BRIEF
Generated: ${generatedAt}

ADVISORY-ONLY NOTICE
${pilotConfig.advisory_disclaimer}
FPI may recommend GO, GO WITH MITIGATION, DELAY / REVIEW, NO-GO RECOMMENDED, or INSUFFICIENT DATA. ${pilotConfig.human_decision_authority}

SOURCE AND CONFIDENCE NOTICE
${sourceNotice()}

Trip Summary
- Airport: ${formatAirport(airport)}
- Trip Window: ${tripStart || 'Not provided'} to ${tripEnd || 'Not provided'}
- Radius: ${radiusMiles} miles
- Facilities Scanned: ${nearbyFacilities.length}
- Facility Types Included: ${facilityTypes.length ? facilityTypes.join(', ') : 'All demo facility types'}

Overall Risk
- Trip Risk Score: ${risk.score}
- Risk Band: ${risk.band}
- Confidence: ${risk.confidence}%
- FPI Recommendation: ${risk.recommendation_label}
- Recommendation Rationale: ${risk.recommendation_rationale}
- Primary Risk Drivers: ${risk.drivers.join('; ')}

Airport / FAA Watch
- Current Airport Status: ${airport?.status ?? 'Unknown'}
- Relevant FAA/NOTAM Items: ${faaAlerts.length ? faaAlerts.map((alert) => `${alert.severity}: ${alert.title}`).join('; ') : 'No seeded FAA records found'}
- Airspace/Operational Concerns: Validate with approved FAA/aviation source before operational use
- Data Freshness: ${airport?.source_freshness ?? 'missing'}; FAA seeded/stubbed unless provider status indicates live

NOAA Weather Outlook
- Active Alerts: ${weatherAlerts.length ? weatherAlerts.map((alert) => `${alert.severity}: ${alert.alert_type}`).join('; ') : 'No seeded NOAA records found'}
- Forecasted Concerns: ${weatherAlerts[0]?.summary ?? 'Live NOAA forecast integration not connected'}
- Wind/Lightning/Flooding/Winter Weather: Validate through approved NOAA source
- Timing vs Trip Window: Trip window comparison is advisory and requires source validation

Nearby Walmart Facilities
- Highest-Risk Facility: ${highestRisk ? `${highestRisk.facility_name} (${highestRisk.facility_risk_band}, ${highestRisk.distance_miles.toFixed(1)} mi)` : 'None inside radius'}
- Closest Facility: ${closest ? `${closest.facility_name} (${closest.distance_miles.toFixed(1)} mi)` : 'None inside radius'}
- Recommended Support/Staging Facility: ${support ? `${support.facility_name} (${support.distance_miles.toFixed(1)} mi)` : 'No candidate identified'}
- Facilities Requiring Verification: ${verification.length ? verification.map((facility) => facility.facility_name).join(', ') : 'None flagged in current scan'}

Executive Protection / Security Readiness
- EP Readiness Status: ${verification.length ? 'Verification required' : 'No EP readiness gaps detected in current scan'}
- Known Gaps: ${nearbyFacilities.filter((facility) => facility.ep_readiness_status === 'Gap').map((facility) => `${facility.facility_name}: ${facility.top_risk_driver}`).join('; ') || 'None surfaced from demo data'}
- Required Verifications: Facility risk, EP posture, FAA status, NOAA weather, support/staging coverage

Recommended Actions Before Departure
1. ${risk.required_mitigations[0] ?? 'Validate airport, weather, and facility posture with approved sources.'}
2. ${risk.required_mitigations[1] ?? 'Confirm local support contacts and evidence requirements.'}
3. Review FPI recommendation with authorized Aviation/EP/Security leadership.

Recommended Actions Upon Arrival
1. Confirm local facility contact and support/staging plan if used.
2. Monitor weather and FAA status changes through approved sources.
3. Record evidence and close readiness actions in FPI where persistence is available.

Open Questions / Missing Data
- Walmart facility master data and live FPI posture feeds are not connected by default.
- FAA/NOAA integrations are seeded/stubbed unless explicitly configured as live_api.
- Drive time is estimated from straight-line distance until an approved routing provider is connected.

Prepared by FPI Aviation Travel Readiness
Demo/seeded/local data notice: data may be static, local, estimated, unavailable, stale, or low-confidence as labeled above.`;
}
