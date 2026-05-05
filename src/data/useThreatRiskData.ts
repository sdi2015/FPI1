import { useEffect, useState } from 'react';
import type { ThreatRiskData } from './threatRiskTypes';

const THREAT_RISK_URL = '/data/fpi-canonical-threat-risk.json';

export type ThreatRiskDataState = {
  loading: boolean;
  error: string | null;
  data: ThreatRiskData | null;
};

export function useThreatRiskData(): ThreatRiskDataState {
  const [state, setState] = useState<ThreatRiskDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadThreatRiskData() {
      try {
        const response = await fetch(THREAT_RISK_URL);
        if (!response.ok) throw new Error(`Unable to load ${THREAT_RISK_URL} (${response.status}).`);
        const data = (await response.json()) as ThreatRiskData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load threat risk data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadThreatRiskData();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
