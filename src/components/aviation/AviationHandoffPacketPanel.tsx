import { useState } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { generateAviationHandoffPacket } from '../../services/aviationHandoffPacketService';
import { getSavedTripPlans } from '../../services/aviationTripStorageService';
import { downloadBriefAsMarkdown, downloadBriefAsTxt, openPrintFriendlyBrief } from './TripBriefPanel';

export function AviationHandoffPacketPanel({ actorRole }: { actorRole: string }) {
  const [packet, setPacket] = useState('');
  async function generate() { const trips = await getSavedTripPlans(); const next = generateAviationHandoffPacket(trips); setPacket(next); recordAviationAuditEvent({ event_type: 'handoff_packet_generated', actor_role: actorRole, summary: 'Aviation pilot handoff packet generated.' }); }
  function audit(summary: string) { recordAviationAuditEvent({ event_type: 'handoff_packet_exported', actor_role: actorRole, summary }); }
  return <section className="panel aviation-panel"><div className="card-heading"><div><p className="eyebrow">Production transition</p><h3>Handoff Packet Generator</h3></div></div><button className="ops-action-button" onClick={generate}>Generate Handoff Packet</button>{packet ? <><div className="aviation-brief-actions"><button className="ops-action-button secondary" onClick={() => { navigator.clipboard.writeText(packet); audit('Handoff packet copied.'); }}>Copy packet</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsMarkdown(packet, 'fpi-aviation-handoff-packet.md'); audit('Handoff packet downloaded as MD.'); }}>Download .md</button><button className="ops-action-button secondary" onClick={() => { downloadBriefAsTxt(packet, 'fpi-aviation-handoff-packet.txt'); audit('Handoff packet downloaded as TXT.'); }}>Download .txt</button><button className="ops-action-button secondary" onClick={() => { openPrintFriendlyBrief(packet); audit('Handoff packet opened in print view.'); }}>Print view</button></div><pre className="aviation-brief">{packet}</pre></> : <p className="aviation-empty">Generate a markdown handoff packet after pilot review.</p>}</section>;
}
