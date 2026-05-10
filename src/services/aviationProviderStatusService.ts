import { aviationApiRequest, tryAviationApiRequest } from './aviationApiClient';
import { getAviationProviderConfig, type AviationProviderConfigItem, type AviationProviderName } from './aviationProviderConfig';

function normalizeProviderStatus(raw: unknown): AviationProviderConfigItem[] {
  if (Array.isArray(raw)) return raw as AviationProviderConfigItem[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { providers?: unknown }).providers)) return (raw as { providers: AviationProviderConfigItem[] }).providers;
  return getAviationProviderConfig();
}

export async function getAviationProviderStatus(): Promise<AviationProviderConfigItem[]> {
  const result = await tryAviationApiRequest<unknown>('/aviation/providers/status');
  return result ? normalizeProviderStatus(result) : getAviationProviderConfig();
}

export async function testAviationProviderConnection(providerName: AviationProviderName): Promise<{ ok: boolean; message: string }> {
  const result = await tryAviationApiRequest<{ ok?: boolean; message?: string }>(`/aviation/providers/${encodeURIComponent(providerName)}/test-connection`, { method: 'POST' });
  return { ok: Boolean(result?.ok), message: result?.message ?? 'Provider test endpoint is not configured.' };
}

export async function updateAviationProviderStatus(providerName: AviationProviderName, updates: Partial<AviationProviderConfigItem>): Promise<AviationProviderConfigItem> {
  return aviationApiRequest<AviationProviderConfigItem>(`/aviation/providers/${encodeURIComponent(providerName)}`, { method: 'PATCH', body: updates });
}
