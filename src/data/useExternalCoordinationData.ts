import { useEffect, useState } from 'react';
import type { ExternalCoordinationData } from './externalCoordinationTypes';

const EXTERNAL_COORDINATION_URL = '/data/fpi-external-coordination.json';

export type ExternalCoordinationDataState = {
  loading: boolean;
  error: string | null;
  data: ExternalCoordinationData | null;
};

export function useExternalCoordinationData(): ExternalCoordinationDataState {
  const [state, setState] = useState<ExternalCoordinationDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadExternalCoordination() {
      try {
        const response = await fetch(EXTERNAL_COORDINATION_URL);
        if (!response.ok) throw new Error(`Unable to load ${EXTERNAL_COORDINATION_URL} (${response.status}).`);
        const data = (await response.json()) as ExternalCoordinationData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load external coordination data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadExternalCoordination();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
