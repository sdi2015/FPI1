import { useMemo, useState } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { generateTripBrief } from '../../services/tripBriefService';
import type { Airport, FAAAlert, FacilityWithDistance, TripRiskResult, WeatherAlert } from '../../types/aviation';

export function downloadBriefAsTxt(brief: string, filename: string): void { download(brief, filename.endsWith('.txt') ? filename : `${filename}.txt`, 'text/plain'); }
export function downloadBriefAsMarkdown(brief: string, filename: string): void { download(`\`\`\`text\n${brief}\n\`\`\``, filename.endsWith('.md') ? filename : `${filename}.md`, 'text/markdown'); }
function download(content: string, filename: string, type: string) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
export function openPrintFriendlyBrief(brief: string): void { const win = window.open('', '_blank', 'noopener,noreferrer'); if (!win) return; win.document.write(`<html><head><title>FPI Aviation Brief</title><style>body{font-family:Arial,sans-serif;white-space:pre-wrap;margin:2rem;line-height:1.45}</style></head><body>${brief.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)}</body></html>`); win.document.close(); win.focus(); }

export function TripBriefPanel({ airport, radiusMiles, tripStart, tripEnd, facilityTypes, nearbyFacilities, risk, faaAlerts, weatherAlerts, canGenerateBrief, canCopyBrief, actorRole = 'unknown', tripId = null }: { airport: Airport | null; radiusMiles: number; tripStart: string; tripEnd: string; facilityTypes: string[]; nearbyFacilities: FacilityWithDistance[]; risk: TripRiskResult; faaAlerts: FAAAlert[]; weatherAlerts: WeatherAlert[]; canGenerateBrief: boolean; canCopyBrief: boolean; actorRole?: string; tripId?: string | null }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const brief = useMemo(() => generateTripBrief({ airport, radiusMiles, tripStart, tripEnd, facilityTypes, nearbyFacilities, risk, faaAlerts, weatherAlerts }), [airport, radiusMiles, tripStart, tripEnd, facilityTypes, nearbyFacilities, risk, faaAlerts, weatherAlerts]);
  const filename = `fpi-aviation-brief-${airport?.faa_id ?? airport?.airport_id ?? 'draft'}`;

  function audit(action: string) { recordAviationAuditEvent({ event_type: action === 'generate' ? 'trip_brief_generated' : 'brief_exported', actor_role: actorRole, trip_id: tripId, airport_id: airport?.airport_id ?? null, summary: `Trip brief ${action}.`, source_context: { provider: 'persistenceProvider', source_status: 'localStorage', confidence: 70 } }); }
  async function copyBrief() { await navigator.clipboard.writeText(brief); setCopied(true); audit('copied'); }

  return (
    <section className="panel aviation-panel">
      <div className="card-heading"><div><p className="eyebrow">Executive-ready output</p><h3>Trip Brief</h3></div></div>
      {!canGenerateBrief ? <p className="aviation-empty">Brief generation is restricted for this role.</p> : <button type="button" className="ops-action-button" onClick={() => { setVisible(true); audit('generate'); }}>Generate Trip Brief</button>}
      {visible ? <>
        <div className="aviation-brief-actions">
          <button type="button" className="ops-action-button secondary" disabled={!canCopyBrief} onClick={copyBrief}>{copied ? 'Copied' : 'Copy Brief'}</button>
          <button type="button" className="ops-action-button secondary" onClick={() => { downloadBriefAsTxt(brief, filename); audit('downloaded as TXT'); }}>Download TXT</button>
          <button type="button" className="ops-action-button secondary" onClick={() => { downloadBriefAsMarkdown(brief, filename); audit('downloaded as MD'); }}>Download MD</button>
          <button type="button" className="ops-action-button secondary" onClick={() => { openPrintFriendlyBrief(brief); audit('opened in print view'); }}>Print View</button>
        </div>
        <pre className="aviation-brief">{brief}</pre>
      </> : null}
    </section>
  );
}
