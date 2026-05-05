import type { FireAlarmSite } from './fireAlarmTypes';
import { getScopedStoreIds, hasEmptyStoreScope, type StoreScopeState } from './storeScope';

export function getScopedSiteKeys(sites: FireAlarmSite[], scope: StoreScopeState): string[] {
  if (scope.mode === 'all') return sites.map((site) => site.id).filter(Boolean).sort();
  if (hasEmptyStoreScope(scope)) return [];
  return getScopedStoreIds(sites, scope).filter(Boolean).sort();
}

export function projectItemsToStoreScope<T>(items: T[], sites: FireAlarmSite[], scope: StoreScopeState): T[] {
  if (scope.mode === 'all') return items;
  if (hasEmptyStoreScope(scope) || items.length === 0) return [];

  const scopedSiteKeys = getScopedSiteKeys(sites, scope);
  if (scopedSiteKeys.length === 0) return [];

  return selectItemsByKeys(items, scopedSiteKeys);
}

export function selectItemsByKeys<T>(items: T[], keys: string[]): T[] {
  if (items.length === 0 || keys.length === 0) return [];

  const selectedIndexes = new Set<number>();
  for (const key of keys) {
    selectedIndexes.add(hashToIndex(key, items.length));
    if (selectedIndexes.size === items.length) break;
  }

  // If the region selection contains more stores than the projected data population,
  // include the full available dataset instead of creating duplicated rows.
  if (keys.length >= items.length) return items;

  return Array.from(selectedIndexes)
    .sort((a, b) => a - b)
    .map((index) => items[index]);
}

function hashToIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
}
