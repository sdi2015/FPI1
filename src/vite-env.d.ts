/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AVIATION_API_BASE_URL?: string;
  readonly VITE_AVIATION_PERSISTENCE_MODE?: 'localStorage' | 'api' | 'firebase' | 'disabled';
  readonly VITE_AVIATION_ENVIRONMENT_MODE?: 'demo' | 'pilot' | 'production';
  readonly VITE_AVIATION_API_REQUIRED?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_FAA?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_WEATHER?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_FACILITIES?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_ROUTING?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_RISK?: string;
  readonly VITE_AVIATION_ENABLE_LIVE_REPORTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
