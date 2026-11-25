import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><AuthProvider><App/></AuthProvider></React.StrictMode>);

if ('serviceWorker' in navigator && import.meta.env.PROD && !('__TAURI_INTERNALS__' in window)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
