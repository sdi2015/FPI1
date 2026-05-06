import { useEffect, useMemo, useState } from 'react';
import type { EprFacility } from '../data/eprTypes';

// ---- Types -----------------------------------------------------------------
type Channel = 'email' | 'teams' | 'sms';
type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read';
type Phase = 'compose' | 'sending' | 'sent';

type Recipient = {
  id: string;
  name: string;
  role: string;
  scope: string;          // "Stop 03 — Bentonville", "Market 12", "Trip-wide"
  email: string;
  channels: Record<Channel, boolean>;
  status: Record<Channel, DeliveryStatus>;
};

type Attachment = {
  id: string;
  label: string;
  size: string;
  format: string;
  enabled: boolean;
};

type Props = {
  route: EprFacility[];
  onClose: () => void;
};

// ---- Pure mock helpers (seeded for stability across renders) --------------
const FIRST_NAMES = [
  'Avery', 'Jordan', 'Priya', 'Marcus', 'Lena', 'Diego', 'Yuki', 'Sasha',
  'Chris', 'Devon', 'Imani', 'Theo', 'Reese', 'Nadia', 'Mateo', 'Hannah',
  'Wyatt', 'Camila', 'Luca', 'Simone', 'Owen', 'Aaliyah', 'Nikhil', 'Riley',
];
const LAST_NAMES = [
  'Chen', 'Patel', 'Garcia', 'Okafor', 'Nguyen', 'Brooks', 'Romero', 'Singh',
  'Hayes', 'Park', 'Reyes', 'Cohen', 'Webb', 'Tanaka', 'Diallo', 'Foster',
  'Vargas', 'Kowalski', 'Mensah', 'Bauer', 'Iqbal', 'Whitfield', 'Espinoza',
];

const seededRandom = (seed: number) => {
  let s = (seed * 9301 + 49297) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
};

const pickName = (seed: number): string => {
  const rng = seededRandom(seed);
  const f = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const l = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return `${f} ${l}`;
};

const mockEmail = (name: string): string => {
  const slug = name.toLowerCase().replace(/[^a-z]+/g, '.');
  return `${slug}@walmart.com`;
};

// ---- Recipient roster builder ---------------------------------------------
// One Site Lead + one Store Manager per stop; one AP Director per unique market;
// one Regional EP Coordinator per unique region; plus a fixed trip owner & EP on-call.
const buildRoster = (route: EprFacility[]): Recipient[] => {
  const recipients: Recipient[] = [];
  const defaultChannels: Record<Channel, boolean> = { email: true, teams: true, sms: false };
  const defaultStatus: Record<Channel, DeliveryStatus> = { email: 'pending', teams: 'pending', sms: 'pending' };

  // Always-on
  recipients.push({
    id: 'trip-owner',
    name: 'Jason Wilbur',
    role: 'Trip Owner — FPI Program',
    scope: 'Trip-wide',
    email: 'jason.wilbur@walmart.com',
    channels: { ...defaultChannels },
    status: { ...defaultStatus },
  });
  recipients.push({
    id: 'ep-oncall',
    name: 'EP On-Call Desk',
    role: 'Executive Protection — On-Call',
    scope: 'Trip-wide',
    email: 'ep.oncall@walmart.com',
    channels: { email: true, teams: true, sms: true },
    status: { ...defaultStatus },
  });

  // Per-region (deduped)
  const seenRegions = new Set<string>();
  route.forEach((f) => {
    if (seenRegions.has(f.region)) return;
    seenRegions.add(f.region);
    const name = pickName(f.facility_id * 13 + 7);
    recipients.push({
      id: `region-${f.region}`,
      name,
      role: `Regional EP Coordinator — ${f.region}`,
      scope: f.region,
      email: mockEmail(name),
      channels: { ...defaultChannels },
      status: { ...defaultStatus },
    });
  });

  // Per-market (deduped)
  const seenMarkets = new Set<string>();
  route.forEach((f) => {
    if (seenMarkets.has(f.market)) return;
    seenMarkets.add(f.market);
    const name = pickName(f.facility_id * 17 + 3);
    recipients.push({
      id: `market-${f.market}`,
      name,
      role: `AP Director — ${f.market}`,
      scope: f.market,
      email: mockEmail(name),
      channels: { ...defaultChannels },
      status: { ...defaultStatus },
    });
  });

  // Per-stop: site lead + store manager
  route.forEach((f, i) => {
    const stopLabel = `Stop ${String(i + 1).padStart(2, '0')} — ${f.facility_name}`;
    const leadName = pickName(f.facility_id * 23 + 1);
    const mgrName = pickName(f.facility_id * 29 + 5);
    recipients.push({
      id: `lead-${f.facility_id}`,
      name: leadName,
      role: 'Site Security Lead',
      scope: stopLabel,
      email: mockEmail(leadName),
      channels: { ...defaultChannels },
      status: { ...defaultStatus },
    });
    recipients.push({
      id: `mgr-${f.facility_id}`,
      name: mgrName,
      role: 'Store Manager',
      scope: stopLabel,
      email: mockEmail(mgrName),
      channels: { email: true, teams: false, sms: true },
      status: { ...defaultStatus },
    });
  });

  return recipients;
};

// ---- Default attachments --------------------------------------------------
const DEFAULT_ATTACHMENTS: Attachment[] = [
  { id: 'brief',   label: 'Visit Brief.pdf',          size: '184 KB',  format: 'PDF', enabled: true  },
  { id: 'csv',     label: 'Route Stops.csv',          size: '6.2 KB',  format: 'CSV', enabled: true  },
  { id: 'ics',     label: 'Calendar Invites.ics',     size: '4.1 KB',  format: 'ICS', enabled: true  },
  { id: 'gpx',     label: 'GPS Route.gpx',            size: '8.7 KB',  format: 'GPX', enabled: false },
  { id: 'roster',  label: 'Recipient Roster.csv',     size: '1.5 KB',  format: 'CSV', enabled: false },
];

// ---- Merge-tag template renderer ------------------------------------------
const renderTemplate = (tpl: string, ctx: Record<string, string>): string =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] ?? `{{${key}}}`);

// ---- Channel icon (just a label, kept zero-deps) --------------------------
const ChannelLabel = ({ channel }: { channel: Channel }) => {
  const text = channel === 'email' ? '✉ Email' : channel === 'teams' ? '◰ Teams' : '✆ SMS';
  return <span className={`hm-channel hm-channel--${channel}`}>{text}</span>;
};

// ---- Status pip (✓ / ✓✓ / ✓✓-blue) ----------------------------------------
const StatusPip = ({ status }: { status: DeliveryStatus }) => {
  if (status === 'pending') return <span className="hm-pip hm-pip--pending" title="Pending">…</span>;
  if (status === 'sent')    return <span className="hm-pip hm-pip--sent" title="Sent">✓</span>;
  if (status === 'delivered') return <span className="hm-pip hm-pip--delivered" title="Delivered">✓✓</span>;
  return <span className="hm-pip hm-pip--read" title="Read">✓✓</span>;
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function HandoffModal({ route, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('compose');
  const [recipients, setRecipients] = useState<Recipient[]>(buildRoster(route));
  const [attachments, setAttachments] = useState<Attachment[]>(DEFAULT_ATTACHMENTS);
  const handoffId = useMemo(
    () => `HANDOFF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
    [],
  );

  // Merge-tag context derived from the route.
  const ctx = useMemo(() => {
    const stopCount = route.length;
    const markets = Array.from(new Set(route.map((f) => f.market))).slice(0, 3).join(', ');
    const regions = Array.from(new Set(route.map((f) => f.region))).join(', ');
    const start = new Date(); start.setDate(start.getDate() + 1);
    const end = new Date(start); end.setDate(end.getDate() + Math.max(0, Math.ceil(stopCount / 4)));
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return {
      stop_count: String(stopCount),
      market_list: markets || '—',
      region_list: regions || '—',
      date_window: stopCount > 0 ? `${fmt(start)} – ${fmt(end)}` : '—',
      trip_owner: 'Jason Wilbur',
      first_stop: route[0]?.facility_name ?? '—',
      last_stop: route[route.length - 1]?.facility_name ?? '—',
    };
  }, [route]);

  const DEFAULT_MESSAGE =
`Team,

The Region {{region_list}} executive visit handoff is going out for the upcoming tour ({{stop_count}} stops, {{date_window}}, markets: {{market_list}}). The optimised route, draft brief, and calendar invites are attached. Please confirm receipt and flag any blockers within 24 hours.

Trip owner: {{trip_owner}}
First stop: {{first_stop}}
Last stop: {{last_stop}}

Thanks,
FPI Operations`;

  const [messageTpl, setMessageTpl] = useState(DEFAULT_MESSAGE);
  const renderedMessage = useMemo(() => renderTemplate(messageTpl, ctx), [messageTpl, ctx]);

  // ---- Toggles --------------------------------------------------------------
  const toggleChannel = (recipientId: string, channel: Channel) => {
    setRecipients((prev) => prev.map((r) =>
      r.id === recipientId ? { ...r, channels: { ...r.channels, [channel]: !r.channels[channel] } } : r,
    ));
  };
  const toggleAttachment = (attId: string) => {
    setAttachments((prev) => prev.map((a) => a.id === attId ? { ...a, enabled: !a.enabled } : a));
  };

  // ---- Send animation: walk each recipient's enabled channels through
  //      pending → sent → delivered → read with staggered delays so the
  //      operator visually sees the handoff propagate.
  useEffect(() => {
    if (phase !== 'sending') return;
    const timers: number[] = [];
    let baseDelay = 200;
    const STEP_GAP = 120;

    recipients.forEach((r) => {
      (Object.keys(r.channels) as Channel[]).forEach((ch) => {
        if (!r.channels[ch]) return;
        const sentAt = baseDelay;
        const deliveredAt = baseDelay + 600 + Math.floor(Math.random() * 400);
        const readAt = deliveredAt + 800 + Math.floor(Math.random() * 1200);
        timers.push(window.setTimeout(() => bumpStatus(r.id, ch, 'sent'), sentAt));
        timers.push(window.setTimeout(() => bumpStatus(r.id, ch, 'delivered'), deliveredAt));
        // Mock: 80% of recipients "read" the handoff in the demo window.
        if (Math.random() < 0.8) {
          timers.push(window.setTimeout(() => bumpStatus(r.id, ch, 'read'), readAt));
        }
        baseDelay += STEP_GAP;
      });
    });

    // Flip phase to 'sent' once the slowest send is done.
    timers.push(window.setTimeout(() => setPhase('sent'), baseDelay + 1500));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const bumpStatus = (recipientId: string, channel: Channel, status: DeliveryStatus) => {
    setRecipients((prev) => prev.map((r) =>
      r.id === recipientId ? { ...r, status: { ...r.status, [channel]: status } } : r,
    ));
  };

  const totalSelectedChannels = recipients.reduce(
    (sum, r) => sum + (Object.values(r.channels).filter(Boolean).length),
    0,
  );
  const enabledAttachments = attachments.filter((a) => a.enabled);

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="hm-title">
      <div className="vb-modal-card hm-card">
        <header className="vb-header">
          <div>
            <p className="eyebrow">Send Handoff (mock)</p>
            <h2 id="hm-title">Notify the receiving teams for this visit</h2>
            <p className="vb-help">
              Mock workflow only — no real email, Teams message, or SMS is dispatched. In production this would route via
              MS Graph, Teams Webhook, and Twilio.
            </p>
          </div>
          <button type="button" className="epr-action-button secondary" onClick={onClose} aria-label="Close handoff">✕</button>
        </header>

        <div className="hm-body">
          {/* === PHASE: COMPOSE ============================================== */}
          {phase === 'compose' && (
            <>
              <section className="hm-section">
                <h3>Handoff message</h3>
                <p className="hm-help">
                  Edit the template below. Tokens like <code>&#123;&#123;stop_count&#125;&#125;</code> are auto-filled from the route.
                </p>
                <textarea
                  className="hm-textarea"
                  value={messageTpl}
                  onChange={(e) => setMessageTpl(e.target.value)}
                  rows={10}
                  spellCheck
                />
                <details className="hm-preview">
                  <summary>Preview rendered message</summary>
                  <pre>{renderedMessage}</pre>
                </details>
              </section>

              <section className="hm-section">
                <h3>Attachments ({enabledAttachments.length} of {attachments.length})</h3>
                <div className="hm-attachments">
                  {attachments.map((a) => (
                    <label key={a.id} className={`hm-attachment ${a.enabled ? 'hm-attachment--on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={a.enabled}
                        onChange={() => toggleAttachment(a.id)}
                      />
                      <span className="hm-attachment-format">{a.format}</span>
                      <span className="hm-attachment-label">{a.label}</span>
                      <span className="hm-attachment-size">{a.size}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="hm-section">
                <h3>Recipients ({recipients.length}) · {totalSelectedChannels} channels selected</h3>
                <table className="hm-recipients">
                  <thead>
                    <tr>
                      <th>Recipient</th><th>Role</th><th>Scope</th><th>Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.name}</strong>
                          <small>{r.email}</small>
                        </td>
                        <td>{r.role}</td>
                        <td><span className="hm-scope">{r.scope}</span></td>
                        <td>
                          {(['email', 'teams', 'sms'] as Channel[]).map((ch) => (
                            <label key={ch} className={`hm-channel-toggle ${r.channels[ch] ? 'on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={r.channels[ch]}
                                onChange={() => toggleChannel(r.id, ch)}
                              />
                              <ChannelLabel channel={ch} />
                            </label>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {/* === PHASE: SENDING / SENT ====================================== */}
          {phase !== 'compose' && (
            <section className="hm-section">
              <div className="hm-confirm-head">
                <div>
                  <h3>{phase === 'sending' ? 'Dispatching handoff…' : 'Handoff dispatched ✓'}</h3>
                  <p className="hm-help">
                    Tracking ID <code>{handoffId}</code> · {totalSelectedChannels} channel deliveries
                  </p>
                </div>
                {phase === 'sending' && <span className="hm-spinner" aria-hidden="true" />}
              </div>
              <table className="hm-delivery">
                <thead>
                  <tr><th>Recipient</th><th>Email</th><th>Teams</th><th>SMS</th></tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <small>{r.role}</small>
                      </td>
                      {(['email', 'teams', 'sms'] as Channel[]).map((ch) => (
                        <td key={ch} className="hm-delivery-cell">
                          {r.channels[ch] ? <StatusPip status={r.status[ch]} /> : <span className="hm-skip">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {phase === 'sent' && (
                <div className="hm-sent-banner">
                  ✓ All channels dispatched. In production, recipients would acknowledge via the
                  EP Handoff portal or by replying to the channel they prefer. Acknowledgement
                  SLA: 24 hours.
                </div>
              )}
            </section>
          )}
        </div>

        <footer className="vb-actions hm-actions">
          {phase === 'compose' && (
            <>
              <button type="button" className="epr-action-button secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="epr-action-button"
                disabled={totalSelectedChannels === 0}
                onClick={() => setPhase('sending')}
              >
                Send Handoff (mock) →
              </button>
            </>
          )}
          {phase === 'sending' && (
            <button type="button" className="epr-action-button secondary" disabled>Dispatching…</button>
          )}
          {phase === 'sent' && (
            <>
              <button type="button" className="epr-action-button secondary" onClick={() => setPhase('compose')}>
                ← Back to edit
              </button>
              <button type="button" className="epr-action-button" onClick={onClose}>Close</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
