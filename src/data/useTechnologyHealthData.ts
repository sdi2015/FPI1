import { useEffect, useState } from 'react';
import type { TechnologyHealthData } from './technologyHealthTypes';

const TECHNOLOGY_HEALTH_URL = '/data/fpi-canonical-technology-health.json';

export type TechnologyHealthDataState = {
  loading: boolean;
  error: string | null;
  data: TechnologyHealthData | null;
};

export function useTechnologyHealthData(): TechnologyHealthDataState {
  const [state, setState] = useState<TechnologyHealthDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadTechnologyHealth() {
      try {
        const response = await fetch(TECHNOLOGY_HEALTH_URL);
        if (!response.ok) throw new Error(`Unable to load ${TECHNOLOGY_HEALTH_URL} (${response.status}).`);
        const data = (await response.json()) as TechnologyHealthData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load technology health data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadTechnologyHealth();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
