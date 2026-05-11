import { tryAviationApiRequest } from './aviationApiClient';
import { isAviationApiPersistenceEnabled, isAviationApiRequired } from './aviationRuntimeConfig';
import type { AviationBriefStatus, AviationGeneratedBrief } from '../types/aviation';

const STORAGE_KEY = 'fpi_aviation_generated_briefs_v1';

function readBriefs(): AviationGeneratedBrief[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AviationGeneratedBrief[] : [];
  } catch {
    return [];
  }
}

function writeBriefs(briefs: AviationGeneratedBrief[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(briefs.slice(0, 250)));
}

function localSaveBrief(brief: AviationGeneratedBrief): AviationGeneratedBrief {
  const briefs = readBriefs();
  const index = briefs.findIndex((item) => item.brief_id === brief.brief_id);
  if (index >= 0) briefs[index] = brief;
  else briefs.unshift(brief);
  writeBriefs(briefs);
  return brief;
}

export async function saveAviationBrief(brief: AviationGeneratedBrief): Promise<AviationGeneratedBrief> {
  if (isAviationApiPersistenceEnabled()) {
    const saved = await tryAviationApiRequest<AviationGeneratedBrief>('/aviation/briefs', { method: 'POST', body: brief });
    if (saved) return localSaveBrief(saved);
    if (isAviationApiRequired()) throw new Error('Unable to save aviation brief through the Aviation API.');
  }
  return localSaveBrief(brief);
}

export async function getAviationBriefs(): Promise<AviationGeneratedBrief[]> {
  if (isAviationApiPersistenceEnabled()) {
    const raw = await tryAviationApiRequest<unknown>('/aviation/briefs');
    const briefs = Array.isArray(raw) ? raw as AviationGeneratedBrief[] : raw && typeof raw === 'object' && Array.isArray((raw as { briefs?: unknown }).briefs) ? (raw as { briefs: AviationGeneratedBrief[] }).briefs : [];
    if (briefs.length || raw) {
      writeBriefs(briefs);
      return briefs.sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    }
    if (isAviationApiRequired()) throw new Error('Unable to load aviation briefs through the Aviation API.');
  }
  return readBriefs().sort((a, b) => b.generated_at.localeCompare(a.generated_at));
}

export async function updateAviationBriefStatus(briefId: string, status: AviationBriefStatus): Promise<AviationGeneratedBrief | null> {
  const existing = (await getAviationBriefs()).find((brief) => brief.brief_id === briefId);
  if (!existing) return null;
  const updated = { ...existing, status };
  return saveAviationBrief(updated);
}
