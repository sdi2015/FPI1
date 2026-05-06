export type NovaConnectionStatus = 'offline' | 'connecting' | 'online' | 'demo' | 'error';
export type NovaConnectionMode = 'live-cli' | 'demo' | 'unknown';

export type NovaConnectionState = {
  status: NovaConnectionStatus;
  mode: NovaConnectionMode;
  endpoint: string;
  lastHealthCheck?: string;
  version?: string;
  message: string;
  error?: string;
  manualStartCommand: string;
};

export type NovaHealthResponse = {
  status?: NovaConnectionStatus;
  mode?: NovaConnectionMode;
  version?: string;
  timestamp?: string;
  message?: string;
};
