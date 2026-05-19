import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goldengroup7.thebride',
  appName: 'TheBride',
  webDir: 'www',
  server: {
    url: 'https://the-bride-web.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
