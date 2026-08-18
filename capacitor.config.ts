import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jacy.sidequest',
  appName: 'SideQuest',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      // The plugin only posts a visible notification when one of these is set.
      // Without it, pushes are received but never shown.
      presentationOptions: ['alert', 'badge', 'sound'],
    },
  },
};

export default config;