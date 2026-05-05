import { useEffect, useState } from 'react';
import { adaptFireAlarmExport, buildFireAlarmDashboardModel } from './fireAlarmAdapter';
import type { FireAlarmDashboardModel, FireAlarmProgramData, FireAlarmRawExport } from './fireAlarmTypes';

const FIRE_ALARM_DATA_URL = '/data/fpi-canonical-fire-alarm.json';
const FALLBACK_ERROR = 'Fire-system monitoring data is unavailable. Confirm the fire alarm handoff JSON exists and matches the expected structure.';

export type FireAlarmDataState = {
  loading: boolean;
  error: string | null;
  data: FireAlarmProgramData | null;
  fireAlarmData: FireAlarmProgramData | null;
  model: FireAlarmDashboardModel | null;
};

export function useFireAlarmData(): FireAlarmDataState {
  const [state, setState] = useState<FireAlarmDataState>({ loading: true, error: null, data: null, fireAlarmData: null, model: null });

  useEffect(() => {
    let ignore = false;

    async function loadFireAlarmData() {
      try {
        const response = await fetch(FIRE_ALARM_DATA_URL);
        if (!response.ok) {
          throw new Error(`Unable to load ${FIRE_ALARM_DATA_URL} (${response.status}).`);
        }

        const raw = (await response.json()) as FireAlarmRawExport;
        const data = adaptFireAlarmExport(raw);
        const model = buildFireAlarmDashboardModel(data);

        if (!ignore) {
          setState({ loading: false, error: null, data, fireAlarmData: data, model });
        }
      } catch (error) {
        const message = error instanceof Error ? `${FALLBACK_ERROR} ${error.message}` : FALLBACK_ERROR;
        if (!ignore) {
          setState({ loading: false, error: message, data: null, fireAlarmData: null, model: null });
        }
      }
    }

    loadFireAlarmData();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
