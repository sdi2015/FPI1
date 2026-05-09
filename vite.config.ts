import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules')) return 'vendor';
          if (
            normalized.includes('/src/pages/AviationCommandCenter') ||
            normalized.includes('/src/components/aviation/') ||
            normalized.includes('/src/services/aviation') ||
            normalized.includes('/src/services/airportService') ||
            normalized.includes('/src/services/faaService') ||
            normalized.includes('/src/services/weatherService') ||
            normalized.includes('/src/services/readinessActionService') ||
            normalized.includes('/src/services/facilityDataAdapter') ||
            normalized.includes('/src/types/aviation')
          ) return 'aviation';
          if (normalized.includes('/src/components/views/')) return 'service-views';
          return undefined;
        },
      },
    },
  },
});
