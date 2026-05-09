import { useEffect } from 'react';
import { recordAviationAuditEvent } from '../../services/aviationAuditService';

const columns = ['Decision / Action', 'Aviation Admin', 'Aviation User', 'Executive Protection', 'Global Security', 'Field Security', 'FPI Admin', 'Viewer'];
const rows = [
  ['View aviation module', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Limited'],
  ['Search airports', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Limited'],
  ['Scan facilities', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'No'],
  ['View EP readiness', 'Yes', 'Restricted', 'Yes', 'Yes', 'Restricted', 'Yes', 'No'],
  ['Generate brief', 'Yes', 'Yes', 'Yes', 'Yes', 'No', 'Yes', 'No'],
  ['Export brief', 'Yes', 'Yes', 'Yes', 'Yes', 'No', 'Yes', 'No'],
  ['Change provider mode', 'Yes', 'No', 'No', 'No', 'No', 'Yes', 'No'],
  ['Import facility data', 'Yes', 'No', 'No', 'No', 'No', 'Yes', 'No'],
  ['Update readiness actions', 'Yes', 'Limited', 'Yes', 'Yes', 'Limited', 'Yes', 'No'],
  ['Approve trip review status', 'Yes', 'No', 'Yes', 'Yes', 'No', 'Yes', 'No'],
  ['Close trip', 'Yes', 'No', 'Yes', 'Yes', 'No', 'Yes', 'No'],
];

export function AviationGovernanceMatrix() {
  useEffect(() => { recordAviationAuditEvent({ event_type: 'governance_matrix_viewed', actor_role: 'system', summary: 'Aviation governance matrix viewed.' }); }, []);
  return <section className="panel aviation-panel aviation-table-panel"><div className="card-heading"><div><p className="eyebrow">Pilot governance</p><h3>Approval Matrix</h3></div></div><div className="aviation-table-wrap"><table className="aviation-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div><p className="aviation-caveat">Governance aligns to current role permissions where available. Provider mode changes and facility imports remain future controlled admin capabilities.</p></section>;
}
