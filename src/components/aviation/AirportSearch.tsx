import { useEffect, useState } from 'react';
import { searchAirports } from '../../services/airportService';
import type { Airport } from '../../types/aviation';

export interface AirportSearchProps {
  selectedAirport?: Airport | null;
  onSelectAirport: (airport: Airport) => void;
}

function codeSummary(airport: Airport): string {
  return `FAA: ${airport.faa_id ?? 'N/A'} | IATA: ${airport.iata_code ?? 'N/A'} | ICAO: ${airport.icao_code ?? 'N/A'}`;
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
    : 'Search for an airport to begin a Walmart facility scan.';

  return (
    <section className="panel aviation-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Airport facility scan</p>
          <h3>Search airport</h3>
        </div>
      </div>
      <input
        className="aviation-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, city, state, FAA, IATA, ICAO"
        aria-label="Search airports"
      />
      {loading ? <p className="aviation-empty">Loading airport data...</p> : null}
      {error ? <p className="aviation-empty aviation-error">Airport data unavailable. Try again or use demo scenario.</p> : null}
      {!loading && !error && results.length === 0 ? <p className="aviation-empty">{emptyMessage}</p> : null}
      <div className="aviation-search-results" role="listbox" aria-label="Airport search results">
        {!error && results.map((airport) => (
          <button key={airport.airport_id} type="button" className="aviation-result-button aviation-airport-result-card" onClick={() => onSelectAirport(airport)}>
            <strong>{airport.airport_name}</strong>
            <span>{airport.city ?? 'Unknown city'}, {airport.state ?? 'Unknown state'}</span>
            <span>{codeSummary(airport)}</span>
            <small>{airport.airport_type ?? 'Airport'} • {airport.source_freshness}</small>
          </button>
        ))}
      </div>
      {selectedAirport ? (
        <article className="aviation-selected-card">
          <span className="eyebrow">Selected airport</span>
          <strong>{selectedAirport.airport_name}</strong>
          <span>{selectedAirport.city ?? 'Unknown city'}, {selectedAirport.state ?? 'Unknown state'}</span>
          <span>{codeSummary(selectedAirport)}</span>
          <span>{selectedAirport.airport_type ?? 'Airport'} • {selectedAirport.latitude.toFixed(4)}, {selectedAirport.longitude.toFixed(4)}</span>
          <span>Source status: {selectedAirport.source_freshness}</span>
        </article>
      ) : null}
    </section>
  );
}
