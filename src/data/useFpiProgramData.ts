import { useEffect, useState } from 'react';
import { adaptFpiMaster } from './fpiAdapter';
import { calculateFpiDashboardMetrics } from './fpiMetrics';
import type { RawFpiMaster } from './fpiRawTypes';
import type { FpiProgramDashboard } from './fpiTypes';

const MASTER_DATA_URL = '/data/synthetic_single_region_master.json';
const FALLBACK_ERROR =
  'Dashboard data is unavailable. Confirm that the local master JSON file exists and matches the expected structure.';

export type FpiProgramDataState = {
  loading: boolean;
  error: string | null;
  data: FpiProgramDashboard | null;
};

export function useFpiProgramData(): FpiProgramDataState {
  const [state, setState] = useState<FpiProgramDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadDashboardData() {
      try {
        const response = await fetch(MASTER_DATA_URL);
        if (!response.ok) {
          throw new Error(`Unable to load ${MASTER_DATA_URL} (${response.status}).`);
        }

        const raw = (await response.json()) as RawFpiMaster;
        const programData = adaptFpiMaster(raw);
        const dashboardMetrics = calculateFpiDashboardMetrics(programData);

        if (!ignore) {
          setState({ loading: false, error: null, data: { programData, dashboardMetrics } });
        }
      } catch (error) {
        const message = error instanceof Error ? `${FALLBACK_ERROR} ${error.message}` : FALLBACK_ERROR;
        if (!ignore) {
          setState({ loading: false, error: message, data: null });
        }
      }
    }

    loadDashboardData();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
