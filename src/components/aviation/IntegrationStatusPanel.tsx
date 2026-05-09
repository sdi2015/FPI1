import { useEffect } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';
import { getAviationProviderConfig } from '../../services/aviationProviderConfig';

export function IntegrationStatusPanel() {
  const providers = getAviationProviderConfig();
  useEffect(() => { recordAviationAuditEvent({ event_type: 'integration_status_viewed', actor_role: 'system', summary: 'Integration Status panel viewed.' }); }, []);
  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading"><div><p className="eyebrow">Production integration prep</p><h3>Integration Status</h3></div></div>
      <div className="aviation-table-wrap">
        <table className="aviation-table aviation-integration-table">
          <thead><tr><th>Source</th><th>Current Provider</th><th>Status</th><th>Confidence</th><th>Last Updated</th><th>Notes</th><th>Next Step</th></tr></thead>
          <tbody>{providers.map((provider) => (
            <tr key={provider.provider_name}>
              <td><strong>{provider.display_name}</strong><br /><span>{provider.source_label}</span></td>
              <td><span className={`aviation-badge aviation-badge-${provider.mode}`}>{provider.mode}</span></td>
              <td><span className={`aviation-badge aviation-status-${provider.status}`}>{provider.status}</span></td>
              <td>{provider.confidence}%</td>
              <td>{provider.last_updated ? new Date(provider.last_updated).toLocaleString() : 'Not connected / static'}</td>
              <td>{provider.notes}</td>
              <td>{provider.next_step}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  );
}
