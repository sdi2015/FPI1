/**
 * RetentionView — per-store CCTV evidence retention posture
 * Policy: 30d general | 90d Rx/pharmacy | 180d gun/firearms
 * Retention days are mock data; color-coded green/yellow/red per zone.
 */
import { useMemo, useState } from 'react';
import type { HealthThresholdTone } from '../../data/technologyHealthSelectors';
import { formatNumber, sortStoresByTechnicalRisk } from '../../data/technologyHealthSelectors';
import type { TechnologyHealthData, StoreCameraHealth } from '../../data/technologyHealthTypes';

// ── Types ──────────────────────────────────────────────────────────────────────
interface StoreRet {
  store: StoreCameraHealth;
  general: number;        // days — always present
  rx: number | null;      // null = no pharmacy at this store
  gun: number | null;     // null = no gun case at this store
}

// ── Policy definitions ─────────────────────────────────────────────────────────
const POLICIES = [
  { key: 'general' as const, label: 'General',        required: 30,  warn: 5,  desc: 'All cameras · AP-14 baseline',              color: '#0053e2', accent: '#dbeafe' },
  { key: 'rx'      as const, label: 'Pharmacy (Rx)',  required: 90,  warn: 0,  desc: 'Pharmacy area cameras · regulatory req.',     color: '#7c3aed', accent: '#ede9fe' },
  { key: 'gun'     as const, label: 'Firearms / Gun', required: 180, warn: 0,  desc: 'Firearms dept. cameras · compliance req.',   color: '#d97706', accent: '#fef3c7' },
];

// ── Tone helpers ───────────────────────────────────────────────────────────────
function retTone(days: number | null, required: number, warn: number): HealthThresholdTone {
  if (days === null) return 'green';
  if (days >= required) return 'green';
  if (days >= required - warn) return 'yellow';
  return 'red';
}
const TONE_BG:    Record<HealthThresholdTone, string> = { green: '#dcfce7', yellow: '#fef9c3', red: '#fee2e2' };
const TONE_FG:    Record<HealthThresholdTone, string> = { green: '#15803d', yellow: '#92400e', red: '#991b1b' };
const TONE_LABEL: Record<HealthThresholdTone, string> = { green: 'Compliant', yellow: 'Warning', red: 'Non-Compliant' };

function worstTone(...tones: HealthThresholdTone[]): HealthThresholdTone {
  if (tones.includes('red')) return 'red';
  if (tones.includes('yellow')) return 'yellow';
  return 'green';
}

// ── Mock data ──────────────────────────────────────────────────────────────────
function mockRow(store: StoreCameraHealth, i: number): StoreRet {
  const s = ((i + 1) * 37 + store.siteAlias.length * 13) % 100;
  const ft = (store.facilityType ?? '').toLowerCase();
  const isNM = ft.includes('neighborhood') || ft.includes('express');
  const hasRx  = !isNM || s % 6 > 1;           // NMs sometimes lack pharmacy
  const hasGun = !isNM && s % 11 > 2;           // NMs never have gun cases
  return {
    store,
    general: 26 + (s % 12),                     // 26–37d  (some below 30d threshold)
    rx:  hasRx  ? 80 + (s % 24) : null,         // 80–103d (some below 90d threshold)
    gun: hasGun ? 162 + (s % 32) : null,         // 162–193d (some below 180d threshold)
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DaysBadge({ days, required, warn }: { days: number | null; required: number; warn: number }) {
  if (days === null) return <span className="ret-na">—</span>;
  const t = retTone(days, required, warn);
  return <span className="ret-badge" style={{ background: TONE_BG[t], color: TONE_FG[t] }}>{days}d</span>;
}

function PolicyCard({ label, required, warn, desc, color, accent, values }: {
  label: string; required: number; warn: number; desc: string;
  color: string; accent: string; values: (number | null)[];
}) {
  const applicable = values.filter((v): v is number => v !== null);
  const green  = applicable.filter(v => v >= required).length;
  const yellow = applicable.filter(v => v >= required - warn && v < required).length;
  const red    = applicable.filter(v => v < required - warn).length;
  const total  = applicable.length;
  const pct    = total > 0 ? Math.round((green / total) * 100) : 100;
  return (
    <article className="ret-policy-card">
      {/* ── Colored header ── */}
      <div className="ret-policy-head" style={{ background: color }}>
        <div className="ret-policy-title-row">
          <strong className="ret-policy-label">{label}</strong>
          <span className="ret-policy-req-pill">{required}d required</span>
        </div>
        <p className="ret-policy-desc">{desc}</p>
        <div className="ret-policy-bar-wrap">
          <div className="ret-policy-bar"><span style={{ width: `${pct}%`, background: 'rgba(255,255,255,0.95)' }} /></div>
          <span className="ret-policy-pct">{pct}%</span>
        </div>
      </div>
      {/* ── Count chips body ── */}
      <div className="ret-policy-body">
        <span className="ret-count-chip" style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac' }}>✓ {green} compliant</span>
        {yellow > 0 && <span className="ret-count-chip" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}>⚠ {yellow} warning</span>}
        {red    > 0 && <span className="ret-count-chip" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>✕ {red} non-compliant</span>}
        {total  === 0 && <span className="ret-na">No applicable stores in scope</span>}
        <span className="ret-policy-total">{total} stores</span>
      </div>
    </article>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export function RetentionView({ data }: { data: TechnologyHealthData }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'alias' | 'general' | 'rx' | 'gun' | 'status'>('status');

  const rows = useMemo(() =>
    sortStoresByTechnicalRisk(data.storeHealth).map(mockRow),
  [data.storeHealth]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => !q || r.store.siteAlias.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortKey === 'alias')   return a.store.siteAlias.localeCompare(b.store.siteAlias);
    if (sortKey === 'general') return a.general - b.general;
    if (sortKey === 'rx')      return (a.rx ?? 999) - (b.rx ?? 999);
    if (sortKey === 'gun')     return (a.gun ?? 999) - (b.gun ?? 999);
    // status: worst first
    const tA = worstTone(retTone(a.general, 30, 5), retTone(a.rx, 90, 0), retTone(a.gun, 180, 0));
    const tB = worstTone(retTone(b.general, 30, 5), retTone(b.rx, 90, 0), retTone(b.gun, 180, 0));
    const rank = { red: 0, yellow: 1, green: 2 };
    return rank[tA] - rank[tB];
  }), [filtered, sortKey]);

  const Th = ({ col, label }: { col: typeof sortKey; label: string }) => (
    <th onClick={() => setSortKey(col)} className={`ret-th${sortKey === col ? ' active' : ''}`}>{label}{sortKey === col ? ' ↑' : ''}</th>
  );

  // Summary counts across all rows
  const generalBelow = rows.filter(r => retTone(r.general, 30, 5) !== 'green').length;
  const rxBelow      = rows.filter(r => r.rx  !== null && retTone(r.rx,  90,  0) !== 'green').length;
  const gunBelow     = rows.filter(r => r.gun !== null && retTone(r.gun, 180, 0) !== 'green').length;
  const totalStores  = rows.length;

  return (
    <section className="tech-grid ret-grid">
      {/* Policy summary banner */}
      <section className="tech-card wide ret-banner">
        <div className="ret-banner-heading">
          <div><p className="tech-eyebrow">Evidence Readiness · AP-14 Aligned</p><h2>Recording Retention Policy Compliance</h2></div>
          <div className="ret-banner-kpis">
            <span className="ret-kpi"><strong>{totalStores}</strong><small>Stores monitored</small></span>
            <span className="ret-kpi" style={{ color: generalBelow > 0 ? '#dc2626' : '#16a34a' }}><strong>{generalBelow}</strong><small>General gaps</small></span>
            <span className="ret-kpi" style={{ color: rxBelow > 0 ? '#dc2626' : '#16a34a' }}><strong>{rxBelow}</strong><small>Rx gaps</small></span>
            <span className="ret-kpi" style={{ color: gunBelow > 0 ? '#dc2626' : '#16a34a' }}><strong>{gunBelow}</strong><small>Firearm gaps</small></span>
          </div>
        </div>
        <div className="ret-policy-cards">
          {POLICIES.map(p => (
            <PolicyCard key={p.key} label={p.label} required={p.required} warn={p.warn} desc={p.desc} color={p.color} accent={p.accent}
              values={rows.map(r => r[p.key as 'general' | 'rx' | 'gun'])} />
          ))}
        </div>
      </section>

      {/* Per-store table */}
      <section className="tech-card wide">
        <div className="ret-table-header">
          <div><p className="tech-eyebrow">Store-level · Mock data · AP-14</p><h2>Retention Days by Zone</h2></div>
          <input className="tech-modal-search ret-search" placeholder="Search store…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="tech-table-wrap">
          <table className="tech-table ret-table">
            <thead>
              <tr>
                <Th col="alias" label="Store" />
                <th>Type</th>
                <Th col="general" label="General (≥30d)" />
                <Th col="rx" label="Pharmacy (≥90d)" />
                <Th col="gun" label="Firearms (≥180d)" />
                <Th col="status" label="Overall" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const gt = retTone(r.general, 30, 5);
                const rt = retTone(r.rx, 90, 0);
                const ft = retTone(r.gun, 180, 0);
                const ov = worstTone(gt, rt, ft);
                return (
                  <tr key={r.store.siteAlias}>
                    <td><strong>{r.store.siteAlias}</strong></td>
                    <td><small>{r.store.facilityType ?? 'Supercenter'}</small></td>
                    <td><DaysBadge days={r.general} required={30}  warn={5}  /></td>
                    <td><DaysBadge days={r.rx}      required={90}  warn={0} /></td>
                    <td><DaysBadge days={r.gun}     required={180} warn={0} /></td>
                    <td><span className="ret-badge" style={{ background: TONE_BG[ov], color: TONE_FG[ov] }}>{TONE_LABEL[ov]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length === 0 && <p className="ret-empty">No stores match your search.</p>}
        </div>
        <p className="ret-footer-note">⚠ Retention days are mock data for Region 75. Source: Intellicene VMS snapshot · {formatNumber(rows.length)} stores · MOCK</p>
      </section>
    </section>
  );
}
