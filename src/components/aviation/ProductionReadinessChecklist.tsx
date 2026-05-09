import { useState } from 'react';

type ChecklistStatus = 'Not Started' | 'In Progress' | 'Blocked' | 'Complete';
type ChecklistItem = { id: string; label: string; status: ChecklistStatus; ownerRole: string; notes: string };

const initialItems: ChecklistItem[] = [
  { id: 'facility-master', label: 'Real Walmart facility master data source approved', status: 'Not Started', ownerRole: 'Data Product Owner', notes: 'Needed before production radius scans.' },
  { id: 'fpi-risk', label: 'Real FPI facility risk/posture source connected', status: 'Not Started', ownerRole: 'FPI Engineering', notes: 'Replace seeded risk posture.' },
  { id: 'faa', label: 'FAA/NOTAM source approved', status: 'Not Started', ownerRole: 'Aviation IT', notes: 'Confirm approved data contract/API.' },
  { id: 'noaa', label: 'NOAA weather source approved', status: 'Not Started', ownerRole: 'Aviation IT', notes: 'Confirm endpoint, caching, and refresh cadence.' },
  { id: 'routing', label: 'Routing/drive-time provider approved', status: 'Not Started', ownerRole: 'Platform Engineering', notes: 'Replace straight-line estimate.' },
  { id: 'persistence', label: 'Production persistence selected', status: 'Not Started', ownerRole: 'App Platform', notes: 'Move saved trips out of localStorage.' },
  { id: 'audit', label: 'Production audit logging selected', status: 'Not Started', ownerRole: 'Security Engineering', notes: 'Move audit events to enterprise logging.' },
  { id: 'rbac', label: 'Role-based access integrated with production identity provider', status: 'Not Started', ownerRole: 'IAM', notes: 'Enforce role claims.' },
  { id: 'sensitive-policy', label: 'EP/traveler sensitive data policy approved', status: 'Not Started', ownerRole: 'EP / Legal / Privacy', notes: 'Protect traveler and EP-sensitive fields.' },
  { id: 'cadence', label: 'Data refresh cadence defined', status: 'Not Started', ownerRole: 'Data Governance', notes: 'Define stale thresholds and SLAs.' },
  { id: 'confidence', label: 'Source confidence rules approved', status: 'Not Started', ownerRole: 'Risk Governance', notes: 'Approve scoring evidence and confidence logic.' },
  { id: 'authority', label: 'Human decision authority disclaimer reviewed', status: 'In Progress', ownerRole: 'Aviation / EP / Security', notes: 'FPI remains advisory.' },
  { id: 'security', label: 'Security review completed', status: 'Not Started', ownerRole: 'Security Review', notes: 'Required before live integrations.' },
  { id: 'privacy', label: 'Privacy review completed', status: 'Not Started', ownerRole: 'Privacy', notes: 'Required before traveler data.' },
  { id: 'uat', label: 'Aviation stakeholder UAT completed', status: 'Not Started', ownerRole: 'Aviation Stakeholders', notes: 'Leadership demo precedes UAT.' },
];

export function ProductionReadinessChecklist() {
  const [items, setItems] = useState(initialItems);
  return (
    <section className="panel aviation-panel aviation-table-panel">
      <div className="card-heading"><div><p className="eyebrow">Before production</p><h3>Production Readiness Checklist</h3></div></div>
      <div className="aviation-table-wrap"><table className="aviation-table aviation-readiness-table"><thead><tr><th>Item</th><th>Status</th><th>Owner Role</th><th>Notes</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.label}</td><td><select className="aviation-input" value={item.status} onChange={(event) => setItems((current) => current.map((row) => row.id === item.id ? { ...row, status: event.target.value as ChecklistStatus } : row))}><option>Not Started</option><option>In Progress</option><option>Blocked</option><option>Complete</option></select></td><td>{item.ownerRole}</td><td>{item.notes}</td></tr>)}</tbody></table></div>
    </section>
  );
}
