export type AviationPersistenceMode = 'localStorage' | 'api' | 'firebase' | 'disabled';
export type AviationEnvironmentMode = 'demo' | 'pilot' | 'production';

type LiveProviderFlag = 'faa' | 'weather' | 'facilities' | 'routing' | 'risk' | 'reports';

function envValue(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function envBoolean(name: keyof ImportMetaEnv): boolean {
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(envValue(name).toLowerCase());
}

export function getAviationApiBaseUrl(): string {
  return envValue('VITE_AVIATION_API_BASE_URL').replace(/\/+$/, '');
}

export function getAviationPersistenceMode(): AviationPersistenceMode {
  const mode = envValue('VITE_AVIATION_PERSISTENCE_MODE');
  if (mode === 'api' || mode === 'firebase' || mode === 'disabled' || mode === 'localStorage') return mode;
  return 'localStorage';
}

export function getAviationEnvironmentMode(): AviationEnvironmentMode {
  const mode = envValue('VITE_AVIATION_ENVIRONMENT_MODE');
  if (mode === 'production' || mode === 'pilot' || mode === 'demo') return mode;
  return getAviationPersistenceMode() === 'api' ? 'pilot' : 'demo';
}

export function isAviationProductionMode(): boolean {
  return getAviationEnvironmentMode() === 'production';
}

export function isAviationApiEnabled(): boolean {
  return Boolean(getAviationApiBaseUrl()) && getAviationPersistenceMode() !== 'disabled';
}

export function isAviationApiRequired(): boolean {
  return envBoolean('VITE_AVIATION_API_REQUIRED') || isAviationProductionMode();
}

export function isAviationApiPersistenceEnabled(): boolean {
  return isAviationApiEnabled() && getAviationPersistenceMode() === 'api';
}

export function isAviationLiveProviderEnabled(provider: LiveProviderFlag): boolean {
  const keys: Record<LiveProviderFlag, keyof ImportMetaEnv> = {
    faa: 'VITE_AVIATION_ENABLE_LIVE_FAA',
    weather: 'VITE_AVIATION_ENABLE_LIVE_WEATHER',
    facilities: 'VITE_AVIATION_ENABLE_LIVE_FACILITIES',
    routing: 'VITE_AVIATION_ENABLE_LIVE_ROUTING',
    risk: 'VITE_AVIATION_ENABLE_LIVE_RISK',
    reports: 'VITE_AVIATION_ENABLE_LIVE_REPORTS',
  };
  return isAviationApiEnabled() && envBoolean(keys[provider]);
}

export function getAviationAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('fpi_aviation_auth_token') || window.localStorage.getItem('fpi_aviation_auth_token');
}
