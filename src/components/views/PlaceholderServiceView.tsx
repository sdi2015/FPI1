import { FacilityScopeSelector } from '../FacilityScopeSelector';
import type { FacilityScopeState } from '../../data/fpiScope';
import type { FpiDashboardMetrics, FpiFacility, StatusTone } from '../../data/fpiTypes';

export type PlaceholderServiceViewProps = {
  title: string;
  description: string;
  facilities: FpiFacility[];
  facilityScope: FacilityScopeState;
  dashboardMetrics: FpiDashboardMetrics;
  onScopeChange: (nextScope: FacilityScopeState) => void;
};

export function PlaceholderServiceView({
  title,
  description,
  facilities,
  facilityScope,
  dashboardMetrics,
  onScopeChange,
}: PlaceholderServiceViewProps) {
  return (
    <>
      <header className="dashboard-header service-view-header">
        <div>
          <p className="eyebrow">Service view</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <StatusPill label="BUILDOUT" tone="buildout" />
      </header>
      <FacilityScopeSelector facilities={facilities} scope={facilityScope} metrics={dashboardMetrics} onScopeChange={onScopeChange} />
      <section className="panel placeholder-service-panel" aria-labelledby="placeholder-service-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Future service workspace</p>
            <h2 id="placeholder-service-title">Service-specific operational view will be implemented in a future build.</h2>
          </div>
        </div>
        <p>
          The current facility scope is preserved, and this page is ready for service-specific KPIs, exception lists,
          work queues, partner intelligence, and operational evidence in a later build.
        </p>
      </section>
    </>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
