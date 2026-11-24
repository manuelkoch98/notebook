import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CircleUserRound, Download, LogOut, Settings2, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import DialogFrame from './ui/DialogFrame.jsx';
import UserAvatar from './UserAvatar.jsx';

function splitName(displayName = '') {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

export default function ProfileMenu({ onCheckForUpdates }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState('');
  const profileStorageKey = auth.user ? `atelier-profile-v1:${auth.user.uid}` : 'atelier-profile-v1:local';
  const nameStorageKey = auth.user ? `atelier-profile-name:${auth.user.uid}` : 'atelier-profile-name:local';
  const savedProfile = (() => { try { return JSON.parse(localStorage.getItem(profileStorageKey) || '{}'); } catch { return {}; } })();
  const initial = splitName(auth.user?.displayName || localStorage.getItem(nameStorageKey) || '');
  const [firstName, setFirstName] = useState(savedProfile.firstName || initial.first);
  const [lastName, setLastName] = useState(savedProfile.lastName || initial.last);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkedProviders, setLinkedProviders] = useState([]);
  const displayName = [firstName, lastName].filter(Boolean).join(' ');
  const initialLetter = (displayName || auth.user?.email || 'M').trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (dialog !== 'profile') return;
    const parsed = splitName(auth.user?.displayName || localStorage.getItem(nameStorageKey) || '');
    setFirstName(savedProfile.firstName || parsed.first);
    setLastName(savedProfile.lastName || parsed.last);
    setLinkedProviders(auth.user?.providerData?.map(provider => provider.providerId) || []);
    setLinkPassword('');
    setNotice('');
  }, [dialog]);

  async function linkProvider(action, successMessage) {
    setSaving(true); setNotice('');
    try {
      const result = await action();
      setLinkedProviders(result.user.providerData.map(provider => provider.providerId));
      setLinkPassword(''); setNotice(successMessage);
    } catch (error) {
      const messages = {
        'auth/credential-already-in-use': 'Diese Anmeldemethode gehört bereits zu einem anderen Firebase-Konto. Konten und Notizen werden nicht automatisch zusammengeführt.',
        'auth/email-already-in-use': 'Diese E-Mail-Adresse ist bereits mit einem anderen Firebase-Konto verbunden.',
        'auth/provider-already-linked': 'Diese Anmeldemethode ist bereits verknüpft.',
        'auth/weak-password': 'Das Passwort muss mindestens sechs Zeichen haben.',
        'auth/popup-closed-by-user': 'Das Google-Fenster wurde geschlossen.'
      };
      setNotice(messages[error?.code] || 'Anmeldemethode konnte nicht verknüpft werden. Bitte melde dich erneut an und versuche es noch einmal.');
    } finally { setSaving(false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    if (!cleanFirst) { setNotice('Bitte gib deinen Vornamen ein.'); return; }
    setSaving(true); setNotice('');
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify({ firstName: cleanFirst, lastName: cleanLast }));
      localStorage.setItem(nameStorageKey, [cleanFirst, cleanLast].filter(Boolean).join(' '));
      if (auth.user) await auth.updateProfile([cleanFirst, cleanLast].filter(Boolean).join(' '));
      setFirstName(cleanFirst); setLastName(cleanLast); setNotice('Profil gespeichert.');
      window.dispatchEvent(new CustomEvent('atelier-profile-updated'));
    } catch { setNotice('Profil konnte nicht gespeichert werden. Bitte prüfe deine Verbindung.'); }
    finally { setSaving(false); }
  }

  return <>
    <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="profile-trigger" aria-label="Profil und Konto" title="Profil und Konto"><UserAvatar user={auth.user} fallback={initialLetter}/></button></DropdownMenu.Trigger><DropdownMenu.Portal>
      <DropdownMenu.Content className="dropdown-menu profile-dropdown" side="top" align="end" sideOffset={8}>
        <div className="profile-menu-head"><UserAvatar user={auth.user} fallback={initialLetter} className="profile-small-avatar"/><div><strong>{displayName || auth.user?.email || 'Mein Profil'}</strong><span>{auth.user?.email || 'Lokaler Arbeitsbereich'}</span></div></div>
        <DropdownMenu.Separator className="menu-separator"/>
        <DropdownMenu.Item className="dropdown-item" onSelect={() => setDialog('profile')}><UserRound size={16}/> Profil</DropdownMenu.Item>
        <DropdownMenu.Item className="dropdown-item" onSelect={() => setDialog('settings')}><Settings2 size={16}/> Einstellungen</DropdownMenu.Item>
        {onCheckForUpdates && <DropdownMenu.Item className="dropdown-item" onSelect={onCheckForUpdates}><Download size={16}/> Nach Updates suchen</DropdownMenu.Item>}
        <DropdownMenu.Separator className="menu-separator"/>
        {auth.user ? <DropdownMenu.Item className="dropdown-item danger" onSelect={() => auth.signOut()}><LogOut size={16}/> Abmelden</DropdownMenu.Item> : <DropdownMenu.Item className="dropdown-item" onSelect={() => navigate('/login')}><CircleUserRound size={16}/> Anmelden</DropdownMenu.Item>}
      </DropdownMenu.Content>
    </DropdownMenu.Portal></DropdownMenu.Root>
    <DialogFrame open={Boolean(dialog)} onOpenChange={open => !open && setDialog('')} title={dialog === 'profile' ? 'Profil' : 'Einstellungen'} description={dialog === 'profile' ? 'Dein Name wird im Arbeitsbereich angezeigt.' : 'Arbeitsbereich und Tastenkürzel.'}>
        {dialog === 'profile' ? <form className="profile-form" onSubmit={saveProfile}>
          <UserAvatar user={auth.user} fallback={initialLetter} className="profile-avatar-preview"/>
          <label>Vorname<input autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="Vorname"/></label>
          <label>Nachname<input autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} placeholder="Nachname"/></label>
          {auth.user && <p className="profile-email">{auth.user.email}</p>}
          {auth.user && <section className="auth-methods"><strong>Anmeldemethoden</strong>
            {linkedProviders.includes('google.com') ? <p className="profile-email">Google ist verknüpft.</p> : <button type="button" className="button button-outline" disabled={saving} onClick={() => linkProvider(auth.linkGoogle, 'Google wurde mit diesem Konto verknüpft.')}>Google mit diesem Konto verknüpfen</button>}
            {linkedProviders.includes('password') ? <p className="profile-email">E-Mail und Passwort sind verknüpft.</p> : <div className="auth-link-password"><label htmlFor="link-password">Passwort hinzufügen</label><input id="link-password" type="password" autoComplete="new-password" minLength={6} value={linkPassword} onChange={event => setLinkPassword(event.target.value)} placeholder="Mindestens 6 Zeichen"/><button type="button" className="button button-outline" disabled={saving || linkPassword.length < 6} onClick={() => linkProvider(() => auth.linkEmailPassword(linkPassword), 'E-Mail und Passwort wurden mit diesem Konto verknüpft.')}>E-Mail und Passwort verknüpfen</button></div>}
          </section>}
          {notice && <p className="profile-notice" role="status">{notice}</p>}
          <button className="button button-primary" disabled={saving}>{saving ? 'Speichert …' : 'Profil speichern'}</button>
        </form> : <div className="profile-details"><div className="settings-row"><span>Neue Notiz</span><kbd>⌘ / Ctrl + N</kbd></div><div className="settings-row"><span>Befehlspalette</span><kbd>⌘ / Ctrl + K</kbd></div><div className="settings-row"><span>Suche</span><kbd>⌘ / Ctrl + Shift + F</kbd></div></div>}
    </DialogFrame>
  </>;
}
