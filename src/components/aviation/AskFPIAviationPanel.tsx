import { useState } from 'react';
import type { Airport, FAAAlert, FacilityWithDistance, TripRiskResult, WeatherAlert } from '../../types/aviation';

const prompts = [
  'Scan Walmarts near this airport',
  'Generate aviation trip brief',
  'Explain the trip risk score',
  'What should we verify before departure?',
  'Which nearby facility is highest risk?',
  'Which facility is best for support/staging?',
  'What weather could affect this trip?',
  'Are there FAA watch items?',
  'Create readiness actions',
];

export function AskFPIAviationPanel({ airport, facilities, risk, faaAlerts, weatherAlerts }: { airport: Airport | null; facilities: FacilityWithDistance[]; risk: TripRiskResult; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[] }) {
  const [response, setResponse] = useState('Select a prompt chip to generate a deterministic Phase 1 summary from current page data.');
  const [lastPrompt, setLastPrompt] = useState('Aviation Travel Readiness mode');

  function answer(prompt: string) {
    setLastPrompt(prompt);
    const highest = facilities[0];
    const support = facilities.find((facility) => facility.aviation_support_candidate && facility.ep_readiness_status !== 'Gap') ?? facilities.find((facility) => facility.aviation_support_candidate);
    if (prompt.includes('Scan')) setResponse(`${facilities.length} Walmart demo facilities are inside the selected radius for ${airport?.airport_name ?? 'the selected airport'}. Results are sorted by risk, distance, then EP readiness gaps.`);
    else if (prompt.includes('Explain')) setResponse(`${risk.recommendation_label}: score ${risk.score} (${risk.band}) with ${risk.confidence}% confidence. Top drivers: ${risk.drivers.join('; ')}.`);
    else if (prompt.includes('verify')) setResponse(`Before departure: ${risk.required_mitigations.join(' ')} Confirm local support ownership and evidence capture. Final decision remains with authorized leaders.`);
    else if (prompt.includes('highest risk')) setResponse(highest ? `${highest.facility_name} is currently highest risk at ${highest.facility_risk_score} (${highest.facility_risk_band}), ${highest.distance_miles.toFixed(1)} miles away. Driver: ${highest.top_risk_driver}.` : 'No nearby facility has been scanned yet.');
    else if (prompt.includes('support/staging')) setResponse(support ? `${support.facility_name} is the best current support/staging candidate based on demo data, at ${support.distance_miles.toFixed(1)} miles away.` : 'No support/staging candidate identified in the current scan.');
    else if (prompt.includes('weather')) setResponse(weatherAlerts.length ? weatherAlerts.map((alert) => `${alert.severity}: ${alert.alert_type} — ${alert.summary}`).join('\n') : 'No seeded NOAA weather alerts found. Live NOAA integration is pending.');
    else if (prompt.includes('FAA')) setResponse(faaAlerts.length ? faaAlerts.map((alert) => `${alert.severity}: ${alert.title} — ${alert.summary}`).join('\n') : 'No seeded FAA watch items found. Live FAA/NOTAM integration is pending.');
    else if (prompt.includes('actions')) setResponse(risk.required_mitigations.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'No readiness actions generated yet.');
    else setResponse('Use Generate Brief to create the structured aviation travel readiness brief. Phase 1 responses are local, deterministic, and seeded/demo data based.');
  }

  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">Ask FPI aviation mode</p><h3>Prompt Chips</h3></div><span className="mode-pill">Advisory assistant</span></div>
      <p className="aviation-guardrail">Ask FPI is operating in Aviation Travel Readiness mode. It provides advisory readiness analysis and does not make autonomous flight or security deployment decisions.</p>
      <div className="aviation-chip-list">
        {prompts.map((prompt) => <button key={prompt} type="button" className="ops-action-button secondary" onClick={() => answer(prompt)}>{prompt}</button>)}
      </div>
      <article className="aviation-response aviation-ask-response"><p className="eyebrow">{lastPrompt}</p><h3>Answer summary</h3><p>{response}</p><h3>Supporting data used</h3><p>{airport?.airport_name ?? 'No airport selected'} · {facilities.length} facilities · {faaAlerts.length} FAA items · {weatherAlerts.length} NOAA alerts · score {risk.score}</p><h3>Source freshness / confidence</h3><p>Seeded Demo / API-ready where enabled · {risk.confidence}% confidence</p><h3>Recommended actions</h3><ul>{risk.required_mitigations.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul><h3>Missing data</h3><p>{risk.caveats.join(' ') || 'No additional caveats available.'}</p><p className="aviation-caveat">Human review reminder: authorized aviation, executive protection, and security leaders retain final decision authority.</p></article>
    </section>
  );
}
