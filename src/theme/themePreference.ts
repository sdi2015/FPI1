export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fpi-theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function getInitialThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedPreference) ? storedPreference : 'system';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

export function persistThemePreference(preference: ThemePreference): void {
  if (typeof window === 'undefined') return;
  if (preference === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
}
