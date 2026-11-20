import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const localEnv = {};
for (const name of ['.env', '.env.local']) {
  try {
    const text = await readFile(path.join(root, name), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !match[1].startsWith('#')) localEnv[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}
const env = { ...localEnv, ...process.env };
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || ''
};
const firebaseEnabled = String(env.VITE_CLOUD_ENABLED || 'false').toLowerCase() === 'true' && Object.values(firebaseConfig).every(Boolean);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'firebase-auth.js', 'manifest.webmanifest', 'icon.svg', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png']) {
  const destination = path.join(out, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(root, file), destination);
}
await writeFile(path.join(out, 'firebase-config.js'), `window.ATELIER_FIREBASE = ${JSON.stringify({ enabled: firebaseEnabled, config: firebaseConfig })};\n`);
console.log(`Atelier static app copied to ${out}`);
