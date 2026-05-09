import type { TripReadinessAction } from '../../types/aviation';

export function TripReadinessActions({ actions, canCreateActions, canViewEPReadiness, onGenerateActions, onStatusChange }: { actions: TripReadinessAction[]; canCreateActions: boolean; canViewEPReadiness: boolean; onGenerateActions: () => void; onStatusChange: (actionId: string, status: TripReadinessAction['status']) => void }) {
  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading"><div><p className="eyebrow">Readiness workflow</p><h3>Trip Readiness Actions</h3></div><span className="mode-pill">{actions.length} actions</span></div>
      <button type="button" className="ops-action-button" disabled={!canCreateActions} onClick={onGenerateActions}>Generate readiness actions</button>
      {!canCreateActions ? <p className="aviation-empty">Action creation is restricted for this role.</p> : null}
      {actions.length === 0 ? <p className="aviation-empty">No actions generated yet. Generate actions from current risk drivers.</p> : (
        <div className="aviation-table-wrap">
          <table className="aviation-table aviation-actions-table">
            <thead><tr><th>Action</th><th>Source Driver</th><th>Owner Role</th><th>Priority</th><th>Due Time</th><th>Evidence Required</th><th>Status</th></tr></thead>
            <tbody>
              {actions.map((action) => {
                const restricted = action.source_domain === 'EP' && !canViewEPReadiness;
                return <tr key={action.action_id}>
                  <td><strong>{restricted ? 'Restricted EP readiness action' : action.title}</strong><br /><span>{restricted ? 'Requires authorized EP/FPI role.' : action.description}</span></td>
                  <td>{restricted ? 'Restricted' : action.created_from_driver}</td>
                  <td>{action.owner_role}</td>
                  <td>{action.priority}</td>
                  <td>{action.due_time ? new Date(action.due_time).toLocaleString() : 'Not set'}</td>
                  <td>{action.evidence_required ? (action.evidence_type ?? 'Yes') : 'No'}</td>
                  <td><select className="aviation-input" value={action.status} onChange={(event) => onStatusChange(action.action_id, event.target.value as TripReadinessAction['status'])}><option>Open</option><option>In Progress</option><option>Verified</option><option>Closed</option></select></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
