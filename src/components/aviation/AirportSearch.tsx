import { useEffect, useState } from 'react';
import { searchAirports } from '../../services/airportService';
import type { Airport } from '../../types/aviation';

export interface AirportSearchProps {
  selectedAirport?: Airport | null;
  onSelectAirport: (airport: Airport) => void;
}

function codeSummary(airport: Airport): string {
  return [airport.faa_id, airport.iata_code, airport.icao_code].filter(Boolean).join(' / ') || 'No codes';
}

export function AirportSearch({ selectedAirport, onSelectAirport }: AirportSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    }, query.trim() ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const emptyMessage = query.trim()
    ? 'No matching airports found.'
    : 'Start typing to search, or choose a recommended demo airport.';

  return (
    <section className="panel aviation-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Airport radius scanner</p>
          <h3>Airport Search</h3>
        </div>
      </div>
      <input
        className="aviation-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, city, state, FAA, IATA, ICAO"
        aria-label="Search airports"
      />
      {loading ? <p className="aviation-empty">Loading airports…</p> : null}
      {error ? <p className="aviation-empty aviation-error">{error}</p> : null}
      {!loading && !error && results.length === 0 ? <p className="aviation-empty">{emptyMessage}</p> : null}
      <div className="aviation-search-results" role="listbox" aria-label="Airport search results">
        {!error && results.map((airport) => (
          <button key={airport.airport_id} type="button" className="aviation-result-button" onClick={() => onSelectAirport(airport)}>
            <strong>{airport.airport_name}</strong>
            <span>{airport.city ?? 'Unknown city'}, {airport.state ?? 'Unknown state'} • {codeSummary(airport)}</span>
          </button>
        ))}
      </div>
      {selectedAirport ? (
        <article className="aviation-selected-card">
          <span className="eyebrow">Selected airport</span>
          <strong>{selectedAirport.airport_name}</strong>
          <span>{selectedAirport.city ?? 'Unknown city'}, {selectedAirport.state ?? 'Unknown state'} • {codeSummary(selectedAirport)}</span>
          <span>{selectedAirport.latitude.toFixed(4)}, {selectedAirport.longitude.toFixed(4)} • {selectedAirport.source_freshness}</span>
        </article>
      ) : null}
    </section>
  );
}
