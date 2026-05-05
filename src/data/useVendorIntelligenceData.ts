import { useEffect, useState } from 'react';
import type { VendorIntelligenceData } from './vendorIntelligenceTypes';

const VENDOR_INTELLIGENCE_URL = '/data/fpi-sentry-vendor-intelligence.json';

export type VendorIntelligenceDataState = {
  loading: boolean;
  error: string | null;
  data: VendorIntelligenceData | null;
};

export function useVendorIntelligenceData(): VendorIntelligenceDataState {
  const [state, setState] = useState<VendorIntelligenceDataState>({ loading: true, error: null, data: null });

  useEffect(() => {
    let ignore = false;

    async function loadVendorIntelligence() {
      try {
        const response = await fetch(VENDOR_INTELLIGENCE_URL);
        if (!response.ok) throw new Error(`Unable to load ${VENDOR_INTELLIGENCE_URL} (${response.status}).`);
        const data = (await response.json()) as VendorIntelligenceData;
        if (!ignore) setState({ loading: false, error: null, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load SENTRY vendor intelligence data.';
        if (!ignore) setState({ loading: false, error: message, data: null });
      }
    }

    loadVendorIntelligence();

    return () => {
      ignore = true;
    };
  }, []);

  return state;
}
