import type { FacilityDetailModel } from '../data/fpiSelectors';
import type { FpiAlarmSignal, FpiCameraIssue, FpiPanel, FpiRemediation, FpiRiskTier, FpiWorkItem, StatusTone } from '../data/fpiTypes';

export type FacilityDetailPanelProps = {
  facility: FacilityDetailModel | null;
  onClose: () => void;
};

export function FacilityDetailPanel({ facility, onClose }: FacilityDetailPanelProps) {
  if (!facility) return null;

  return (
    <section className="facility-detail-panel panel" aria-labelledby="facility-detail-title">
      <div className="facility-detail-header">
        <div>
          <p className="eyebrow">Facility detail</p>
          <h2 id="facility-detail-title">{facility.facilityName}</h2>
          <p>
            {facility.facilityId} • {facility.region} • {facility.market} • {facility.city}, {facility.state}
          </p>
          {facility.address ? <p>{facility.address}{facility.zipCode ? ` • ${facility.zipCode}` : ''}</p> : null}
          {facility.locationSource ? <p>Location source: {facility.locationSource}</p> : null}
        </div>
        <div className="facility-detail-actions">
          <span className={`status-pill status-${riskTierTone(facility.riskTier)}`}>{facility.riskTier.toUpperCase()}</span>
          <button type="button" className="detail-close-button" onClick={onClose} aria-label="Close facility detail panel">
            Close
          </button>
        </div>
      </div>

      <div className="facility-summary-grid" aria-label="Facility posture summary">
        <SummaryMetric label="Risk score" value={facility.riskScore} />
        <SummaryMetric label="Banner" value={facility.banner} />
        <SummaryMetric label="ELM priority" value={facility.finalPriority ?? 'N/A'} />
        <SummaryMetric label="Coordinates" value={formatCoordinates(facility.latitude, facility.longitude)} />
        <SummaryMetric label="Critical exceptions" value={facility.criticalExceptions} />
        <SummaryMetric label="Active signals" value={facility.activeSignals} />
        <SummaryMetric label="Camera issues" value={facility.cameraIssues} />
        <SummaryMetric label="Panel trouble" value={facility.panelTrouble} />
        <SummaryMetric label="Open work items" value={facility.openWorkItems} />
      </div>

      <section className="facility-section" aria-labelledby="facility-protection-summary-title">
        <h3 id="facility-protection-summary-title">Protection Summary</h3>
        <p>
          Primary concern: <strong>{facility.primaryIssueType}</strong>. This facility is currently classified as{' '}
          <strong>{facility.riskTier}</strong> with {facility.criticalExceptions} active critical exceptions.
        </p>
        {facility.finalStatus || facility.googleStatus ? (
          <p>
            ELM status: <strong>{facility.finalStatus ?? 'Not provided'}</strong>
            {facility.googleStatus ? ` • Google check: ${facility.googleStatus}` : ''}
          </p>
        ) : null}
        {facility.finalNotes ? <p>{facility.finalNotes}</p> : null}
      </section>

      <div className="facility-detail-grid">
        <RecordSection title="Technology & Camera Issues" emptyText="No active records in this category.">
          {facility.cameraIssueRecords.map((issue) => (
            <CameraIssueRecord issue={issue} key={issue.id} />
          ))}
        </RecordSection>

        <RecordSection title="Panel / Fire / Device Health" emptyText="No panel or device-health records in this category.">
          {facility.panelRecords.map((panel) => (
            <PanelRecord panel={panel} key={panel.id} />
          ))}
        </RecordSection>

        <RecordSection title="Alarm Signals" emptyText="No alarm signals in this category.">
          {facility.signals.map((signal) => (
            <SignalRecord signal={signal} key={signal.id} />
          ))}
        </RecordSection>

        <RecordSection title="Open Work Queue" emptyText="No active records in this category.">
          {facility.workItems.map((task) => (
            <WorkItemRecord task={task} key={task.id} />
          ))}
        </RecordSection>

        <RecordSection title="Remediation Status" emptyText="No remediation records in this category.">
          {facility.remediations.map((remediation) => (
            <RemediationRecord remediation={remediation} key={remediation.id} />
          ))}
        </RecordSection>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RecordSection({ title, emptyText, children }: { title: string; emptyText: string; children: any }) {
  const records = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <section className="facility-section record-section">
      <h3>{title}</h3>
      {records.length > 0 ? <div className="facility-record-list">{children}</div> : <p className="empty-records">{emptyText}</p>}
    </section>
  );
}

function CameraIssueRecord({ issue }: { issue: FpiCameraIssue }) {
  return (
    <article className="facility-record">
      <strong>{formatLabel(issue.issueType)}</strong>
      <span>{issue.area} • {issue.status}</span>
      <small>{issue.severity} severity</small>
    </article>
  );
}

function PanelRecord({ panel }: { panel: FpiPanel }) {
  return (
    <article className="facility-record">
      <strong>{panel.panelType}</strong>
      <span>{panel.vendor} • {panel.status}</span>
      <small>Health score {panel.healthScore}</small>
    </article>
  );
}

function SignalRecord({ signal }: { signal: FpiAlarmSignal }) {
  return (
    <article className="facility-record">
      <strong>{formatLabel(signal.type)}</strong>
      <span>{signal.category} • {signal.status}</span>
      <small>{signal.severity} severity • {signal.priority}</small>
    </article>
  );
}

function WorkItemRecord({ task }: { task: FpiWorkItem }) {
  return (
    <article className="facility-record">
      <strong>{task.title}</strong>
      <span>{task.ownerRole} • {task.status}</span>
      <small>{task.priority} • {task.riskType}</small>
    </article>
  );
}

function RemediationRecord({ remediation }: { remediation: FpiRemediation }) {
  return (
    <article className="facility-record">
      <strong>{remediation.riskType}</strong>
      <span>{remediation.status}</span>
      <small>{remediation.severity} severity • linked task {remediation.taskId || 'N/A'}</small>
    </article>
  );
}

function riskTierTone(riskTier: FpiRiskTier): StatusTone {
  if (riskTier === 'Critical') return 'critical';
  if (riskTier === 'High') return 'watch';
  if (riskTier === 'Medium') return 'stable';
  return 'ready';
}

function formatCoordinates(latitude?: number | null, longitude?: number | null): string {
  return typeof latitude === 'number' && typeof longitude === 'number' ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : 'N/A';
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Not available';
}
