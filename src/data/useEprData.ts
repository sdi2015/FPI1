import { useEffect, useState } from 'react';
import type { EprData } from './eprTypes';

const EPR_DATA_URL = '/data/fpi-canonical-epr.json';

export type EprDataState = {
  loading: boolean;
  error: string | null;
  data: EprData | null;
};

export function useEprData(): EprDataState {
  const [state, setState] = useState<EprDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadEprData() {
      try {
        const response = await fetch(EPR_DATA_URL);
        if (!response.ok) throw new Error(`Unable to load ${EPR_DATA_URL} (${response.status}).`);
        const data = (await response.json()) as EprData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load Executive Protection Readiness data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadEprData();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
