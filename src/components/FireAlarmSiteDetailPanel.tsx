import type { FireAlarmSiteDetailModel } from '../data/fireAlarmMetrics';
import { riskColor } from '../data/fireAlarmMetrics';

export function FireAlarmSiteDetailPanel({ detail, onClose }: { detail: FireAlarmSiteDetailModel | null; onClose: () => void }) {
  if (!detail) return null;
  const { site } = detail;

  return (
    <aside className="fire-site-detail-panel" aria-label="Fire alarm site detail">
      <div className="fire-site-detail-header">
        <div>
          <p className="fire-ops-eyebrow">Fire Site Drilldown</p>
          <h2>{site.name}</h2>
          <p>{site.id} • {site.city}, {site.state} • {site.region}</p>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </div>

      <div className="fire-site-risk-card" style={{ borderColor: riskColor(detail.riskLevel) }}>
        <span>Risk Score</span>
        <strong style={{ color: riskColor(detail.riskLevel) }}>{site.riskScore}</strong>
        <em>{detail.riskLevel}</em>
      </div>

      <div className="fire-detail-grid">
        <Metric label="Format" value={site.format} />
        <Metric label="Square Feet" value={formatNumber(site.sqft)} />
        <Metric label="Panel Type" value={site.panelType} />
        <Metric label="Monitoring" value={site.monitoringType} />
        <Metric label="Contractor" value={site.contractor} />
        <Metric label="AHJ" value={site.ahj} />
        <Metric label="Compliance" value={site.complianceStatus} />
        <Metric label="Status" value={site.status} />
        <Metric label="Active Troubles" value={site.activeTroubles} />
        <Metric label="Open Deficiencies" value={site.openDeficiencies} />
        <Metric label="False Alarms 90d" value={site.falseAlarms90Days} />
        <Metric label="Next Inspection" value={formatDate(site.nextInspectionDue)} />
      </div>

      <section className="fire-detail-section"><h3>Asset & Evidence Summary</h3><div className="fire-detail-grid compact"><Metric label="Devices" value={detail.devices.length} /><Metric label="Events" value={detail.events.length} /><Metric label="Service Records" value={detail.serviceRecords.length} /><Metric label="Reports" value={detail.complianceReports.length} /></div></section>
      <RecordSection title="Recent Events" records={detail.events.slice(0, 6).map((event) => `${formatDate(event.date)} • ${event.type ?? 'Event'} • ${event.area ?? 'Area N/A'} • ${event.rootCause ?? 'Root cause N/A'}`)} />
      <RecordSection title="Open Deficiencies" records={detail.deficiencies.slice(0, 6).map((item) => `${item.severity ?? 'Unknown'} • ${item.category ?? 'Category N/A'} • ${item.finding ?? 'Finding N/A'} • due ${formatDate(item.dueDate)}`)} />
      <RecordSection title="Service Records" records={detail.serviceRecords.slice(0, 6).map((item) => `${formatDate(item.dateOpened)} • ${item.issueType ?? 'Issue'} • ${item.rootCause ?? 'Root cause N/A'} • ${item.slaStatus ?? 'SLA N/A'}`)} />
      <RecordSection title="PM Recommendations" records={detail.recommendations.slice(0, 6).map((item) => `${item.severity ?? 'Info'} • ${item.title ?? item.category ?? 'Recommendation'} • ${item.action ?? 'Action pending'}`)} />
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="fire-detail-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function RecordSection({ title, records }: { title: string; records: string[] }) {
  return <section className="fire-detail-section"><h3>{title}</h3>{records.length > 0 ? records.map((record) => <p key={record}>{record}</p>) : <p>No records for this site.</p>}</section>;
}

function formatDate(value?: string): string {
  if (!value) return 'N/A';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
