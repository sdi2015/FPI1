// Security Mitigation Manager — top-level module.
// Reuses the MitigationTab built inside the EPR workspace so we have a single source of truth
// for plan-building, KPI math, and the install-request email output. Just adds its own data
// loading + page chrome so it can live in the left-nav modules list.
import { useMemo } from 'react';
import type { FpiFacility } from '../../data/fpiTypes';
import type { FireAlarmSite } from '../../data/fireAlarmTypes';
import type { StoreScopeState } from '../../data/storeScope';
import { applyEprScope } from '../../data/eprScope';
import { useEprData } from '../../data/useEprData';
import { MitigationTab } from './ExecutiveProtectionReadinessView';

export type SecurityMitigationManagerViewProps = {
  facilities: FpiFacility[];
  fireSites: FireAlarmSite[];
  storeScope: StoreScopeState;
  onChangeScopeRequest: () => void;
};

export function SecurityMitigationManagerView({ fireSites, storeScope }: SecurityMitigationManagerViewProps) {
  const eprState = useEprData();
  const eprData = useMemo(
    () => (eprState.data ? applyEprScope(eprState.data, fireSites, storeScope) : null),
    [eprState.data, fireSites, storeScope],
  );

  // Status string mirrors the EPR header so users feel oriented.
  const statusLabel = eprState.loading ? 'LOADING' : eprState.error ? 'DATA ISSUE' : 'DATA LOADED';
  const statusToneClass = eprState.error ? 'critical' : eprState.loading ? 'buildout' : 'ready';

  return (
    <section className="epr-page" aria-label="Security Mitigation Manager workspace">
      <header className="dashboard-header service-view-header epr-header">
        <div>
          <p className="eyebrow">Security mitigation</p>
          <h1>Security Mitigation Manager</h1>
          <p>
            Score recommended security controls for a specific store, build a deployment plan with live ROI math,
            and generate an install-request email to the AP coach, regional AP manager, and FPP manager. No purchase,
            vendor contact, or production workflow is triggered &mdash; this is a draft request workspace.
          </p>
        </div>
        <span className={`status-pill ${statusToneClass}`} role="status">{statusLabel}</span>
      </header>

      {eprState.loading ? (
        <section className="panel dashboard-state-panel" role="status">
          <div className="card-heading">
            <div><p className="eyebrow">Mitigation data</p><h2>Loading EPR data package</h2></div>
          </div>
          <p>Preparing the security solutions catalog and store-level incident impact figures.</p>
        </section>
      ) : null}

      {eprState.error ? (
        <section className="panel dashboard-state-panel" role="alert">
          <div className="card-heading">
            <div><p className="eyebrow">Mitigation data</p><h2>Data unavailable</h2></div>
          </div>
          <p>{eprState.error}</p>
        </section>
      ) : null}

      {eprData ? (
        <MitigationTab
          data={eprData}
          allStores={eprState.data?.field_operations.facilities ?? eprData.field_operations.facilities}
        />
      ) : null}
    </section>
  );
}
