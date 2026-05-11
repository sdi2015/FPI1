import { useMemo, useState, type ReactNode } from 'react';
import type { EprFacility, EprHotel, EprIncident, EprTask } from '../data/eprTypes';
import { lookupAirport, listAirports, type Airport } from '../data/airports';
import {
  haversineMiles,
  nearestN,
  nearestNeighborOrder,
  totalRouteMiles,
} from '../data/routeOptimizer';
import { RouteMap } from './RouteMap';
import { HotelIllustration } from './HotelIllustration';

// Renders the hotel's photo when one is supplied, otherwise falls back to
// the deterministic SVG illustration. Keeps the photo/SVG choice out of
// the option-card and brief-section markup.
function HotelPhoto({ hotel }: { hotel: EprHotel }) {
  if (hotel.image_url) {
    return <img src={hotel.image_url} alt={`Photo of ${hotel.name}`} className="vb-hotel-img" loading="lazy" />;
  }
  return <HotelIllustration hotelId={hotel.hotel_id} brand={hotel.brand} name={hotel.name} />;
}

export type VisitBriefWizardProps = {
  facilities: EprFacility[];
  hotels: EprHotel[];
  incidents: EprIncident[];
  tasks: EprTask[];
  onClose: () => void;
};

type Step = 'airport' | 'route' | 'hotel' | 'brief';
type TripPriority = 'standard' | 'elevated' | 'critical';
type HotelChoice = 'airport' | 'lastStop';

// Number of hotel options surfaced once the user picks an anchor. Three
// keeps the choice meaningful without overwhelming the wizard panel.
const HOTEL_OPTION_COUNT = 3;

// The wizard moves linearly through 4 steps: airport entry -> review the
// optimised route -> pick a hotel anchor -> final brief summary. Each step
// renders its own panel; nothing here mutates source data.
export function VisitBriefWizard({ facilities, hotels, incidents, tasks, onClose }: VisitBriefWizardProps) {
  const [step, setStep] = useState<Step>('airport');
  const [airportInput, setAirportInput] = useState('');
  const [airport, setAirport] = useState<Airport | null>(null);
  const [airportError, setAirportError] = useState<string | null>(null);
  const [hotelChoice, setHotelChoice] = useState<HotelChoice | null>(null);
  const [tripTitle, setTripTitle] = useState('Region 75 Field Visit');
  const [travelDates, setTravelDates] = useState('');
  const [travelerCount, setTravelerCount] = useState('2');
  const [tripPriority, setTripPriority] = useState<TripPriority>('elevated');
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);

  // Hotels in the EPR data may be missing coords (legacy entries). Filter
  // to ones that can be measured for distance picking.
  const geocodedHotels = useMemo(
    () => hotels.filter((h): h is EprHotel & { latitude: number; longitude: number } =>
      typeof h.latitude === 'number' && typeof h.longitude === 'number'),
    [hotels],
  );

  // Optimised route (nearest-neighbour from airport) is recomputed only
  // once airport is set; before that, fall back to selection order so
  // step 1 has nothing to draw if airport isn't picked yet.
  const optimisedRoute = useMemo<EprFacility[]>(() => {
    if (!airport) return facilities;
    const withCoords = facilities.filter((f) =>
      typeof f.latitude === 'number' && typeof f.longitude === 'number');
    return nearestNeighborOrder(
      { latitude: airport.latitude, longitude: airport.longitude },
      withCoords as Array<EprFacility & { latitude: number; longitude: number }>,
    );
  }, [airport, facilities]);

  const totalMiles = useMemo(() => {
    if (!airport || optimisedRoute.length === 0) return 0;
    return totalRouteMiles(
      { latitude: airport.latitude, longitude: airport.longitude },
      optimisedRoute as Array<{ latitude: number; longitude: number }>,
    );
  }, [airport, optimisedRoute]);

  const lastStop = optimisedRoute.length > 0 ? optimisedRoute[optimisedRoute.length - 1] : null;

  // Top-N closest hotels to whichever anchor the user picked. The user
  // then explicitly selects one from the cards rather than us forcing a
  // single "recommended" pick on them.
  const hotelOptions = useMemo<Array<{ hotel: EprHotel; miles: number }>>(() => {
    if (!airport || !hotelChoice || geocodedHotels.length === 0) return [];
    const anchor =
      hotelChoice === 'airport'
        ? { latitude: airport.latitude, longitude: airport.longitude }
        : lastStop && typeof lastStop.latitude === 'number' && typeof lastStop.longitude === 'number'
          ? { latitude: lastStop.latitude, longitude: lastStop.longitude }
          : null;
    if (!anchor) return [];
    return nearestN(anchor, geocodedHotels, HOTEL_OPTION_COUNT)
      .map(({ item, miles }) => ({ hotel: item, miles }));
  }, [airport, hotelChoice, geocodedHotels, lastStop]);

  const selectedHotel = useMemo<EprHotel | null>(
    () => hotelOptions.find((opt) => opt.hotel.hotel_id === selectedHotelId)?.hotel ?? null,
    [hotelOptions, selectedHotelId],
  );

  function submitAirport() {
    const found = lookupAirport(airportInput);
    if (!found) {
      setAirportError(
        `Airport code "${airportInput || '—'}" not recognised. Try one of: ${listAirports().slice(0, 6).map((a) => a.iata).join(', ')}…`,
      );
      return;
    }
    setAirportError(null);
    setAirport(found);
    setStep('route');
  }

  return (
    <div className="vb-modal" role="dialog" aria-modal="true" aria-labelledby="vb-title">
      <div className="vb-modal-card">
        <header className="vb-header">
          <div>
            <p className="eyebrow">Visit Brief Wizard</p>
            <h2 id="vb-title">Build a draft executive visit brief</h2>
            <p className="vb-step-trail">
              <StepDot active={step === 'airport'} done={['route', 'hotel', 'brief'].includes(step)}>1. Airport</StepDot>
              <StepDot active={step === 'route'} done={['hotel', 'brief'].includes(step)}>2. Optimised route</StepDot>
              <StepDot active={step === 'hotel'} done={step === 'brief'}>3. Hotel anchor</StepDot>
              <StepDot active={step === 'brief'} done={false}>4. Review</StepDot>
            </p>
          </div>
          <button className="vb-close" type="button" onClick={onClose} aria-label="Close visit brief wizard">×</button>
        </header>

        <div className="vb-body">
          {step === 'airport' && (
            <AirportStep
              value={airportInput}
              onChange={setAirportInput}
              onSubmit={submitAirport}
              error={airportError}
              tripTitle={tripTitle}
              onTripTitleChange={setTripTitle}
              travelDates={travelDates}
              onTravelDatesChange={setTravelDates}
              travelerCount={travelerCount}
              onTravelerCountChange={setTravelerCount}
              tripPriority={tripPriority}
              onTripPriorityChange={setTripPriority}
            />
          )}

          {step === 'route' && airport && (
            <RouteStep
              airport={airport}
              route={optimisedRoute}
              totalMiles={totalMiles}
              onBack={() => setStep('airport')}
              onContinue={() => setStep('hotel')}
            />
          )}

          {step === 'hotel' && airport && (
            <HotelStep
              choice={hotelChoice}
              setChoice={(c) => {
                setHotelChoice(c);
                setSelectedHotelId(null); // anchor changed -> options reshuffle
              }}
              airport={airport}
              lastStop={lastStop}
              hotelOptions={hotelOptions}
              selectedHotelId={selectedHotelId}
              onSelectHotel={setSelectedHotelId}
              onBack={() => setStep('route')}
              onContinue={() => setStep('brief')}
            />
          )}

          {step === 'brief' && airport && (
            <BriefStep
              airport={airport}
              route={optimisedRoute}
              totalMiles={totalMiles}
              hotelChoice={hotelChoice}
              selectedHotel={selectedHotel}
              lastStop={lastStop}
              incidents={incidents}
              tasks={tasks}
              onBack={() => setStep('hotel')}
              onClose={onClose}
              tripTitle={tripTitle}
              travelDates={travelDates}
              travelerCount={travelerCount}
              tripPriority={tripPriority}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({ active, done, children }: { active: boolean; done: boolean; children: ReactNode }) {
  const cls = active ? 'vb-step-dot vb-step-dot--active' : done ? 'vb-step-dot vb-step-dot--done' : 'vb-step-dot';
  return <span className={cls}>{children}</span>;
}

function AirportStep({
  value, onChange, onSubmit, error, tripTitle, onTripTitleChange, travelDates, onTravelDatesChange, travelerCount, onTravelerCountChange, tripPriority, onTripPriorityChange,
}: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; error: string | null;
  tripTitle: string; onTripTitleChange: (v: string) => void;
  travelDates: string; onTravelDatesChange: (v: string) => void;
  travelerCount: string; onTravelerCountChange: (v: string) => void;
  tripPriority: TripPriority; onTripPriorityChange: (v: TripPriority) => void;
}) {
  const sample = listAirports();
  return (
    <div className="vb-step">
      <h3>Trip profile + arrival airport</h3>
      <p className="vb-help">Capture the trip context first, then provide the arrival airport. This profile will carry into the travel risk report.</p>
      <div className="vb-trip-grid">
        <label><span>Trip title</span><input type="text" value={tripTitle} onChange={(event) => onTripTitleChange(event.target.value)} placeholder="Executive site visit" /></label>
        <label><span>Travel dates</span><input type="text" value={travelDates} onChange={(event) => onTravelDatesChange(event.target.value)} placeholder="May 13–15, 2026" /></label>
        <label><span>Travelers</span><input type="number" min={1} max={20} value={travelerCount} onChange={(event) => onTravelerCountChange(event.target.value)} /></label>
        <label><span>Priority</span><select value={tripPriority} onChange={(event) => onTripPriorityChange(event.target.value as TripPriority)}><option value="standard">Standard</option><option value="elevated">Elevated</option><option value="critical">Critical</option></select></label>
      </div>
      <form
        className="vb-airport-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <input
          autoFocus
          className="vb-airport-input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="e.g. RIC, ORF, BWI"
          maxLength={4}
          aria-label="Airport IATA code"
        />
        <button type="submit" className="epr-action-button">Continue →</button>
      </form>
      {error && <p className="vb-error" role="alert">{error}</p>}
      <details className="vb-suggestions">
        <summary>Region 75 airport reference</summary>
        <ul>
          {sample.map((a) => (
            <li key={a.iata}>
              <strong>{a.iata}</strong> — {a.name} ({a.city}, {a.state})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function RouteStep({
  airport, route, totalMiles, onBack, onContinue,
}: {
  airport: Airport;
  route: EprFacility[];
  totalMiles: number;
  onBack: () => void;
  onContinue: () => void;
}) {
  // Synthesise a pseudo-facility for the airport so the existing RouteMap
  // can plot it as the route's first marker without a separate code path.
  const airportAsFacility: EprFacility = {
    facility_id: -1,
    facility_name: `${airport.iata} — Arrival`,
    market: airport.iata,
    region: 'Airport',
    division: 'Travel',
    open_task_count: 0,
    overdue_task_count: 0,
    critical_task_count: 0,
    avg_remediation_hours: 0,
    risk_score: 0,
    latitude: airport.latitude,
    longitude: airport.longitude,
    city: airport.city,
    state: airport.state,
  };
  return (
    <div className="vb-step">
      <h3>Optimised route from {airport.iata}</h3>
      <p className="vb-help">
        Stops have been resequenced using a nearest-neighbour algorithm starting from {airport.name}. Estimated total drive distance is <strong>{totalMiles.toFixed(1)} miles</strong> (great-circle, before traffic).
      </p>
      <RouteMap facilities={[airportAsFacility, ...route]} />
      <ol className="vb-itinerary">
        <li>
          <span className="vb-step-num">A</span>
          <div>
            <strong>{airport.iata} — {airport.name}</strong>
            <small>{airport.city}, {airport.state} · arrival</small>
          </div>
        </li>
        {route.map((f, i) => {
          const prev = i === 0
            ? { latitude: airport.latitude, longitude: airport.longitude }
            : { latitude: route[i - 1].latitude!, longitude: route[i - 1].longitude! };
          const leg = haversineMiles(prev, { latitude: f.latitude!, longitude: f.longitude! });
          return (
            <li key={f.facility_id}>
              <span className="vb-step-num">{i + 1}</span>
              <div>
                <strong>{f.facility_name}</strong>
                <small>{f.city}, {f.state} · {leg.toFixed(1)} mi from previous · risk {Math.round(f.risk_score)}</small>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="vb-actions">
        <button type="button" className="epr-action-button secondary" onClick={onBack}>← Back</button>
        <button type="button" className="epr-action-button" onClick={onContinue}>Continue →</button>
      </div>
    </div>
  );
}

function HotelStep({
  choice, setChoice, airport, lastStop, hotelOptions, selectedHotelId, onSelectHotel, onBack, onContinue,
}: {
  choice: HotelChoice | null;
  setChoice: (c: HotelChoice) => void;
  airport: Airport;
  lastStop: EprFacility | null;
  hotelOptions: Array<{ hotel: EprHotel; miles: number }>;
  selectedHotelId: string | null;
  onSelectHotel: (id: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const anchorLabel =
    choice === 'airport'
      ? `${airport.iata} — ${airport.name}`
      : choice === 'lastStop' && lastStop
        ? `${lastStop.facility_name} — ${lastStop.city}, ${lastStop.state}`
        : null;

  return (
    <div className="vb-step">
      <h3>Where should we anchor your hotel?</h3>
      <p className="vb-help">
        Pick the anchor point. We’ll surface the {HOTEL_OPTION_COUNT} closest Walmart-friendly hotels so you stay in control of the final pick.
      </p>
      <div className="vb-hotel-choices">
        <ChoiceCard
          selected={choice === 'airport'}
          onSelect={() => setChoice('airport')}
          title={`Near the airport (${airport.iata})`}
          subtitle={`${airport.name} · ${airport.city}, ${airport.state}`}
          rationale="Best for early-morning departures or short trips with a single overnight."
        />
        <ChoiceCard
          selected={choice === 'lastStop'}
          onSelect={() => setChoice('lastStop')}
          disabled={!lastStop}
          title="Near the last store of the day"
          subtitle={lastStop ? `${lastStop.facility_name} · ${lastStop.city}, ${lastStop.state}` : 'No stops in route yet'}
          rationale="Best for multi-day visits — minimises evening drive after wrap-up."
        />
      </div>

      {anchorLabel && hotelOptions.length === 0 && (
        <p className="vb-help vb-empty">No geocoded hotels available in the dataset to compare.</p>
      )}

      {hotelOptions.length > 0 && (
        <section className="vb-hotel-results" aria-label={`Hotel options near ${anchorLabel}`}>
          <header className="vb-hotel-results-header">
            <div>
              <p className="eyebrow">{hotelOptions.length} hotels near {anchorLabel}</p>
              <p className="vb-help" style={{ margin: 0 }}>Sorted by distance to anchor. Mock booking data — no reservation will be made.</p>
            </div>
            <span className="vb-mock-badge">Spotnana · Mock results</span>
          </header>
          <div className="vb-hotel-list">
            {hotelOptions.map(({ hotel, miles }, idx) => (
              <HotelOptionCard
                key={hotel.hotel_id}
                hotel={hotel}
                milesFromAnchor={miles}
                selected={selectedHotelId === hotel.hotel_id}
                recommended={idx === 0}
                onSelect={() => onSelectHotel(hotel.hotel_id)}
              />
            ))}
          </div>
        </section>
      )}

      <div className="vb-actions">
        <button type="button" className="epr-action-button secondary" onClick={onBack}>← Back</button>
        <button type="button" className="epr-action-button" onClick={onContinue} disabled={!choice || !selectedHotelId}>
          Continue →
        </button>
      </div>
    </div>
  );
}

function HotelOptionCard({
  hotel, milesFromAnchor, selected, recommended, onSelect,
}: {
  hotel: EprHotel;
  milesFromAnchor: number;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  const stars = Math.round(hotel.rating);
  const totalEstimate = Math.round(hotel.price_per_night * 1.18); // taxes + fees fudge
  const cls = ['vb-hotel-card', recommended && 'vb-hotel-card--recommended', selected && 'vb-hotel-card--selected']
    .filter(Boolean).join(' ');
  return (
    <article className={cls}>
      {recommended && <div className="vb-hotel-ribbon">★ FPI Recommended Hotel</div>}
      <div className="vb-hotel-photo">
        <HotelPhoto hotel={hotel} />
      </div>
      <div className="vb-hotel-body">
        <p className="vb-hotel-meta-line">
          <span>{stars}-star hotel</span>
          <span className="dot">•</span>
          <span>{milesFromAnchor.toFixed(2)}mi away</span>
          {hotel.walmart_preferred && (<><span className="dot">•</span><span className="vb-badge-pref">Walmart preferred</span></>)}
        </p>
        <h4 className="vb-hotel-name">{hotel.name}</h4>
        <p className="vb-hotel-address">{hotel.address}</p>
        <ul className="vb-hotel-ticks">
          <li>✓ Negotiated rates</li>
          <li>✓ Free cancellation</li>
          {hotel.safety_score && <li>✓ Safety {hotel.safety_score.overall_score}/100</li>}
        </ul>
      </div>
      <div className="vb-hotel-pricecol">
        <p className="vb-hotel-price">${hotel.price_per_night.toFixed(0)} <span>/ night</span></p>
        <p className="vb-hotel-totals">${totalEstimate} total incl. taxes and fees</p>
        <button type="button" className={`vb-hotel-select${selected ? ' vb-hotel-select--selected' : ''}`} onClick={onSelect} aria-pressed={selected}>
          {selected ? 'Selected ✓' : 'Select hotel'}
        </button>
      </div>
    </article>
  );
}

function ChoiceCard({
  selected, onSelect, disabled, title, subtitle, rationale,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  subtitle: string;
  rationale: string;
}) {
  const cls = ['vb-choice', selected && 'vb-choice--selected', disabled && 'vb-choice--disabled']
    .filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} onClick={onSelect} disabled={disabled} aria-pressed={selected}>
      <strong>{title}</strong>
      <small>{subtitle}</small>
      <span>{rationale}</span>
    </button>
  );
}

// Discussion-topic generator. Looks at recent incidents, open/overdue
// tasks, and the risk score to surface bullet points an exec should be
// prepped on before walking into a store. Heuristics are intentionally
// transparent so users can sanity-check why a topic appeared.
function buildDiscussionTopics(
  facility: EprFacility,
  facilityIncidents: EprIncident[],
  facilityTasks: EprTask[],
): string[] {
  const topics: string[] = [];
  const incidentTypes = new Set(facilityIncidents.map((i) => (i.incident_type || '').toLowerCase()));
  const violentSignals = ['battery', 'threat of violence', 'assault', 'weapon', 'robbery'];
  const propertySignals = ['vandalism', 'theft', 'shoplifting', 'criminal mischief', 'burglary'];

  const hasViolent = violentSignals.some((s) => Array.from(incidentTypes).some((t) => t.includes(s)));
  const hasProperty = propertySignals.some((s) => Array.from(incidentTypes).some((t) => t.includes(s)));

  if (facility.risk_score >= 80) topics.push('Elevated risk posture — review top mitigations and AP partnership cadence.');
  if (facility.critical_task_count > 0) topics.push(`${facility.critical_task_count} critical task(s) open — confirm closure plan and ETA.`);
  if (facility.overdue_task_count > 2) topics.push(`${facility.overdue_task_count} overdue tasks — unblock owners and reset SLA expectations.`);
  if (hasViolent) topics.push('Recent violent-incident signal — associate de-escalation training status and panic-button coverage.');
  if (hasProperty) topics.push('Property/loss incidents present — entry-point hardening and EAS performance review.');
  if (facilityIncidents.length >= 4) topics.push(`${facilityIncidents.length} incidents in recent sample — trend conversation with site lead.`);
  if (facility.avg_remediation_hours > 48) topics.push(`Avg remediation ${facility.avg_remediation_hours.toFixed(0)}h — root-cause review on dispatch lag.`);
  if (topics.length === 0) {
    topics.push('Strong execution: recognize team and capture best practices to share regionally.');
  }
  return topics;
}

// Bundle of per-store data the email body needs. Computed once per store
// so the markup stays declarative.
type SecurityAddition = {
  id: string;
  category: 'LPR' | 'Body Cam' | 'Security Guard';
  title: string;
  detail: string;
  installedDaysAgo: number;
};

type StoreBrief = {
  facility: EprFacility;
  recentIncidents: EprIncident[];
  openTasks: EprTask[];
  overdueTasks: EprTask[];
  topics: string[];
  recentSecurity: SecurityAddition[];
};

// Tiny deterministic RNG (mulberry32). Seeding by facility_id keeps the
// generated security additions stable across re-renders — a real backend
// would replace this with actual install records.
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catalog leans on the three asks (LPR, body cameras, security guards)
// with a couple of flavor variants so executives don't see identical copy.
const SECURITY_CATALOG: Array<Omit<SecurityAddition, 'id' | 'installedDaysAgo'>> = [
  { category: 'LPR', title: 'LPR cameras at lot entrances', detail: 'Two Genetec AutoVu units covering north & south entrances; tied to known-offender watchlist.' },
  { category: 'LPR', title: 'LPR coverage expanded to fuel station', detail: 'Single-pole AutoVu unit added at fuel canopy egress; alerts route to AP control room.' },
  { category: 'LPR', title: 'Mobile LPR trailer (pilot)', detail: 'Solar trailer deployed weekends; flagged 14 prior-offender plates in first month.' },
  { category: 'Body Cam', title: 'AP associate body cameras', detail: 'Axon Body 3 issued to all AP associates on 1st & 2nd shift; auto-upload via store Wi-Fi.' },
  { category: 'Body Cam', title: 'Body cam pilot — night shift', detail: 'Eight Reveal cameras issued to overnight associates; evidence retained 90 days.' },
  { category: 'Body Cam', title: 'Greeter body cameras at entry vestibule', detail: 'Front-door greeters equipped with Axon Body 4; deters confrontation at receipt checks.' },
  { category: 'Security Guard', title: 'Uniformed guard — evening shift', detail: 'Allied Universal officer 4pm–midnight Thu–Sun; visible deterrent at parking lot.' },
  { category: 'Security Guard', title: 'Off-duty law enforcement — weekend coverage', detail: 'Off-duty PD presence Fri–Sun 6pm close; coordinated with local precinct.' },
  { category: 'Security Guard', title: 'Mobile patrol — perimeter sweep', detail: 'Securitas mobile patrol every 90 min overnight; GPS-logged tour points.' },
  { category: 'Security Guard', title: 'Armed guard pilot', detail: 'Single armed officer added at front entry during peak hours; 90-day pilot.' },
];

function buildRecentSecurity(facility: EprFacility): SecurityAddition[] {
  const rng = seededRandom(facility.facility_id || 1);
  const count = 1 + Math.floor(rng() * 3); // 1–3 additions per store
  // Fisher-Yates partial shuffle so picks don't repeat within a store.
  const pool = [...SECURITY_CATALOG];
  const picks: SecurityAddition[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    const [item] = pool.splice(idx, 1);
    picks.push({
      ...item,
      id: `${facility.facility_id}-${i}`,
      installedDaysAgo: 7 + Math.floor(rng() * 84), // 1–13 weeks ago
    });
  }
  return picks;
}

function formatRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (daysAgo < 14) return `${dateStr} · ${daysAgo}d ago`;
  const weeks = Math.round(daysAgo / 7);
  return `${dateStr} · ${weeks}w ago`;
}

function buildStoreBrief(facility: EprFacility, incidents: EprIncident[], tasks: EprTask[]): StoreBrief {
  const recentIncidents = incidents
    .filter((i) => i.facility_id === facility.facility_id)
    .slice(0, 4); // top few; mock data is already a sample
  const facilityTasks = tasks.filter((t) => t.facility_id === facility.facility_id);
  const openTasks = facilityTasks.filter((t) => (t.status || '').toLowerCase() !== 'closed');
  const overdueTasks = facilityTasks.filter((t) => (t.status || '').toLowerCase() === 'overdue');
  const topics = buildDiscussionTopics(facility, recentIncidents, facilityTasks);
  const recentSecurity = buildRecentSecurity(facility);
  return { facility, recentIncidents, openTasks, overdueTasks, topics, recentSecurity };
}

function BriefStep({
  airport, route, totalMiles, hotelChoice, selectedHotel, lastStop, incidents, tasks, onBack, onClose, tripTitle, travelDates, travelerCount, tripPriority,
}: {
  airport: Airport;
  route: EprFacility[];
  totalMiles: number;
  hotelChoice: HotelChoice | null;
  selectedHotel: EprHotel | null;
  lastStop: EprFacility | null;
  incidents: EprIncident[];
  tasks: EprTask[];
  onBack: () => void;
  onClose: () => void;
  tripTitle: string;
  travelDates: string;
  travelerCount: string;
  tripPriority: TripPriority;
}) {
  const [sent, setSent] = useState(false);
  // Browser-native PDF export: clone the email into a top-level print host
  // so it lives in normal document flow (no position:absolute, which breaks
  // multi-page pagination). Hide the rest of the app via @media print.
  function handleSaveAsPdf() {
    const email = document.querySelector('.vb-email');
    if (!email) {
      window.print();
      return;
    }
    const host = document.createElement('div');
    host.id = 'vb-print-host';
    host.appendChild(email.cloneNode(true));
    document.body.appendChild(host);
    document.body.classList.add('vb-printing');
    const cleanup = () => {
      document.body.classList.remove('vb-printing');
      host.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Tiny delay lets React/CSS settle before the print snapshot.
    setTimeout(() => window.print(), 50);
  }
  const briefs = useMemo(
    () => route.map((f) => buildStoreBrief(f, incidents, tasks)),
    [route, incidents, tasks],
  );
  const totalIncidents = briefs.reduce((s, b) => s + b.recentIncidents.length, 0);
  const totalCritical = briefs.reduce((s, b) => s + b.facility.critical_task_count, 0);
  const totalOverdue = briefs.reduce((s, b) => s + b.facility.overdue_task_count, 0);
  const riskScore = Math.min(100, Math.round((totalIncidents * 6) + (totalCritical * 7) + (totalOverdue * 3) + (tripPriority === 'critical' ? 15 : tripPriority === 'elevated' ? 8 : 2)));
  const riskLevel = riskScore >= 75 ? 'High' : riskScore >= 50 ? 'Moderate' : 'Low';
  const today = new Date();
  const subject = `Executive Visit Brief — Region 75 — ${today.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${route.length} stop${route.length === 1 ? '' : 's'})`;

  return (
    <div className="vb-step">
      <h3>Travel risk report — Email Preview</h3>
      <p className="vb-help">Mock travel risk report composition. Weather, airport alerts, and external risk feeds are designed to connect to your upcoming APIs.</p>
      <section className="vb-risk-report">
        <div><p className="eyebrow">Trip</p><strong>{tripTitle}</strong><small>{travelDates || 'Dates TBD'}</small></div>
        <div><p className="eyebrow">Travelers</p><strong>{travelerCount}</strong><small>Airport {airport.iata}</small></div>
        <div><p className="eyebrow">Risk level</p><strong>{riskLevel}</strong><small>Score {riskScore}/100</small></div>
        <div><p className="eyebrow">API feeds</p><strong>Pending</strong><small>Weather · Airport · Threat</small></div>
      </section>

      <article className="vb-email" aria-label="Mock executive visit brief email">
        <header className="vb-email-headers">
          <div><span className="vb-email-label">From</span><span>FPI Operations &lt;fpi-ops@walmart.com&gt;</span></div>
          <div><span className="vb-email-label">To</span><span>Executive Sponsor &lt;exec.sponsor@walmart.com&gt;</span></div>
          <div><span className="vb-email-label">Cc</span><span>Region 75 Site Leads; EP On-call; AP Region Director</span></div>
          <div><span className="vb-email-label">Subject</span><span className="vb-email-subject">{subject}</span></div>
        </header>

        <div className="vb-email-body">
          <p>Team,</p>
          <p>
            Below is the draft visit brief for the upcoming Region 75 (Mid-Atlantic) tour starting from <strong>{airport.iata} — {airport.name}</strong>.
            The route is sequenced for shortest drive ({totalMiles.toFixed(0)} mi total, great-circle estimate).
            Each stop section includes a risk snapshot and recommended discussion topics so you can engage site teams effectively.
          </p>

          <div className="vb-email-summary">
            <div><span>Stops</span><strong>{route.length}</strong></div>
            <div><span>Recent incidents</span><strong>{totalIncidents}</strong></div>
            <div><span>Critical tasks open</span><strong>{totalCritical}</strong></div>
            <div><span>Overdue tasks</span><strong>{totalOverdue}</strong></div>
          </div>

          <h4 className="vb-email-h">Travel</h4>
          <ul className="vb-email-ul">
            <li><strong>Arrival:</strong> {airport.iata} — {airport.name} ({airport.city}, {airport.state})</li>
            <li><strong>Hotel anchor:</strong> {hotelChoice === 'airport' ? `Near ${airport.iata}` : hotelChoice === 'lastStop' && lastStop ? `Near last stop (${lastStop.city}, ${lastStop.state})` : '—'}</li>
            {selectedHotel && (
              <li><strong>Lodging:</strong> {selectedHotel.name} — {selectedHotel.address} ({selectedHotel.brand}, {selectedHotel.rating.toFixed(1)}★, ${selectedHotel.price_per_night.toFixed(0)}/night)</li>
            )}
          </ul>

          {selectedHotel && (
            <div className="vb-email-hotel">
              <div className="vb-email-hotel-photo"><HotelPhoto hotel={selectedHotel} /></div>
              <div>
                <p className="vb-email-hotel-name">{selectedHotel.name}</p>
                <p className="vb-email-hotel-meta">
                  {selectedHotel.brand} · {selectedHotel.rating.toFixed(1)}★ · ${selectedHotel.price_per_night.toFixed(0)}/night
                  {selectedHotel.walmart_preferred ? ' · Walmart preferred' : ''}
                  {selectedHotel.safety_score ? ` · Safety ${selectedHotel.safety_score.overall_score}/100` : ''}
                </p>
                <p className="vb-email-hotel-meta">{selectedHotel.address}</p>
              </div>
            </div>
          )}

          <h4 className="vb-email-h">Stop-by-stop risk briefing</h4>
          {briefs.map((brief, idx) => (
            <StoreBriefBlock key={brief.facility.facility_id} brief={brief} index={idx} />
          ))}

          <p className="vb-email-signoff">
            Please review and reply with any preferred adjustments. Field teams have been notified to prepare site walks aligned to the discussion topics above.
            <br /><br />
            — FPI Operations
          </p>
        </div>
      </article>

      {sent && (
        <div className="vb-email-sent" role="status">
          ✓ Mock send recorded. In production this would dispatch via Outlook with the brief attached as PDF.
        </div>
      )}

      <div className="vb-actions">
        <button type="button" className="epr-action-button secondary" onClick={onBack}>← Back</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="epr-action-button secondary" onClick={onClose}>Close</button>
          <button type="button" className="epr-action-button secondary" onClick={handleSaveAsPdf}>⤓ Save as PDF</button>
          <button type="button" className="epr-action-button" onClick={() => setSent(true)} disabled={sent}>
            {sent ? 'Sent (mock) ✓' : 'Send Brief (mock)'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StoreBriefBlock({ brief, index }: { brief: StoreBrief; index: number }) {
  const { facility, recentIncidents, openTasks, overdueTasks, topics, recentSecurity } = brief;
  const tier = facility.risk_tier ?? (facility.risk_score >= 80 ? 'Critical' : facility.risk_score >= 50 ? 'High' : facility.risk_score >= 25 ? 'Moderate' : 'Low');
  const tone = facility.risk_score >= 80 ? 'critical' : facility.risk_score >= 50 ? 'high' : facility.risk_score >= 25 ? 'moderate' : 'low';
  return (
    <section className="vb-storebrief" aria-label={`Stop ${index + 1}: ${facility.facility_name}`}>
      <header className="vb-storebrief-header">
        <span className="vb-step-num">{index + 1}</span>
        <div>
          <p className="vb-storebrief-name">{facility.facility_name}</p>
          <p className="vb-storebrief-addr">{facility.city}, {facility.state} · {facility.market}</p>
        </div>
        <span className={`vb-risk-pill vb-risk-pill--${tone}`}>Risk {Math.round(facility.risk_score)} · {tier}</span>
      </header>
      <ul className="vb-storebrief-stats">
        <li><span>Open tasks</span><strong>{facility.open_task_count}</strong></li>
        <li><span>Overdue</span><strong>{facility.overdue_task_count}</strong></li>
        <li><span>Critical</span><strong>{facility.critical_task_count}</strong></li>
        <li><span>Avg remediation</span><strong>{facility.avg_remediation_hours.toFixed(0)}h</strong></li>
      </ul>
      {recentIncidents.length > 0 && (
        <div className="vb-storebrief-block">
          <p className="vb-storebrief-h">Recent incidents ({recentIncidents.length})</p>
          <ul className="vb-storebrief-list">
            {recentIncidents.map((inc) => (
              <li key={inc.id}>
                <strong>{inc.incident_type}</strong>
                {inc.severity != null && <span className="vb-pill">sev {String(inc.severity)}</span>}
                {inc.incident_date && <span className="vb-muted"> · {inc.incident_date}</span>}
                {inc.description && <p className="vb-storebrief-desc">{inc.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(openTasks.length + overdueTasks.length) > 0 && (
        <div className="vb-storebrief-block">
          <p className="vb-storebrief-h">Top open tasks</p>
          <ul className="vb-storebrief-list">
            {openTasks.slice(0, 3).map((t) => (
              <li key={t.task_id}>
                <strong>{t.title}</strong>
                <span className="vb-pill">{t.priority}</span>
                <span className="vb-muted"> · owner {t.owner_role} · due {t.due_date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="vb-storebrief-block vb-storebrief-topics">
        <p className="vb-storebrief-h">Discussion topics for the executive</p>
        <ul className="vb-storebrief-list">
          {topics.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </div>
      {recentSecurity.length > 0 && (
        <div className="vb-storebrief-block vb-storebrief-security">
          <p className="vb-storebrief-h">Recently added security ({recentSecurity.length})</p>
          <ul className="vb-storebrief-list">
            {recentSecurity.map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong>
                <span className={`vb-pill vb-pill--${s.category.replace(' ', '-').toLowerCase()}`}>{s.category}</span>
                <span className="vb-muted"> · installed {formatRelativeDate(s.installedDaysAgo)}</span>
                <p className="vb-storebrief-desc">{s.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
