import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neteinstein.memoryclash',
  appName: 'Memory Clash',
  webDir: 'dist',
  backgroundColor: '#0b0d1a',
  android: {
    // O jogo é offline; não precisa de conteúdo misto nem de depuração em produção.
    allowMixedContent: false,
  },
};

export default config;
