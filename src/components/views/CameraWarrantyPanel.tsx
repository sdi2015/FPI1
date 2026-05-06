import { useMemo, useState } from 'react';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StatusTone } from '../../data/fpiTypes';
import type { StoreScopeState } from '../../data/storeScope';
import type { CameraWarrantyData, CameraWarrantyRecord } from '../../data/cameraWarrantyTypes';
import { formatNumber } from '../../data/technologyHealthSelectors';
import { useWarrantyRoiQueueData, type ChartDatum, type WarrantyRoiQueueData, type WarrantyRoiQueueRecord } from '../../data/useWarrantyRoiQueueData';

type WarrantyStatusFilter = 'all' | 'candidates' | 'missing' | 'known';

export type CameraWarrantyPanelProps = {
  data: CameraWarrantyData | null;
  loading: boolean;
  error: string | null;
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
};

export function CameraWarrantyPanel({ data, loading, error, fireSites, storeScope }: CameraWarrantyPanelProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WarrantyStatusFilter>('all');
  const roiQueueState = useWarrantyRoiQueueData();

  const scopedRecords = useMemo(() => (data ? scopeWarrantyRecords(data.records, fireSites, storeScope) : []), [data, fireSites, storeScope]);
  const scopedStores = useMemo(() => summarizeWarrantyStores(scopedRecords), [scopedRecords]);
  const missingInstall = useMemo(() => scopedRecords.filter((record) => isMissingInstallDate(record)), [scopedRecords]);
  const candidates = useMemo(() => scopedRecords.filter((record) => record.warrantyReplacementCandidate === 'Yes'), [scopedRecords]);
  const oldestKnownAge = useMemo(() => Math.max(0, ...scopedRecords.map((record) => record.warrantyAgeYears ?? 0)), [scopedRecords]);
  const filteredRecords = useMemo(() => filterWarrantyRecords(scopedRecords, search, statusFilter), [scopedRecords, search, statusFilter]);
  const reviewRows = useMemo(() => [...candidates, ...missingInstall].slice(0, 120), [candidates, missingInstall]);

  if (loading) return <StatePanel title="Loading camera warranty data" message="Preparing Phase 1 enriched camera lifecycle records." />;
  if (error) return <StatePanel title="Camera warranty data unavailable" message={error} danger />;
  if (!data) return <StatePanel title="Camera warranty data unavailable" message="No camera warranty data loaded." danger />;

  return (
    <section className="tech-grid" aria-label="Camera warranty lifecycle management">
      <section className="tech-card wide">
        <CardHeading eyebrow="Camera lifecycle" title="Warranty replacement checks from Phase 1 enriched camera data" pill="SANITIZED" tone="watch" />
        <p>Network identifiers are excluded from this UI dataset. Warranty status is based on install date, camera model, assigned canonical store number, and the configured {data.metadata.warrantyThresholdYears}-year threshold.</p>
        <div className="tech-metric-grid">
          <Metric label="Scoped cameras" value={formatNumber(scopedRecords.length)} helper={`${formatNumber(data.summary.totalCameras)} total cameras in source`} />
          <Metric label="Stores represented" value={formatNumber(scopedStores.length)} helper="Canonical store assignments from Phase 1" />
          <Metric label="Replacement candidates" value={formatNumber(candidates.length)} helper={`${data.metadata.warrantyThresholdYears}-year threshold`} />
          <Metric label="Missing install date" value={formatNumber(missingInstall.length)} helper="Needs data cleanup before warranty decision" />
        </div>
      </section>

      <WarrantyRoiShowcase state={roiQueueState} />

      <section className="tech-card wide">
        <CardHeading eyebrow="Lifecycle posture" title="Executive warranty readiness summary" pill={missingInstall.length > 0 ? 'DATA CLEANUP' : 'READY'} tone={missingInstall.length > 0 ? 'watch' : 'ready'} />
        <div className="tech-governance-grid">
          <article><span>01</span><strong>Warranty exposure</strong><small>{candidates.length === 0 ? 'No cameras currently exceed the replacement threshold in the scoped Phase 1 data.' : `${formatNumber(candidates.length)} cameras require replacement review based on install age.`}</small></article>
          <article><span>02</span><strong>Data quality action</strong><small>{formatNumber(missingInstall.length)} scoped cameras are missing install dates and should be remediated before warranty decisions are finalized.</small></article>
          <article><span>03</span><strong>Oldest known camera</strong><small>{oldestKnownAge > 0 ? `${oldestKnownAge.toFixed(2)} years old in the current scope.` : 'No known install dates available in the current scope.'}</small></article>
          <article><span>04</span><strong>Lifecycle planning</strong><small>Use model concentration and store rollups to plan refresh waves without exposing raw network identifiers.</small></article>
        </div>
      </section>

      <section className="tech-card">
        <CardHeading eyebrow="Camera model mix" title="Top models in scope" />
        <ChartRows rows={topModelCounts(scopedRecords)} />
      </section>

      <section className="tech-card wide">
        <CardHeading eyebrow="Store rollup" title="Warranty posture by assigned store" />
        <WarrantyStoreTable stores={scopedStores.slice(0, 24)} />
      </section>

      <section className="tech-card">
        <CardHeading eyebrow="Cleanup queue" title="Missing install-date records" pill={missingInstall.length > 0 ? 'REVIEW' : 'CLEAR'} tone={missingInstall.length > 0 ? 'watch' : 'ready'} />
        <p>These records preserve camera, model, store, and assignment-source detail so data owners can recover install dates without exposing raw network identifiers.</p>
        <WarrantyCameraTable records={missingInstall.slice(0, 24)} compact />
      </section>

      <section className="tech-card wide">
        <CardHeading eyebrow="Review queue" title="Replacement candidates and missing install dates" pill="ACTIONABLE" tone="stable" />
        <WarrantyCameraTable records={reviewRows} />
      </section>

      <section className="tech-card wide">
        <CardHeading eyebrow="Camera detail" title="Scoped warranty data explorer" pill="PHASE 1 DETAIL" tone="ready" />
        <div className="tech-warranty-toolbar">
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search camera, model, firmware, store, facility, warranty status" aria-label="Search camera warranty records" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as WarrantyStatusFilter)} aria-label="Filter camera warranty records">
            <option value="all">All warranty records</option>
            <option value="candidates">Replacement candidates</option>
            <option value="missing">Missing install dates</option>
            <option value="known">Known install dates</option>
          </select>
        </div>
        <p className="tech-table-caption">Showing {formatNumber(Math.min(filteredRecords.length, 160))} of {formatNumber(filteredRecords.length)} scoped records. Refine the search to inspect specific cameras, stores, models, or firmware versions.</p>
        <WarrantyCameraTable records={filteredRecords.slice(0, 160)} showNotes />
      </section>
    </section>
  );
}

function WarrantyRoiShowcase({ state }: { state: ReturnType<typeof useWarrantyRoiQueueData> }) {
  if (state.loading) {
    return <section className="tech-card wide"><CardHeading eyebrow="ROI queue" title="Loading warranty recovery opportunity" pill="LOADING" tone="stable" /><p>Preparing warranty service-ticket ROI data.</p></section>;
  }
  if (state.error || !state.data) {
    return <section className="tech-card wide"><CardHeading eyebrow="ROI queue" title="Warranty ROI data unavailable" pill="OPTIONAL" tone="watch" /><p>{state.error ?? 'No warranty ROI queue data loaded.'}</p></section>;
  }

  const { data } = state;
  const summary = data.summary;

  return (
    <>
      <section className="tech-card wide warranty-roi-hero">
        <CardHeading eyebrow="ROI opportunity" title="Warranty recovery value from service-ticket queue" pill="RECOVERY" tone="ready" />
        <p>Prioritize recoverable RMA value, escalation timing, and warranty claim follow-up from the warranty queue.</p>
        <div className="warranty-roi-kpis">
          <RoiMetric label="Net recovery opportunity" value={formatCurrency(summary.netRecoveryOpportunity)} helper={`${formatNumber(summary.totalTickets)} warranty queue tickets`} tone="blue" />
          <RoiMetric label="Claim-ready recovery" value={formatCurrency(summary.claimReadyRecovery)} helper={`${formatNumber(summary.claimReadyTickets)} submit-claim tickets`} tone="green" />
          <RoiMetric label="Replacement spend" value={formatCurrency(summary.replacementSpend)} helper={`${formatNumber(summary.purchasedReplacementTickets)} purchases in queue`} tone="yellow" />
          <RoiMetric label="ROI yield" value={`${summary.roiPercent.toFixed(1)}%`} helper={`${formatCurrency(summary.averageRecoveryPerTicket)} net per ticket`} tone="sky" />
        </div>
        <div className="warranty-roi-actions">
          <article><strong>{formatNumber(summary.rmaEligibilityTickets)}</strong><span>Check RMA Eligibility</span><small>Potential claims need validation before submission.</small></article>
          <article><strong>{formatNumber(summary.claimReadyTickets)}</strong><span>Submit Warranty Claim</span><small>{formatCurrency(summary.averageClaimValue)} average claim-ready value.</small></article>
          <article><strong>{formatNumber(summary.escalationTickets)}</strong><span>Escalate Before Warranty Expires</span><small>Time-sensitive tickets need leadership follow-up.</small></article>
          <article><strong>{formatCurrency(summary.leakageOrTriageCost)}</strong><span>Triage / leakage offset</span><small>Negative recovery rows reduce net opportunity.</small></article>
        </div>
      </section>

      <section className="tech-card wide">
        <CardHeading eyebrow="Recovery drivers" title="Where warranty value is concentrated" pill="CHARTED" tone="ready" />
        <div className="warranty-chart-grid">
          <RoiBarChart title="Recovery by manufacturer" rows={data.charts.manufacturerRecovery} valueFormatter={formatSignedCurrency} secondaryLabel="tickets" />
          <RoiBarChart title="Recovery by action" rows={data.charts.actionRecovery} valueFormatter={formatSignedCurrency} secondaryLabel="tickets" />
          <RoiBarChart title="Top stores by net recovery" rows={data.charts.topStoreRecovery} valueFormatter={formatSignedCurrency} secondaryLabel="tickets" />
          <RoiBarChart title="Warranty expiration timing" rows={data.charts.expirationBuckets} valueFormatter={(value) => formatNumber(value)} />
        </div>
      </section>

      <section className="tech-card">
        <CardHeading eyebrow="Operational mix" title="Priority and failure patterns" />
        <div className="warranty-mini-chart-stack">
          <RoiBarChart title="Priority count" rows={data.charts.priorityCounts} valueFormatter={(value) => formatNumber(value)} compact />
          <RoiBarChart title="Top failure reasons" rows={data.charts.failureReasons} valueFormatter={(value) => formatNumber(value)} compact />
        </div>
      </section>

      <section className="tech-card wide">
        <CardHeading eyebrow="Action queue" title="Highest-value warranty tickets" pill="TOP ROI" tone="watch" />
        <WarrantyRoiTicketTable records={topRecoveryTickets(data)} />
      </section>
    </>
  );
}

function RoiMetric({ label, value, helper, tone }: { label: string; value: string; helper: string; tone: 'blue' | 'green' | 'yellow' | 'sky' }) {
  return <article className={`warranty-roi-metric tone-${tone}`}><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>;
}

function RoiBarChart({ title, rows, valueFormatter, secondaryLabel, compact = false }: { title: string; rows: ChartDatum[]; valueFormatter: (value: number) => string; secondaryLabel?: string; compact?: boolean }) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <article className={compact ? 'warranty-bar-card compact' : 'warranty-bar-card'}>
      <h3>{title}</h3>
      <div className="warranty-bar-list">
        {rows.map((row) => {
          const percent = Math.max(4, (Math.abs(row.value) / max) * 100);
          return <div className="warranty-bar-row" key={row.label}><div><span>{row.label}</span><strong>{valueFormatter(row.value)}</strong>{secondaryLabel && row.secondaryValue !== undefined ? <small>{formatNumber(row.secondaryValue)} {secondaryLabel}</small> : null}</div><div className="warranty-bar-track"><span className={row.value < 0 ? 'negative' : undefined} style={{ width: `${percent}%` }} /></div></div>;
        })}
      </div>
    </article>
  );
}

function WarrantyRoiTicketTable({ records }: { records: WarrantyRoiQueueRecord[] }) {
  if (records.length === 0) return <p className="tech-empty">No warranty ROI tickets available.</p>;
  return <div className="tech-table-wrap warranty-roi-ticket-wrap"><table className="tech-table warranty-roi-ticket-table"><thead><tr><th>Ticket</th><th>Store</th><th>Camera</th><th>Priority</th><th>Action</th><th>Days Left</th><th>Recovery</th></tr></thead><tbody>{records.map((record) => <tr key={record.ticketId}><td><strong>{record.ticketId}</strong><small>{record.ticketCreatedDate}</small></td><td><strong>{record.siteName}</strong><small>Market {record.market} · Region {record.region}</small></td><td><strong>{record.manufacturer} {record.model}</strong><small>{record.failureReason}</small></td><td><StatusPill label={record.priority.toUpperCase()} tone={priorityTone(record.priority)} /></td><td>{record.recommendedAction}</td><td>{formatNumber(record.daysUntilWarrantyExpiration)}</td><td><strong>{formatSignedCurrency(record.potentialRecoveryValue)}</strong><small>Replacement: {formatCurrency(record.replacementCost)}</small></td></tr>)}</tbody></table></div>;
}

function topRecoveryTickets(data: WarrantyRoiQueueData): WarrantyRoiQueueRecord[] {
  return [...data.records].sort((a, b) => b.potentialRecoveryValue - a.potentialRecoveryValue).slice(0, 18);
}

function priorityTone(priority: string): StatusTone {
  if (priority === 'Critical') return 'critical';
  if (priority === 'High') return 'watch';
  if (priority === 'Medium') return 'stable';
  return 'ready';
}

function WarrantyStoreTable({ stores }: { stores: ReturnType<typeof summarizeWarrantyStores> }) {
  if (stores.length === 0) return <p className="tech-empty">No warranty store rows available for the current scope.</p>;
  return <div className="tech-table-wrap"><table className="tech-table"><thead><tr><th>Store</th><th>Cameras</th><th>Replacement Candidates</th><th>Missing Install Dates</th><th>Oldest Age</th></tr></thead><tbody>{stores.map((store) => <tr key={store.storeNumber}><td><strong>{store.storeNumber}</strong><small>{store.facilityName}</small></td><td>{formatNumber(store.cameraCount)}</td><td>{formatNumber(store.warrantyCandidateCount)}</td><td>{formatNumber(store.missingInstallDateCount)}</td><td>{store.oldestCameraAgeYears === null ? 'N/A' : `${store.oldestCameraAgeYears.toFixed(2)} yrs`}<small>{store.oldestInstallDate || 'No install date'}</small></td></tr>)}</tbody></table></div>;
}

function WarrantyCameraTable({ records, compact = false, showNotes = false }: { records: CameraWarrantyRecord[]; compact?: boolean; showNotes?: boolean }) {
  if (records.length === 0) return <p className="tech-empty">No warranty camera records match the current scope and filters.</p>;
  return <div className="tech-table-wrap warranty-camera-wrap"><table className="tech-table warranty-camera-table"><thead><tr><th>Store</th><th>Camera</th><th>Model</th><th>Install Date</th><th>Age</th><th>Warranty Status</th>{compact ? null : <th>Firmware</th>}{showNotes ? <th>Notes / Source</th> : null}</tr></thead><tbody>{records.map((record) => <tr key={`${record.storeNumber}-${record.cameraName}`}><td><strong>{record.storeNumber}</strong><small>{record.facilityName}</small></td><td><strong>{record.cameraName}</strong><small>{record.facilityId}</small></td><td>{record.cameraModel || 'Unknown'}</td><td>{record.installDate || 'Missing'}</td><td>{record.warrantyAgeYears === null ? 'N/A' : `${record.warrantyAgeYears.toFixed(2)} yrs`}</td><td><StatusPill label={record.warrantyReplacementCandidate} tone={record.warrantyReplacementCandidate === 'Yes' ? 'critical' : isMissingInstallDate(record) ? 'watch' : 'ready'} /></td>{compact ? null : <td>{record.firmware || 'N/A'}</td>}{showNotes ? <td><strong>{record.warrantyNotes || 'No notes'}</strong><small>{record.assignmentSource}</small></td> : null}</tr>)}</tbody></table></div>;
}

function ChartRows({ rows }: { rows: Record<string, number> }) {
  const entries = Object.entries(rows).slice(0, 10);
  const max = Math.max(1, ...entries.map(([, value]) => value));
  if (entries.length === 0) return <p className="tech-empty">No camera model counts available for the current scope.</p>;
  return <div className="tech-chart-rows">{entries.map(([label, value]) => <div className="tech-chart-row" key={label}><div><span>{label}</span><strong>{formatNumber(value)}</strong></div><div className="tech-chart-track"><span style={{ width: `${Math.max(4, (value / max) * 100)}%` }} /></div></div>)}</div>;
}

function Metric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return <div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div>;
}

function CardHeading({ eyebrow, title, pill, tone = 'stable' }: { eyebrow: string; title: string; pill?: string; tone?: StatusTone }) {
  return <div className="tech-card-heading"><div><p className="tech-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{pill ? <StatusPill label={pill} tone={tone} /> : null}</div>;
}

function StatusPill({ label, tone }: { label: StatusTone | string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}

function StatePanel({ title, message, danger = false }: { title: string; message: string; danger?: boolean }) {
  return <section className="tech-card tech-state"><CardHeading eyebrow="Dataset state" title={title} pill={danger ? 'ERROR' : 'LOADING'} tone={danger ? 'critical' : 'stable'} /><p className={danger ? 'danger' : undefined}>{message}</p></section>;
}

function scopeWarrantyRecords(records: CameraWarrantyRecord[], fireSites: FireAlarmSite[], scope: StoreScopeState): CameraWarrantyRecord[] {
  if (scope.mode === 'all') return records;
  const allowedStores = new Set(
    scope.mode === 'stores'
      ? scope.selectedStoreIds.map(normalizeStoreId)
      : fireSites.filter((site) => scope.selectedRegionNames.includes(site.region)).map((site) => normalizeStoreId(site.id)),
  );
  return records.filter((record) => allowedStores.has(normalizeStoreId(record.storeNumber)) || allowedStores.has(normalizeStoreId(record.facilityId)));
}

function summarizeWarrantyStores(records: CameraWarrantyRecord[]) {
  const byStore = new Map<string, CameraWarrantyRecord[]>();
  records.forEach((record) => byStore.set(record.storeNumber, [...(byStore.get(record.storeNumber) ?? []), record]));
  return Array.from(byStore.entries()).map(([storeNumber, storeRecords]) => {
    const ages = storeRecords.map((record) => record.warrantyAgeYears).filter((age): age is number => age !== null);
    return {
      storeNumber,
      facilityName: storeRecords[0]?.facilityName ?? `Store #${storeNumber}`,
      cameraCount: storeRecords.length,
      warrantyCandidateCount: storeRecords.filter((record) => record.warrantyReplacementCandidate === 'Yes').length,
      missingInstallDateCount: storeRecords.filter((record) => isMissingInstallDate(record)).length,
      oldestCameraAgeYears: ages.length ? Math.max(...ages) : null,
      oldestInstallDate: storeRecords.filter((record) => record.installDate).sort((a, b) => (b.warrantyAgeYears ?? 0) - (a.warrantyAgeYears ?? 0))[0]?.installDate ?? '',
    };
  }).sort((a, b) => b.warrantyCandidateCount - a.warrantyCandidateCount || b.missingInstallDateCount - a.missingInstallDateCount || b.cameraCount - a.cameraCount);
}

function topModelCounts(records: CameraWarrantyRecord[]): Record<string, number> {
  const counts = records.reduce<Record<string, number>>((modelCounts, record) => {
    const model = record.cameraModel || 'Unknown';
    modelCounts[model] = (modelCounts[model] ?? 0) + 1;
    return modelCounts;
  }, {});
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10));
}

function filterWarrantyRecords(records: CameraWarrantyRecord[], search: string, statusFilter: WarrantyStatusFilter): CameraWarrantyRecord[] {
  const term = search.trim().toLowerCase();
  return records.filter((record) => {
    if (statusFilter === 'candidates' && record.warrantyReplacementCandidate !== 'Yes') return false;
    if (statusFilter === 'missing' && !isMissingInstallDate(record)) return false;
    if (statusFilter === 'known' && isMissingInstallDate(record)) return false;
    if (!term) return true;
    return [record.storeNumber, record.facilityId, record.facilityName, record.cameraName, record.cameraModel, record.firmware, record.installDate, record.warrantyReplacementCandidate, record.warrantyNotes, record.assignmentSource].join(' ').toLowerCase().includes(term);
  });
}

function isMissingInstallDate(record: CameraWarrantyRecord): boolean {
  return record.warrantyReplacementCandidate.startsWith('Unknown') || !record.installDate;
}

function normalizeStoreId(value: string): string {
  return value.match(/\d+/)?.[0] ?? value;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatSignedCurrency(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}
