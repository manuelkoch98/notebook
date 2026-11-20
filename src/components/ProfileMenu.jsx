import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { CircleUserRound, LogOut, Settings2, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';

export default function ProfileMenu() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState('');
  const user = auth.user;
  const initial = (user?.displayName || user?.email || 'M').trim().charAt(0).toUpperCase();
  return <>
    <DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="profile-trigger" aria-label="Profil und Konto" title="Profil und Konto">{user?.photoURL ? <img src={user.photoURL} alt=""/> : initial}</button></DropdownMenu.Trigger><DropdownMenu.Portal>
      <DropdownMenu.Content className="dropdown-menu profile-dropdown" side="top" align="end" sideOffset={8}>
        <div className="profile-menu-head"><span className="profile-small-avatar">{initial}</span><div><strong>{user?.displayName || 'Mein Profil'}</strong><span>{user?.email || 'Lokaler Arbeitsbereich'}</span></div></div>
        <DropdownMenu.Separator className="menu-separator"/>
        <DropdownMenu.Item className="dropdown-item" onSelect={() => setDialog('profile')}><UserRound size={16}/> Profil</DropdownMenu.Item>
        <DropdownMenu.Item className="dropdown-item" onSelect={() => setDialog('settings')}><Settings2 size={16}/> Einstellungen</DropdownMenu.Item>
        <DropdownMenu.Separator className="menu-separator"/>
        {user ? <DropdownMenu.Item className="dropdown-item danger" onSelect={() => auth.signOut()}><LogOut size={16}/> Abmelden</DropdownMenu.Item> : auth.enabled && <DropdownMenu.Item className="dropdown-item" onSelect={() => navigate('/login')}><CircleUserRound size={16}/> Anmelden</DropdownMenu.Item>}
      </DropdownMenu.Content>
    </DropdownMenu.Portal></DropdownMenu.Root>
    <Dialog.Root open={Boolean(dialog)} onOpenChange={open => !open && setDialog('')}>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
        <div className="dialog-titlebar"><div><Dialog.Title>{dialog === 'profile' ? 'Profil' : 'Einstellungen'}</Dialog.Title><Dialog.Description>{dialog === 'profile' ? 'Kontoinformationen für Atelier.' : 'Arbeitsbereich und Tastenkürzel.'}</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="Schließen"><X size={16}/></button></Dialog.Close></div>
        {dialog === 'profile' ? <div className="profile-details"><span className="profile-large-avatar">{initial}</span><div><strong>{user?.displayName || 'Manuel Koch'}</strong><span>{user?.email || 'Lokaler Modus'}</span></div><div className="settings-row"><span>Speicher</span><span>{user ? 'Angemeldet · lokal gespeichert' : 'Lokal auf diesem Gerät'}</span></div></div> : <div className="profile-details"><div className="settings-row"><span>Neue Notiz</span><kbd>⌘ / Ctrl + N</kbd></div><div className="settings-row"><span>Befehlspalette</span><kbd>⌘ / Ctrl + K</kbd></div><div className="settings-row"><span>Suche</span><kbd>⌘ / Ctrl + Shift + F</kbd></div></div>}
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
