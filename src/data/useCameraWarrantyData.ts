import { useEffect, useState } from 'react';
import type { CameraWarrantyData } from './cameraWarrantyTypes';

const CAMERA_WARRANTY_URL = '/data/camera-warranty.json';

export type CameraWarrantyDataState = {
  loading: boolean;
  error: string | null;
  data: CameraWarrantyData | null;
};

export function useCameraWarrantyData(): CameraWarrantyDataState {
  const [state, setState] = useState<CameraWarrantyDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadCameraWarranty() {
      try {
        const response = await fetch(CAMERA_WARRANTY_URL);
        if (!response.ok) throw new Error(`Unable to load ${CAMERA_WARRANTY_URL} (${response.status}).`);
        const data = (await response.json()) as CameraWarrantyData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load camera warranty data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadCameraWarranty();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
