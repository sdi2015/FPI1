import type { FAAAlert, FacilityWithDistance, RiskBand, RiskDomainBreakdown, RiskDriver, TripRecommendation, TripRiskResult, WeatherAlert } from '../types/aviation';

const severityScores: Record<RiskBand, number> = { Low: 15, Watch: 35, Elevated: 60, High: 78, Critical: 95 };

export function getRiskBand(score: number): RiskBand {
  if (score <= 29) return 'Low';
  if (score <= 49) return 'Watch';
  if (score <= 69) return 'Elevated';
  if (score <= 84) return 'High';
  return 'Critical';
}

function maxSeverityRisk(alerts: Array<{ severity: RiskBand }>): number {
  return alerts.reduce((max, alert) => Math.max(max, severityScores[alert.severity] ?? 0), 0);
}

function getRecommendation(score: number, confidence: number, weatherAlerts: WeatherAlert[], faaAlerts: FAAAlert[]): TripRecommendation {
  if (confidence < 55) return 'INSUFFICIENT_DATA';
  if (weatherAlerts.some((alert) => alert.severity === 'Critical') || faaAlerts.some((alert) => alert.severity === 'Critical')) return 'NO_GO_RECOMMENDED';
  if (score >= 85) return 'NO_GO_RECOMMENDED';
  if (score >= 70) return 'DELAY_REVIEW';
  if (score >= 50) return 'GO_WITH_MITIGATION';
  return 'GO';
}

function recommendationLabel(recommendation: TripRecommendation): TripRiskResult['recommendation_label'] {
  const labels: Record<TripRecommendation, TripRiskResult['recommendation_label']> = {
    GO: 'GO',
    GO_WITH_MITIGATION: 'GO WITH MITIGATION',
    DELAY_REVIEW: 'DELAY / REVIEW',
    NO_GO_RECOMMENDED: 'NO-GO RECOMMENDED',
    INSUFFICIENT_DATA: 'INSUFFICIENT DATA',
  };
  return labels[recommendation];
}

function domain(domain: RiskDomainBreakdown['domain'], weight: number, raw_score: number, evidence: string[], source_status: RiskDomainBreakdown['source_status'], confidence: number): RiskDomainBreakdown {
  return { domain, weight, raw_score, weighted_contribution: Math.round(raw_score * weight), evidence, source_status, confidence };
}

export function calculateTripRiskScore({
  nearbyFacilities,
  faaAlerts,
  weatherAlerts,
  hasSelectedAirport,
}: {
  nearbyFacilities: FacilityWithDistance[];
  faaAlerts: FAAAlert[];
  weatherAlerts: WeatherAlert[];
  hasSelectedAirport: boolean;
}): TripRiskResult {
  const weather = maxSeverityRisk(weatherAlerts);
  const faa = maxSeverityRisk(faaAlerts);
  const facility = nearbyFacilities.length ? Math.max(...nearbyFacilities.map((f) => f.facility_risk_score)) : 20;
  const highRiskFacilities = nearbyFacilities.filter((f) => f.facility_risk_band === 'High' || f.facility_risk_band === 'Critical');
  const epGapCount = nearbyFacilities.filter((facility) => facility.ep_readiness_status === 'Gap').length;
  const epWatchCount = nearbyFacilities.filter((facility) => facility.ep_readiness_status === 'Watch' || facility.ep_readiness_status === 'Unknown' || facility.ep_readiness_status === 'Restricted').length;
  const ep = Math.min(100, epGapCount * 35 + epWatchCount * 15);
  const incident = nearbyFacilities.some((facility) => facility.top_risk_driver.toLowerCase().includes('incident')) ? 60 : 20;
  const support = nearbyFacilities.some((facility) => facility.aviation_support_candidate) ? 15 : 70;
  const dataFreshness = hasSelectedAirport ? (nearbyFacilities.length ? 30 : 55) : 85;

  const domain_breakdown: RiskDomainBreakdown[] = [
    domain('Weather', 0.25, weather, weatherAlerts.length ? weatherAlerts.map((a) => `${a.severity}: ${a.alert_type}`) : ['No weather alert for selected airport; seeded NOAA fallback only.'], weatherAlerts.length ? 'seeded_demo' : 'missing', weatherAlerts.length ? Math.round(weatherAlerts.reduce((sum, a) => sum + a.confidence, 0) / weatherAlerts.length) : 45),
    domain('FAA/Airport', 0.2, faa, faaAlerts.length ? faaAlerts.map((a) => `${a.severity}: ${a.title}`) : ['No FAA watch item for selected airport; live NOTAM integration pending.'], faaAlerts.length ? 'seeded_demo' : 'missing', faaAlerts.length ? Math.round(faaAlerts.reduce((sum, a) => sum + a.confidence, 0) / faaAlerts.length) : 45),
    domain('Nearby Facility', 0.2, facility, nearbyFacilities.length ? [`${nearbyFacilities.length} facilities scanned; max facility risk ${facility}.`] : ['No Walmart facilities in radius or scan not run.'], nearbyFacilities.length ? 'seeded_demo' : 'missing', nearbyFacilities.length ? 82 : 35),
    domain('EP/Visit Readiness', 0.15, ep, epGapCount ? [`${epGapCount} EP readiness gap(s), ${epWatchCount} watch/unknown item(s).`] : [`${epWatchCount} EP watch/unknown item(s); no gap surfaced.`], nearbyFacilities.length ? 'seeded_demo' : 'missing', nearbyFacilities.length ? 76 : 35),
    domain('Incident/Safety Pattern', 0.1, incident, incident >= 60 ? ['Nearby facility driver references recent incident pattern.'] : ['No incident-specific driver surfaced in current facility scan.'], nearbyFacilities.length ? 'seeded_demo' : 'unknown', 68),
    domain('Support/Vendor Readiness', 0.05, support, support > 50 ? ['No support/staging candidate identified in radius.'] : ['At least one support/staging candidate identified.'], nearbyFacilities.length ? 'seeded_demo' : 'missing', nearbyFacilities.length ? 70 : 35),
    domain('Data Confidence/Freshness', 0.05, dataFreshness, ['Airport source is uploaded GeoJSON; facility, FAA, and NOAA data are seeded/demo pending live integrations.'], hasSelectedAirport ? 'seeded_demo' : 'missing', hasSelectedAirport ? 72 : 25),
  ];

  const score = Math.round(domain_breakdown.reduce((sum, item) => sum + item.weighted_contribution, 0));
  const missingInputs = [!hasSelectedAirport, nearbyFacilities.length === 0, faaAlerts.length === 0, weatherAlerts.length === 0].filter(Boolean).length;
  const confidence = Math.max(45, Math.min(95, 86 - missingInputs * 9 + Math.min(nearbyFacilities.length, 5)));
  const band = getRiskBand(score);
  const recommendation = getRecommendation(score, confidence, weatherAlerts, faaAlerts);

  const risk_drivers: RiskDriver[] = [
    ...(weatherAlerts.length ? [{ id: 'weather', label: `${weatherAlerts[0].severity} weather signal: ${weatherAlerts[0].alert_type}`, domain: 'Weather' as const, severity: weatherAlerts[0].severity, evidence: weatherAlerts[0].summary }] : [{ id: 'weather-missing', label: 'NOAA live integration missing; seeded or absent weather data reduces confidence', domain: 'Weather' as const, severity: 'Watch' as RiskBand }]),
    ...(faaAlerts.length ? [{ id: 'faa', label: `${faaAlerts[0].severity} FAA/airport watch: ${faaAlerts[0].title}`, domain: 'FAA/Airport' as const, severity: faaAlerts[0].severity, evidence: faaAlerts[0].summary }] : [{ id: 'faa-missing', label: 'FAA live integration missing; seeded or absent airport-status data reduces confidence', domain: 'FAA/Airport' as const, severity: 'Watch' as RiskBand }]),
    nearbyFacilities.length ? { id: 'facility', label: `Highest nearby facility risk score is ${facility}`, domain: 'Nearby Facility' as const, severity: getRiskBand(facility), evidence: highRiskFacilities[0]?.top_risk_driver } : { id: 'facility-missing', label: 'No Walmart facilities found inside selected radius', domain: 'Nearby Facility' as const, severity: 'Watch' as RiskBand },
    epGapCount ? { id: 'ep', label: `${epGapCount} nearby facility EP readiness gap(s)`, domain: 'EP/Visit Readiness' as const, severity: 'Elevated' as RiskBand } : { id: 'ep-stable', label: 'No EP readiness gaps detected in scanned facilities', domain: 'EP/Visit Readiness' as const, severity: 'Low' as RiskBand },
    { id: 'demo-data', label: 'Facility data is synthetic/demo and requires production Walmart facility master validation', domain: 'Data Confidence/Freshness' as const, severity: 'Watch' as RiskBand },
  ].slice(0, 5);

  const drivers = risk_drivers.map((driver) => driver.label);
  const required_mitigations = [
    ...(weatherAlerts.length ? ['Validate weather timing against approved NOAA source before departure.'] : ['Connect NOAA weather source or manually verify weather conditions.']),
    ...(faaAlerts.length ? ['Validate FAA/NOTAM status through approved aviation source.'] : ['Connect FAA/NOTAM source or manually verify airport status.']),
    ...(epGapCount ? ['Close EP readiness gaps for highest-risk nearby facilities.'] : []),
    ...(highRiskFacilities.length ? ['Review high-risk nearby facility posture with FPI/EP owner.'] : []),
    ...(!nearbyFacilities.some((facility) => facility.aviation_support_candidate) ? ['Identify an alternate support/staging facility.'] : []),
  ];

  const label = recommendationLabel(recommendation);
  const caveats = [
    'FPI Aviation Travel Readiness is advisory only; final decisions remain with authorized Aviation, EP, Security, and operational leaders.',
    'Phase 1.5 uses uploaded airport GeoJSON and seeded/demo facility, FAA, and NOAA records unless explicitly labeled live/verified.',
  ];

  return {
    score,
    band,
    confidence,
    recommendation,
    recommendation_label: label,
    recommendation_rationale: `${label} based on ${band.toLowerCase()} risk score ${score}, ${confidence}% confidence, and current seeded/demo signal coverage. Final authority remains with authorized Aviation, EP, and Security leadership.`,
    drivers,
    risk_drivers,
    domain_breakdown,
    caveats,
    required_mitigations,
  };
}
