import { useEffect, useState } from 'react';
import { adaptFpiMaster } from './fpiAdapter';
import { mergeElmLocationsIntoFpiProgram } from './fpiElmIntegration';
import { calculateFpiDashboardMetrics } from './fpiMetrics';
import type { RawFpiMaster } from './fpiRawTypes';
import type { FpiProgramDashboard } from './fpiTypes';

const MASTER_DATA_URL = '/data/fpi-canonical-master.json';
const ELM_LOCATION_DATA_URL = '/data/elm-store-locations.json';
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
        const [masterResponse, elmResponse] = await Promise.all([
          fetch(MASTER_DATA_URL),
          fetch(ELM_LOCATION_DATA_URL).catch(() => null),
        ]);
        if (!masterResponse.ok) {
          throw new Error(`Unable to load ${MASTER_DATA_URL} (${masterResponse.status}).`);
        }

        const raw = (await masterResponse.json()) as RawFpiMaster;
        const baseProgramData = adaptFpiMaster(raw);
        const elmLocations = elmResponse?.ok ? await elmResponse.json() : [];
        const programData = mergeElmLocationsIntoFpiProgram(baseProgramData, elmLocations);
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
