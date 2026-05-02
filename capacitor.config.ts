import type { CapacitorConfig } from '@capacitor/cli';

const devConfig: Partial<CapacitorConfig> = {
  server: {
    url: 'http://127.0.0.1:3000',
    cleartext: true,
  },
};

const config: CapacitorConfig = {
  appId: 'com.vortexventures.vortexmc',
  appName: 'Vortex MC',
  webDir: 'out',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Vortex MC',
  },
  ...(process.env.NODE_ENV !== 'production' ? devConfig : {
    server: {
      url: process.env.CAPACITOR_SERVER_URL || 'http://127.0.0.1:3000',
    },
  }),
};

export default config;
