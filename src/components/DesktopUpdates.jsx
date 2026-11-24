import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import DialogFrame from './ui/DialogFrame.jsx';
import ProfileMenu from './ProfileMenu.jsx';

export default function DesktopUpdates({ beforeInstall, onInstallingChange }) {
  const invoke = import.meta.env.PROD ? window.__TAURI__?.core?.invoke : undefined;
  const [available, setAvailable] = useState(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  useEffect(() => {
    if (!invoke) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (busy.current) return;
      busy.current = true;
      setChecking(true);
      try {
        const result = await invoke('check_app_update');
        if (!cancelled) setAvailable(result);
      } catch (reason) {
        if (!cancelled) setError(String(reason));
      } finally {
        busy.current = false;
        if (!cancelled) setChecking(false);
      }
    }, 1200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [invoke]);

  async function check() {
    setOpen(true);
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setError('');
    try {
      setAvailable(await invoke('check_app_update'));
    } catch (reason) {
      setError(String(reason));
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  async function install() {
    if (!available || busy.current) return;
    setError('');
    try {
      beforeInstall();
    } catch (reason) {
      setError(reason.message);
      return;
    }
    busy.current = true;
    setInstalling(true);
    onInstallingChange(true);
    try {
      await invoke('install_app_update', { version: available.version });
    } catch (reason) {
      setError(String(reason));
    } finally {
      busy.current = false;
      setInstalling(false);
      onInstallingChange(false);
    }
  }

  return <>
    {available && <button type="button" className="rail-button rail-update" title="Update verfügbar"
      aria-label={`Update verfügbar: Version ${available.version}`}
      onClick={() => { setError(''); setOpen(true); }}>
      <Download size={16}/>
    </button>}
    <ProfileMenu onCheckForUpdates={invoke ? check : undefined}/>
    <DialogFrame open={open} onOpenChange={value => { if (!installing) setOpen(value); }}
      title={available ? 'Update verfügbar' : 'App-Updates'}
      description={available ? `atelier ${available.version} kann installiert werden.` : 'Nach einer neuen Version von atelier suchen.'}>
      {available?.notes && <div className="update-notes">{available.notes}</div>}
      {checking && <p role="status">Suche nach Updates …</p>}
      {!checking && !available && !error && <p role="status">atelier ist auf dem neuesten Stand.</p>}
      {error && <p role="alert" className="chat-error">{error}</p>}
      <div className="dialog-actions">
        <button type="button" className="button button-outline" disabled={installing} onClick={() => setOpen(false)}>Später</button>
        {available && <button type="button" className="button button-primary" disabled={checking || installing} onClick={install}>
          {installing ? 'Update wird installiert …' : 'Aktualisieren und neu starten'}
        </button>}
      </div>
    </DialogFrame>
  </>;
}
