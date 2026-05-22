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
  plugins: {
    PushNotifications: {
      // Show badge + play sound + show alert banner when app is in foreground
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
