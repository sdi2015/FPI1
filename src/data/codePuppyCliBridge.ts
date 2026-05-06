import type { NovaConnectionState, NovaHealthResponse } from './novaConnectionTypes';

export const NOVA_HEALTH_ENDPOINT = 'http://localhost:8787/api/nova/health';
export const NOVA_START_ENDPOINT = 'http://localhost:8787/api/nova/start';
export const NOVA_MANUAL_START_COMMAND = 'npm run nova:start';

const baseOfflineState: NovaConnectionState = {
  status: 'offline',
  mode: 'unknown',
  endpoint: NOVA_HEALTH_ENDPOINT,
  message: 'NOVA requires the local agent service to be active.',
  manualStartCommand: NOVA_MANUAL_START_COMMAND,
};

export async function checkNovaHealth(): Promise<NovaConnectionState> {
  try {
    const response = await fetch(NOVA_HEALTH_ENDPOINT, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
    const payload = (await response.json()) as NovaHealthResponse;
    return {
      status: payload.status === 'online' ? 'online' : payload.status === 'demo' ? 'demo' : 'online',
      mode: payload.mode ?? 'live-cli',
      endpoint: NOVA_HEALTH_ENDPOINT,
      lastHealthCheck: payload.timestamp ?? new Date().toISOString(),
      version: payload.version,
      message: payload.message ?? 'Connected to Code Puppy CLI bridge.',
      manualStartCommand: NOVA_MANUAL_START_COMMAND,
    };
  } catch (error) {
    return {
      ...baseOfflineState,
      lastHealthCheck: new Date().toISOString(),
      error: friendlyConnectionError(error),
    };
  }
}

export async function startNovaAgent(): Promise<NovaConnectionState> {
  // Browser security prevents launching arbitrary local CLI commands directly.
  // Preferred production path: POST to a local trusted backend endpoint that owns
  // the predefined Code Puppy command and never accepts arbitrary shell input.
  try {
    const response = await fetch(NOVA_START_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Start endpoint returned ${response.status}`);
    const payload = (await response.json()) as NovaHealthResponse;
    return {
      status: payload.status === 'demo' ? 'demo' : 'online',
      mode: payload.mode ?? 'live-cli',
      endpoint: NOVA_START_ENDPOINT,
      lastHealthCheck: payload.timestamp ?? new Date().toISOString(),
      version: payload.version,
      message: payload.message ?? 'NOVA Online — Connected to Code Puppy CLI.',
      manualStartCommand: NOVA_MANUAL_START_COMMAND,
    };
  } catch (error) {
    // Demo-safe fallback: allow the UI demo to proceed while clearly labeling that
    // no real CLI bridge was started and no real Code Puppy execution occurred.
    return {
      status: 'demo',
      mode: 'demo',
      endpoint: NOVA_START_ENDPOINT,
      lastHealthCheck: new Date().toISOString(),
      message: 'NOVA Online — Demo Mode. Local Code Puppy CLI bridge was not reached; mock/demo responses are enabled.',
      error: friendlyConnectionError(error),
      manualStartCommand: NOVA_MANUAL_START_COMMAND,
    };
  }
}

export async function connectToNovaAgent(): Promise<NovaConnectionState> {
  const health = await checkNovaHealth();
  if (health.status === 'online' || health.status === 'demo') return health;
  return startNovaAgent();
}

export async function stopNovaAgent(current: NovaConnectionState): Promise<NovaConnectionState> {
  // TODO: Add a trusted POST /api/nova/stop endpoint if restart/stop is required.
  return {
    ...current,
    status: 'offline',
    mode: 'unknown',
    message: 'NOVA disconnected in the UI. The local bridge was not stopped by the browser.',
  };
}

function friendlyConnectionError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unable to reach the local NOVA agent bridge.';
}
