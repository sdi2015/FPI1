import { useEffect, useMemo, useState } from 'react';
import { loadAirports, searchAirports } from '../../services/airportService';
import type { Airport } from '../../types/aviation';

export interface AirportSearchProps {
  selectedAirport?: Airport | null;
  onSelectAirport: (airport: Airport) => void;
}

const quickAirportCodes = ['XNA', 'LIT', 'DFW', 'IAH', 'MSY'];

function codeSummary(airport: Airport): string {
  const codes = [airport.iata_code, airport.icao_code, airport.faa_id ? `FAA: ${airport.faa_id}` : null].filter(Boolean);
  return codes.length ? codes.join(' · ') : 'Airport codes unavailable';
}

function airportCode(airport: Airport): string {
  return airport.iata_code ?? airport.faa_id ?? airport.icao_code ?? airport.airport_id;
}

export function AirportSearch({ selectedAirport, onSelectAirport }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [quickAirports, setQuickAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changingAirport, setChangingAirport] = useState(false);

  const showSearch = !selectedAirport || changingAirport;
  const trimmedQuery = query.trim();
  const resultTitle = useMemo(() => trimmedQuery ? 'Search results' : 'Recommended airports', [trimmedQuery]);

  useEffect(() => {
    let cancelled = false;
    loadAirports()
      .then((airports) => {
        if (cancelled) return;
        setQuickAirports(quickAirportCodes
          .map((code) => airports.find((airport) => [airport.iata_code, airport.faa_id, airport.icao_code].some((value) => value?.toUpperCase() === code)))
          .filter(Boolean) as Airport[]);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const matches = await searchAirports(query);
        if (!cancelled) setResults(matches);
      } catch {
        if (!cancelled) {
          setResults([]);
          setError('Unable to load airport data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, trimmedQuery ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, showSearch, trimmedQuery]);

  function selectAirport(airport: Airport) {
    onSelectAirport(airport);
    setChangingAirport(false);
    setQuery('');
  }

  if (selectedAirport && !changingAirport) {
    return (
      <section className="panel aviation-panel aviation-airport-selector-card compact">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Selected airport</p>
            <h3>{selectedAirport.airport_name}</h3>
          </div>
          <button type="button" className="ops-action-button secondary" onClick={() => setChangingAirport(true)}>Change Airport</button>
        </div>
        <div className="aviation-selected-airport-card">
          <strong>{selectedAirport.city ?? 'Unknown city'}, {selectedAirport.state ?? 'Unknown state'}</strong>
          <span>{codeSummary(selectedAirport)}</span>
          <span>{selectedAirport.airport_type ?? 'Airport'}</span>
          <details>
            <summary>Details</summary>
            <span>Latitude/longitude: {selectedAirport.latitude.toFixed(4)}, {selectedAirport.longitude.toFixed(4)}</span>
            <span>Source freshness: {selectedAirport.source_freshness}</span>
          </details>
        </div>
      </section>
    );
  }

  return (
    <section className="panel aviation-panel aviation-airport-selector-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Airport Selection</p>
          <h3>Select Airport</h3>
        </div>
        {selectedAirport ? <button type="button" className="ops-action-button secondary" onClick={() => setChangingAirport(false)}>Cancel</button> : null}
      </div>
      <p className="aviation-caveat">Select an airport to begin the readiness scan.</p>
      {quickAirports.length ? (
        <div className="aviation-quick-airports" aria-label="Quick airport shortcuts">
          {quickAirports.map((airport) => <button key={airport.airport_id} type="button" className="aviation-filter-chip" onClick={() => selectAirport(airport)}>{airportCode(airport)}</button>)}
        </div>
      ) : null}
      <input
        className="aviation-input aviation-airport-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search airport by name, city, IATA, ICAO, or FAA code"
        aria-label="Search airports by name, city, IATA, ICAO, or FAA code"
      />
      {loading ? <p className="aviation-empty">Loading airport data...</p> : null}
      {error ? <p className="aviation-empty aviation-error">Airport data unavailable. Try again or use demo scenario.</p> : null}
      {!loading && !error && results.length === 0 ? <p className="aviation-empty">{trimmedQuery ? 'No matching airports found.' : 'Select an airport to begin the readiness scan.'}</p> : null}
      {!loading && !error && results.length ? <p className="eyebrow aviation-result-heading">{resultTitle}</p> : null}
      <div className="aviation-search-results aviation-airport-results" role="listbox" aria-label="Airport search results">
        {!error && results.map((airport) => (
          <button key={airport.airport_id} type="button" className="aviation-result-button aviation-airport-result-card" onClick={() => selectAirport(airport)}>
            <strong>{airport.airport_name}</strong>
            <span>{airport.city ?? 'Unknown city'}, {airport.state ?? 'Unknown state'}</span>
            <span>{codeSummary(airport)}</span>
            <small>{airport.airport_type ?? 'Airport'} · {airport.source_freshness}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
