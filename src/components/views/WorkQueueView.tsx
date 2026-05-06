/**
 * WorkQueueView — CCTV service work queue with simulated ticket dispatch
 * NO WRITEBACK — all actions are simulated; no external system is called.
 */
import { useState, useCallback } from 'react';
import type { CameraWorkQueueItem, TechnologyHealthData } from '../../data/technologyHealthTypes';

// ── Types ──────────────────────────────────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'done';
type DispatchStep = { label: string; detail: string; status: StepStatus };
type TicketDraft = { item: CameraWorkQueueItem; steps: DispatchStep[]; ticketId: string; done: boolean };

// ── Helpers ────────────────────────────────────────────────────────────────────
function storeNumFromAlias(alias: string): string {
  const n = parseInt(alias.replace(/\D/g, ''), 10);
  return String(10000 + (n * 137) % 5000).padStart(5, '0');
}

function buildSteps(item: CameraWorkQueueItem): DispatchStep[] {
  const s = storeNumFromAlias(item.siteAlias);
  const ch = item.channel === 'ServiceChannel' ? 'ServiceChannel' : 'Me@Walmart';
  return [
    { label: `Create ticket in ${ch}`, detail: item.title.slice(0, 72), status: 'pending' },
    { label: 'Notify CCTV trade technician', detail: `cctv-tech.S${s}@walmart.com · ${item.assignmentGroup}`, status: 'pending' },
    { label: 'Notify store manager', detail: `sm.S${s}@walmart.com · Store ${s}`, status: 'pending' },
    { label: 'Notify AP manager', detail: `apm.S${s}@walmart.com · Asset Protection`, status: 'pending' },
    { label: 'Notify market manager', detail: `mm.r75@walmart.com · Region 75 Market Team`, status: 'pending' },
  ];
}

function mockTicketId(item: CameraWorkQueueItem): string {
  const n = (parseInt(item.id.replace(/\D/g, ''), 10) * 7_919 + 42_001) % 9_999_999;
  return `WO-${String(n).padStart(7, '0')}`;
}

// ── Step row ───────────────────────────────────────────────────────────────────
function StepRow({ step }: { step: DispatchStep }) {
  const icon  = step.status === 'done' ? '✓' : step.status === 'running' ? '⋯' : '○';
  const color = step.status === 'done' ? '#15803d' : step.status === 'running' ? '#0053e2' : '#cbd5e1';
  return (
    <div className="wq-step-row">
      <span className="wq-step-icon" style={{ color }}>{icon}</span>
      <div>
        <b className="wq-step-label" style={{ color: step.status === 'pending' ? '#94a3b8' : undefined }}>{step.label}</b>
        <small className="wq-step-detail">{step.detail}</small>
      </div>
    </div>
  );
}

// ── Severity pill ─────────────────────────────────────────────────────────────
function SevPill({ sev }: { sev: string }) {
  const s = sev === 'Critical' ? { bg: '#fee2e2', fg: '#991b1b' } : sev === 'High' ? { bg: '#fef3c7', fg: '#92400e' } : { bg: '#dcfce7', fg: '#15803d' };
  return <span className="wq-sev-pill" style={{ background: s.bg, color: s.fg }}>{sev}</span>;
}

// ── Ticket dispatch modal ──────────────────────────────────────────────────────
function TicketModal({ draft, onClose }: { draft: TicketDraft; onClose: () => void }) {
  return (
    <div className="tech-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="tech-modal wq-modal" role="dialog" aria-modal aria-labelledby="wq-modal-title" onMouseDown={e => e.stopPropagation()}>
        <header className="tech-modal-header">
          <div>
            <p className="tech-eyebrow">Ticket Simulation · NO WRITEBACK</p>
            <h2 id="wq-modal-title">{draft.ticketId}</h2>
            <small className="wq-modal-meta">{draft.item.siteAlias} · {draft.item.severity} severity · {draft.item.channel}</small>
          </div>
          <button type="button" className="wq-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </header>
        <div className="tech-modal-body wq-modal-body">
          <div className="wq-detail-grid">
            <div><span>Finding</span><strong>{draft.item.title}</strong></div>
            <div><span>Assignment group</span><strong>{draft.item.assignmentGroup}</strong></div>
            <div><span>SLA target</span><strong>{draft.item.sla}</strong></div>
            <div><span>Evidence required</span><strong>{draft.item.evidenceRequired ? 'Yes' : 'No'}</strong></div>
          </div>
          <div className="wq-disclaimer">
            ⚠ This is a simulation only. No ticket has been created and no email has been sent to any external system.
          </div>
          <h3 className="wq-steps-title">Dispatch simulation</h3>
          <div className="wq-steps">{draft.steps.map((s, i) => <StepRow key={i} step={s} />)}</div>
          {draft.done && (
            <div className="wq-done-banner">
              ✓ Simulation complete — <strong>{draft.ticketId}</strong> would be dispatched via {draft.item.channel} with notifications sent to 4 contacts.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function WorkQueueView({ data }: { data: TechnologyHealthData }) {
  const [draft, setDraft] = useState<TicketDraft | null>(null);

  const fire = useCallback((item: CameraWorkQueueItem) => {
    const steps = buildSteps(item);
    setDraft({ item, steps, ticketId: mockTicketId(item), done: false });
    steps.forEach((_, i) => {
      setTimeout(() => setDraft(p => p && { ...p, steps: p.steps.map((s, j) => j === i ? { ...s, status: 'running' as StepStatus } : s) }), i * 750);
      setTimeout(() => setDraft(p => p && { ...p, steps: p.steps.map((s, j) => j === i ? { ...s, status: 'done' as StepStatus } : s), done: i === steps.length - 1 }), i * 750 + 580);
    });
  }, []);

  return (
    <>
      <section className="tech-card">
        <div className="wq-heading-row">
          <div>
            <p className="tech-eyebrow">Ticket simulation</p>
            <h2 className="wq-title">Grouped CCTV service work queue</h2>
          </div>
          <span className="wq-no-writeback-pill">NO WRITEBACK</span>
        </div>
        <p className="wq-subtext">Select <strong>Create Ticket</strong> on any row to simulate ServiceChannel / Me@Walmart dispatch and stakeholder email notifications. No real ticket is created.</p>
        <div className="tech-table-wrap">
          <table className="tech-table wq-table">
            <thead>
              <tr><th>Site</th><th>Finding</th><th>Severity</th><th>Channel</th><th>Assignment</th><th>SLA</th><th>Action</th></tr>
            </thead>
            <tbody>
              {data.workQueue.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.siteAlias}</strong></td>
                  <td><span className="wq-finding">{item.title}</span><small>{item.status} · Evidence required: {item.evidenceRequired ? 'Yes' : 'No'}</small></td>
                  <td><SevPill sev={item.severity} /></td>
                  <td>{item.channel}</td>
                  <td><small>{item.assignmentGroup}</small></td>
                  <td><span className="wq-sla">{item.sla}</span></td>
                  <td><button type="button" className="wq-create-btn" onClick={() => fire(item)}>+ Create Ticket</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {draft && <TicketModal draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
