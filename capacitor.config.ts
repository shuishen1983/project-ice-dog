import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.projectice.game',
  appName: 'Project ICE',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
};

export default config;
