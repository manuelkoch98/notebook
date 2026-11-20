import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = {};
for (const name of ['.env', '.env.local']) {
  try {
    const source = await readFile(path.join(root, name), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && !match[1].startsWith('#')) localEnv[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch {}
}
const env = { ...localEnv, ...process.env };
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '', authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '', storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '', appId: env.VITE_FIREBASE_APP_ID || ''
};
const enabled = String(env.VITE_CLOUD_ENABLED || 'false').toLowerCase() === 'true' && Object.values(config).every(Boolean);
const publicDir = path.join(root, 'public');
await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, 'firebase-config.js'), `window.ATELIER_FIREBASE = ${JSON.stringify({ enabled, config })};\n`);
execFileSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: root, stdio: 'inherit', env: process.env });
