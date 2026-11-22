import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function devFirebaseConfig(mode) {
  if (mode === 'chat-preview') return { enabled: false };
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
  const enabled = env.VITE_CLOUD_ENABLED?.toLowerCase() === 'true'
    && Object.values(config).every(Boolean);
  return enabled ? { enabled, config } : { enabled };
}

function serveFirebaseConfig(mode) {
  return {
    name: 'dev-firebase-config',
    configureServer(server) {
      const config = devFirebaseConfig(mode);
      server.middlewares.use('/firebase-config.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript');
        response.setHeader('Cache-Control', 'no-store');
        response.end(`window.ATELIER_FIREBASE = ${JSON.stringify(config)};`);
      });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    command === 'serve' && ['chat-preview', 'desktop-dev'].includes(mode) && serveFirebaseConfig(mode),
  ],
  server: { host: '127.0.0.1', port: 4178, strictPort: true },
  preview: { host: '127.0.0.1', port: 4178, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true }
}));
