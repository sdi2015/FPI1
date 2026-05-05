import { LockedScopeSummary } from '../LockedScopeSummary';
import type { FpiFacility, StatusTone } from '../../data/fpiTypes';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import { getScopedStoreIds, type StoreScopeState } from '../../data/storeScope';

export type PlaceholderServiceViewProps = {
  title: string;
  description: string;
  facilities: FpiFacility[];
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

export function PlaceholderServiceView({
  title,
  description,
  facilities,
  fireSites,
  storeScope,
  onChangeScopeRequest,
}: PlaceholderServiceViewProps) {
  const scopedStoreCount = getScopedStoreIds(fireSites, storeScope).length;
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
      <LockedScopeSummary sites={fireSites} scope={storeScope} onChangeScope={onChangeScopeRequest} />
      <section className="panel placeholder-service-panel" aria-labelledby="placeholder-service-title">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Future service workspace</p>
            <h2 id="placeholder-service-title">Service-specific operational view will be implemented in a future build.</h2>
          </div>
        </div>
        <p>
          The locked store/region scope is preserved from Settings, and this page is ready for service-specific KPIs, exception lists,
          work queues, partner intelligence, and operational evidence in a later build.
        </p>
        <div className="service-meta-grid service-live-metrics">
          <div><span>Scoped FPI facilities</span><strong>{facilities.length}</strong><small>Projected from the current Settings selection.</small></div>
          <div><span>Scoped fire-system stores</span><strong>{scopedStoreCount}</strong><small>Directly selected by store or region.</small></div>
          <div><span>Scope mode</span><strong>{storeScope.mode}</strong><small>All, region-locked, or store-locked.</small></div>
        </div>
      </section>
    </>
  );
}

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return <span className={`status-pill status-${tone}`}>{label}</span>;
}
