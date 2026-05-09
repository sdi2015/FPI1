import { useState } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { generateAviationPilotReadoutReport } from '../../services/aviationReadoutReportService';
import { getSavedTripPlans } from '../../services/aviationTripStorageService';
import { downloadBriefAsMarkdown, downloadBriefAsTxt, openPrintFriendlyBrief } from './TripBriefPanel';

export function AviationPilotReadoutReportPanel({ actorRole }: { actorRole: string }) {
  const [report, setReport] = useState('');
  async function generate() { const trips = await getSavedTripPlans(); const next = generateAviationPilotReadoutReport(trips); setReport(next); recordAviationAuditEvent({ event_type: 'pilot_readout_report_generated', actor_role: actorRole, summary: 'Pilot readout report generated.' }); }
  function audit(summary: string) { recordAviationAuditEvent({ event_type: 'pilot_readout_report_exported', actor_role: actorRole, summary }); }
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Stakeholder readout</p><h3>Pilot Readout Report Generator</h3></div></div><button className="ops-action-button" onClick={generate}>Generate Pilot Readout Report</button>{report ? <><div className="aviation-brief-actions"><button className="ops-action-button secondary" onClick={() => { navigator.clipboard.writeText(report); audit('Pilot readout report copied.'); }}>Copy report</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsMarkdown(report, 'fpi-aviation-pilot-readout.md'); audit('Pilot readout report downloaded as MD.'); }}>Download .md</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsTxt(report, 'fpi-aviation-pilot-readout.txt'); audit('Pilot readout report downloaded as TXT.'); }}>Download .txt</button><button className="ops-action-button secondary" onClick={() => { openPrintFriendlyBrief(report); audit('Pilot readout report opened in print view.'); }}>Print view</button></div><pre className="aviation-brief">{report}</pre></> : <p className="aviation-empty">Generate after demo, UAT, feedback, issues, and stakeholder decisions are captured.</p>}</section>;
}
