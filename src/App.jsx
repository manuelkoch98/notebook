import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Command, FilePlus2, FileText, Search, Share2, PanelLeft, X, Plus, Network, Pencil, Download, CircleHelp } from 'lucide-react';
import { useAuth } from './auth/AuthProvider.jsx';
import FileTree from './components/FileTree.jsx';
import LoginPage from './components/LoginPage.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';

const DB_KEY = 'atelier-db-v1';
const freshVault = () => ({ id: 'main', name: 'Mein Wissensgarten', folders: ['Ideen', 'Notizen'], notes: [
  { id: 'welcome-note', title: 'Willkommen in Atelier', path: 'Willkommen in Atelier.md', body: '## Ein guter Ort für deine Gedanken\n\nAtelier ist deine persönliche Markdown-Wissenswerkstatt. Verbinde Notizen mit **[[Wikilinks]]** und finde Gedanken später mit der Suche wieder.\n\n### Dein erster Schritt\n\n- Schreib eine Notiz\n- Verknüpfe sie mit `[[einer anderen Notiz]]`\n- Nutze #ideen für ein Tag\n', created: Date.now(), updated: Date.now() },
  { id: 'wikilinks', title: 'Wikilinks', path: 'Ideen/Wikilinks.md', body: '## Gedanken verbinden\n\nEin Link wie [[Willkommen in Atelier]] verbindet diese Notiz mit deiner Startseite.\n\n#verbindungen', created: Date.now(), updated: Date.now() }
] });
function initialDB(key = DB_KEY) {
  try { const value = JSON.parse(localStorage.getItem(key)); if (value?.vaults?.length) return value; }
  catch {}
  return { vaults: [freshVault()] };
}
function uniqueNoteTitle(vault) {
  let title = 'Neue Notiz'; let counter = 2;
  while (vault.notes.some(note => note.path.toLowerCase() === `${title}.md`.toLowerCase())) title = `Neue Notiz ${counter++}`;
  return title;
}
const uid = () => crypto.randomUUID();
const cleanTitle = value => value.trim().replace(/\.md$/i, '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || 'Unbenannt';
const parentPath = value => value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : '';
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function AuthGate({ children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <div className="page-loader"><span className="spinner"/> Atelier wird geöffnet …</div>;
  if (auth.error) return <div className="page-loader error-page">{auth.error}<Link to="/login">Anmeldung öffnen</Link></div>;
  if (auth.enabled && !auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  return children;
}

function LoginRoute() {
  const auth = useAuth();
  if (auth.loading) return <div className="page-loader"><span className="spinner"/> Verbindung zu Atelier …</div>;
  if (!auth.enabled || auth.user) return <Navigate to="/" replace/>;
  return <LoginPage/>;
}

function DialogFrame({ open, onOpenChange, title, description, children }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content">
    <div className="dialog-titlebar"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close asChild><button className="icon-button" aria-label="Schließen"><X size={16}/></button></Dialog.Close></div>{children}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function Workspace() {
  const auth = useAuth();
  const navigate = useNavigate();
  const cacheKey = auth.user ? `${DB_KEY}:${auth.user.uid}` : DB_KEY;
  const [db, setDb] = useState(() => initialDB(cacheKey));
  const [vaultId, setVaultId] = useState(() => initialDB(cacheKey).vaults[0]?.id || 'main');
  const [activeId, setActiveId] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [collapsed, setCollapsed] = useState(new Set());
  const [mode, setMode] = useState('read');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dialog, setDialog] = useState('');
  const [field, setField] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Lokal zwischengespeichert');
  const [, setProfileVersion] = useState(0);
  const editorRef = useRef(null);
  const noteInputRef = useRef(null);
  const vault = db.vaults.find(item => item.id === vaultId) || db.vaults[0];
  const activeNote = vault?.notes.find(note => note.id === activeId) || null;
  const dbRef = useRef(db);
  dbRef.current = db;
  const profileGreeting = auth.user ? localStorage.getItem(`atelier-profile-name:${auth.user.uid}`) : localStorage.getItem('atelier-profile-name:local');

  useEffect(() => { localStorage.setItem(cacheKey, JSON.stringify(db)); }, [cacheKey, db]);
  useEffect(() => { const update = () => setProfileVersion(value => value + 1); window.addEventListener('atelier-profile-updated', update); return () => window.removeEventListener('atelier-profile-updated', update); }, []);
  useEffect(() => { const refresh = () => setDb(current => ({ ...current, vaults: [...current.vaults] })); window.addEventListener('online', refresh); return () => window.removeEventListener('online', refresh); }, []);
  useEffect(() => { if (activeNote) { setBody(activeNote.body); setTitle(activeNote.title); } }, [activeId, activeNote?.body, activeNote?.title]);
  useEffect(() => {
    if (!auth.user || !auth.db || !auth.firestoreSdk) { setCloudReady(false); setCloudStatus(auth.user ? 'Firebase wird verbunden …' : 'Lokal zwischengespeichert'); return; }
    const fs = auth.firestoreSdk;
    const root = fs.collection(auth.db, 'users', auth.user.uid, 'vaults');
    let cancelled = false;
    let rootUnsubscribe;
    const noteUnsubscribes = new Map();
    const noteSnapshots = new Map();
    const readyVaults = new Set();
    let latestVaultDocs = [];
    let initializing = false;

    const applyCloudSnapshot = (vaultDocs) => {
      if (cancelled || !vaultDocs.length || vaultDocs.some(item => !readyVaults.has(item.id))) return;
      const cloudVaults = vaultDocs.map(item => {
        const local = dbRef.current.vaults.find(vault => vault.id === item.id);
        const remoteNotes = noteSnapshots.get(item.id) || [];
        const notes = remoteNotes.map(note => {
          const localNote = local?.notes.find(candidate => candidate.id === note.id);
          const dirty = localNote && localNote.baseUpdatedAt !== undefined && (localNote.body !== localNote.baseBody || localNote.title !== localNote.baseTitle || localNote.path !== localNote.basePath);
          return dirty ? localNote : { ...note, baseUpdatedAt: note.updatedAt, baseBody: note.body, baseTitle: note.title, basePath: note.path };
        });
        const remoteIds = new Set(remoteNotes.map(note => note.id));
        const pendingLocal = (local?.notes || []).filter(note => !remoteIds.has(note.id) && (note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath));
        return { id: item.id, name: item.data.name || 'Mein Wissensgarten', folders: item.data.folders || [], notes: [...notes, ...pendingLocal] };
      });
      if (cloudVaults.length) {
        setDb(current => JSON.stringify(current) === JSON.stringify({ vaults: cloudVaults }) ? current : { vaults: cloudVaults });
        setVaultId(current => cloudVaults.some(item => item.id === current) ? current : cloudVaults[0].id);
        setCloudReady(true);
        setCloudStatus('Mit Firebase synchronisiert');
      }
    };

    rootUnsubscribe = fs.onSnapshot(root, async snapshot => {
      if (cancelled) return;
      if (snapshot.empty && !initializing) {
        initializing = true;
        try {
          await Promise.all(db.vaults.map(async item => {
            const vaultRef = fs.doc(root, item.id);
            await fs.setDoc(vaultRef, { name: item.name, folders: item.folders || [], updatedAt: Date.now() });
            const notesRef = fs.collection(vaultRef, 'notes');
            await Promise.all(item.notes.map(note => fs.setDoc(fs.doc(notesRef, note.id), { id: note.id, title: note.title, path: note.path, body: note.body, created: note.created, updated: note.updated, updatedAt: note.updated || Date.now() })));
          }));
        } catch (error) { if (!cancelled) setCloudStatus('Firebase-Speicherung fehlgeschlagen'); }
        return;
      }
      const docs = snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
      latestVaultDocs = docs;
      const currentIds = new Set(docs.map(item => item.id));
      for (const [id, unsubscribe] of noteUnsubscribes) if (!currentIds.has(id)) { unsubscribe(); noteUnsubscribes.delete(id); readyVaults.delete(id); noteSnapshots.delete(id); }
      for (const item of docs) if (!noteUnsubscribes.has(item.id)) {
        const notesRef = fs.collection(root, item.id, 'notes');
        noteUnsubscribes.set(item.id, fs.onSnapshot(notesRef, notes => {
          noteSnapshots.set(item.id, notes.docs.map(note => ({ id: note.id, ...note.data(), baseUpdatedAt: note.data().updatedAt, baseBody: note.data().body, baseTitle: note.data().title, basePath: note.data().path })));
          readyVaults.add(item.id);
          applyCloudSnapshot(latestVaultDocs);
        }, () => setCloudStatus('Firebase konnte Notizen nicht laden')));
      }
      if (!docs.length && initializing) { setCloudReady(true); }
    }, () => { if (!cancelled) setCloudStatus('Firebase-Verbindung fehlgeschlagen'); });

    return () => { cancelled = true; rootUnsubscribe?.(); noteUnsubscribes.forEach(unsubscribe => unsubscribe()); };
    // Local data is used only to seed an account with an empty cloud vault.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.uid, auth.db, auth.firestoreSdk]);

  useEffect(() => {
    if (!cloudReady || !auth.user || !auth.db || !auth.firestoreSdk) return;
    const fs = auth.firestoreSdk;
    const root = fs.collection(auth.db, 'users', auth.user.uid, 'vaults');
    const timer = window.setTimeout(async () => {
      setCloudStatus('Änderungen werden synchronisiert …');
      let conflictsSaved = 0;
      try {
        for (const item of db.vaults) {
          const vaultRef = fs.doc(root, item.id);
          const metadata = { name: item.name, folders: item.folders || [] };
          const metadataSnapshot = await fs.getDoc(vaultRef);
          const existingMetadata = metadataSnapshot.exists() ? metadataSnapshot.data() : {};
          if (!metadataSnapshot.exists() || existingMetadata.name !== metadata.name || JSON.stringify(existingMetadata.folders || []) !== JSON.stringify(metadata.folders))
            await fs.setDoc(vaultRef, { ...metadata, updatedAt: Date.now() }, { merge: true });
          const notesRef = fs.collection(vaultRef, 'notes');
          const remote = await fs.getDocs(notesRef);
          const localIds = new Set(item.notes.map(note => note.id));
          await Promise.all(remote.docs.filter(note => !localIds.has(note.id)).map(note => fs.deleteDoc(note.ref)));
          const normalized = note => ({ id: note.id, title: note.title, path: note.path, body: note.body, created: note.created, updated: note.updated });
          for (const note of item.notes) {
            const noteRef = fs.doc(notesRef, note.id);
            const result = await fs.runTransaction(auth.db, async transaction => {
              const snapshot = await transaction.get(noteRef);
              const existing = snapshot.exists() ? snapshot.data() : null;
              const localChanged = note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath;
              const remoteChanged = existing && note.baseUpdatedAt !== undefined && existing.updatedAt !== note.baseUpdatedAt;
              const now = Date.now();
              if (remoteChanged && localChanged && (existing.body !== note.body || existing.title !== note.title || existing.path !== note.path)) {
                const conflictId = uid();
                const conflictTitle = cleanTitle(`${note.title} (Konflikt ${new Date(now).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })})`);
                const conflictPath = `${parentPath(note.path) ? `${parentPath(note.path)}/` : ''}${conflictTitle}.md`;
                transaction.set(fs.doc(notesRef, conflictId), { ...normalized({ ...note, id: conflictId, title: conflictTitle, path: conflictPath }), updatedAt: now });
                return { conflict: true, now, remote: existing, conflictId, conflictTitle, conflictPath };
              }
              if (!existing || existing.body !== note.body || existing.title !== note.title || existing.path !== note.path || existing.updated !== note.updated) {
                transaction.set(noteRef, { ...normalized(note), updatedAt: now }, { merge: true });
                return { conflict: false, now };
              }
              return { conflict: false, now: existing.updatedAt };
            });
            if (result.conflict) {
              conflictsSaved += 1;
              setDb(current => ({ vaults: current.vaults.map(vault => {
                if (vault.id !== item.id) return vault;
                const existingNote = vault.notes.find(candidate => candidate.id === note.id);
                const remoteNote = { id: note.id, ...result.remote, baseUpdatedAt: result.remote.updatedAt, baseBody: result.remote.body, baseTitle: result.remote.title, basePath: result.remote.path };
                const conflictNote = { ...note, id: result.conflictId, title: result.conflictTitle, path: result.conflictPath, updated: result.now, baseUpdatedAt: result.now, baseBody: note.body, baseTitle: result.conflictTitle, basePath: result.conflictPath };
                return { ...vault, notes: [...vault.notes.map(candidate => candidate.id === note.id ? remoteNote : candidate), ...(existingNote ? [] : [remoteNote]), conflictNote] };
              }) }));
            } else {
              setDb(current => {
                let changed = false;
                const vaults = current.vaults.map(vault => {
                  if (vault.id !== item.id) return vault;
                  let vaultChanged = false;
                  const notes = vault.notes.map(existing => {
                    if (existing.id !== note.id || (existing.baseUpdatedAt === result.now && existing.baseBody === note.body && existing.baseTitle === note.title && existing.basePath === note.path)) return existing;
                    changed = true; vaultChanged = true;
                    return { ...existing, baseUpdatedAt: result.now, baseBody: note.body, baseTitle: note.title, basePath: note.path };
                  });
                  return vaultChanged ? { ...vault, notes } : vault;
                });
                return changed ? { ...current, vaults } : current;
              });
            }
          }
        }
        setCloudStatus(conflictsSaved ? 'Konflikt gesichert: beide Textfassungen bleiben erhalten' : 'Mit Firebase synchronisiert');
      } catch (error) { setCloudStatus('Offline · Änderungen warten auf Synchronisierung'); }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [db, cloudReady, auth.user, auth.db, auth.firestoreSdk]);
  useEffect(() => {
    const handler = event => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchText(''); setSearchOpen(true); }
      else if (event.key.toLowerCase() === 'n') { event.preventDefault(); createNote(); }
      else if (event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setSearchText(''); setSearchOpen(true); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  function updateVault(updater) {
    setDb(current => ({ ...current, vaults: current.vaults.map(item => item.id === vaultId ? updater(item) : item) }));
  }
  function notify(message) { setToast(message); window.setTimeout(() => setToast(''), 2300); }
  function openNote(id, nextMode = 'read') {
    const note = vault.notes.find(item => item.id === id); if (!note) return;
    setActiveId(id); setTitle(note.title); setBody(note.body); setTabs(current => current.includes(id) ? current : [...current, id]); setMode(nextMode); setSidebarOpen(false);
  }
  function createNote() {
    const name = uniqueNoteTitle(vault);
    const note = { id: uid(), title: name, path: `${name}.md`, body: '', created: Date.now(), updated: Date.now() };
    updateVault(current => ({ ...current, notes: [...current.notes, note] }));
    setActiveId(note.id); setTabs(current => [...current, note.id]); setTitle(note.title); setBody(''); setMode('edit');
    window.setTimeout(() => noteInputRef.current?.focus(), 0);
  }
  function updateBody(value) {
    setBody(value);
    if (!activeId) return;
    updateVault(current => ({ ...current, notes: current.notes.map(note => note.id === activeId ? { ...note, body: value, updated: Date.now() } : note) }));
  }
  function renameNote(id, rawTitle) {
    const nextTitle = cleanTitle(rawTitle);
    const current = vault.notes.find(note => note.id === id);
    if (!current) return;
    const nextPath = `${parentPath(current.path) ? `${parentPath(current.path)}/` : ''}${nextTitle}.md`;
    if (vault.notes.some(note => note.id !== id && note.path.toLowerCase() === nextPath.toLowerCase())) return notify('Eine Notiz mit diesem Namen existiert bereits.');
    updateVault(current => {
      const target = current.notes.find(note => note.id === id); if (!target) return current;
      const previousTitle = target.title;
      const folder = parentPath(target.path);
      const linkPattern = new RegExp(`\\[\\[${escapeRegExp(previousTitle)}(?=[\\]|#])`, 'g');
      return { ...current, notes: current.notes.map(note => note.id === id ? { ...note, title: nextTitle, path: nextPath, updated: Date.now() } : { ...note, body: note.body.replace(linkPattern, `[[${nextTitle}`) }) };
    });
    if (activeId === id) setTitle(nextTitle);
    notify(`„${nextTitle}“ umbenannt`);
  }
  function commitTitle() {
    if (!activeNote || !title.trim() || title === activeNote.title) return;
    renameNote(activeNote.id, title);
  }
  function deleteNote(id) {
    const note = vault.notes.find(item => item.id === id); if (!note) return;
    if (!window.confirm(`„${note.title}“ löschen?`)) return;
    updateVault(current => ({ ...current, notes: current.notes.filter(item => item.id !== id) }));
    setTabs(current => current.filter(item => item !== id));
    if (activeId === id) { setActiveId(null); setTitle(''); setBody(''); }
    notify('Notiz gelöscht');
  }
  function moveNote(id, folder) {
    const target = vault.notes.find(note => note.id === id); if (!target) return;
    const nextPath = `${folder ? `${folder}/` : ''}${target.path.split('/').pop()}`;
    if (vault.notes.some(note => note.id !== id && note.path.toLowerCase() === nextPath.toLowerCase())) return notify('In diesem Ordner gibt es bereits eine Datei mit diesem Namen.');
    updateVault(current => ({ ...current, notes: current.notes.map(note => note.id === id ? { ...note, path: `${folder ? `${folder}/` : ''}${note.path.split('/').pop()}`, updated: Date.now() } : note) }));
    notify(folder ? `In „${folder}“ verschoben` : 'Auf die Hauptebene verschoben');
  }
  function addFolder() {
    const name = cleanTitle(field.trim()); if (!field.trim()) return;
    updateVault(current => ({ ...current, folders: [...new Set([...current.folders, name])] })); setField(''); setDialog(''); notify(`Ordner „${name}“ erstellt`);
  }
  function addVault() {
    if (!field.trim()) return;
    const item = { id: uid(), name: field.trim(), folders: [], notes: [] };
    setDb(current => ({ ...current, vaults: [...current.vaults, item] })); setVaultId(item.id); setActiveId(null); setTabs([]); setField(''); setDialog('');
  }
  function startNewFolder() { setField(''); setDialog('folder'); }
  function exportNote(note) {
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([note.body], { type: 'text/markdown;charset=utf-8' }));
    link.download = note.path.split('/').pop(); link.click(); URL.revokeObjectURL(link.href);
  }
  function exportVault() { vault.notes.forEach((note, index) => window.setTimeout(() => exportNote(note), index * 180)); notify(`${vault.notes.length} Markdown-Dateien exportiert`); }
  async function importFiles(files) {
    const imported = [];
    for (const file of files) {
      if (!/\.(md|markdown|txt)$/i.test(file.name)) continue;
      const rel = file.webkitRelativePath?.split('/').slice(1).join('/') || file.name;
      const path = rel.replace(/\.(markdown|txt)$/i, '.md'); const noteTitle = cleanTitle(path.split('/').pop());
      imported.push({ id: uid(), title: noteTitle, path, body: await file.text(), created: Date.now(), updated: Date.now() });
    }
    if (!imported.length) { setDialog(''); return notify('Keine Markdown-Dateien gefunden'); }
    updateVault(current => ({ ...current, notes: [...current.notes.filter(note => !imported.some(item => item.path === note.path)), ...imported], folders: [...new Set([...current.folders, ...imported.flatMap(note => { const parts = parentPath(note.path).split('/').filter(Boolean); return parts.map((_, index) => parts.slice(0, index + 1).join('/')); })])] }));
    setDialog('');
    notify(`${imported.length} Datei(en) importiert`);
  }
  function dragStart(event, note) {
    event.dataTransfer.setData('application/x-atelier-note', note.id);
    event.dataTransfer.setData('text/plain', `[[${note.title}]]`);
    event.dataTransfer.effectAllowed = 'copyMove';
  }
  function dropInEditor(event) {
    const id = event.dataTransfer.getData('application/x-atelier-note');
    const linked = vault.notes.find(note => note.id === id); if (!linked || !activeNote) return;
    event.preventDefault();
    const editor = editorRef.current; const insertion = `[[${linked.title}]]`;
    const start = editor?.selectionStart ?? body.length; const end = editor?.selectionEnd ?? start;
    const prefix = !editor && body.length && !body.endsWith('\n') ? '\n' : '';
    const textToInsert = `${prefix}${insertion}`;
    const next = `${body.slice(0, start)}${textToInsert}${body.slice(end)}`;
    updateBody(next); setMode('edit');
    requestAnimationFrame(() => { const target = editorRef.current; target?.focus(); target?.setSelectionRange(start + textToInsert.length, start + textToInsert.length); });
  }
  function resolveWiki(target) {
    let note = vault.notes.find(item => item.title.toLowerCase() === target.toLowerCase() || item.path.replace(/\.md$/i, '').toLowerCase() === target.toLowerCase());
    if (!note) {
      note = { id: uid(), title: cleanTitle(target), path: `${cleanTitle(target)}.md`, body: '', created: Date.now(), updated: Date.now() };
      updateVault(current => ({ ...current, notes: [...current.notes, note] }));
    }
    openNote(note.id);
  }
  function pickFile(event) { importFiles([...event.target.files]); event.target.value = ''; }
  function selectResult(note) { openNote(note.id); setSearchOpen(false); }

  const backlinks = useMemo(() => activeNote ? vault.notes.filter(note => note.id !== activeNote.id && note.body.toLowerCase().includes(`[[${activeNote.title.toLowerCase()}`)) : [], [vault, activeNote]);
  const results = useMemo(() => {
    const query = searchText.toLowerCase();
    return vault.notes.filter(note => !query || `${note.title}\n${note.body}`.toLowerCase().includes(query));
  }, [vault, searchText]);
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`} onPointerDown={event => { if (mode === 'edit' && activeNote && !event.target.closest('.note-view')) setMode('read'); }}>
    <aside className="rail"><Link to="/" className="brand-mark" aria-label="Atelier Startseite" onClick={() => { setActiveId(null); setTabs([]); }}><span>a</span><i>.</i></Link><button className="rail-button active" title="Dateien" onClick={() => setSidebarOpen(open => !open)}><PanelLeft size={17}/></button><button className="rail-button" title="Suche" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={17}/></button><button className="rail-button" title="Graph" onClick={() => setGraphOpen(true)}><Network size={17}/></button><div className="rail-spacer"/><button className="rail-button" title="Befehlspalette" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Command size={17}/></button><ProfileMenu/></aside>
    <aside className="sidebar">
      <div className="workspace-head"><div className="workspace-identity"><span className="workspace-caption">ARBEITSBEREICH</span><select className="workspace-select" value={vault.id} aria-label="Vault auswählen" onChange={event => { if (event.target.value === '__new__') { setField(''); setDialog('vault'); } else { setVaultId(event.target.value); setActiveId(null); setTabs([]); } }}>
        {db.vaults.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="__new__">＋ Neuer Vault</option>
      </select></div><button className="icon-button" aria-label="Neuen Vault erstellen" title="Neuen Vault erstellen" onClick={() => { setField(''); setDialog('vault'); }}><Plus size={19}/></button></div>
      <FileTree vault={vault} activeId={activeId} collapsed={collapsed} setCollapsed={setCollapsed} onOpen={openNote} onRename={renameNote} onDelete={deleteNote} onMove={moveNote} onExport={exportNote} onCreateNote={createNote} onCreateFolder={startNewFolder} onImport={() => setDialog('import')} onExportVault={exportVault} onDragStart={dragStart}/>
      <div className="sidebar-status"><span className={`status-dot${auth.user && !cloudReady ? ' syncing' : ''}`}/><span>{auth.user ? cloudStatus : 'Lokal zwischengespeichert'}</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>{vault.name}</span><span className="crumb-sep">/</span><strong>{activeNote?.title || 'Willkommen'}</strong></div><div className="topbar-actions"><button className="button button-ghost top-action" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={16}/><span>Suchen</span><kbd>⌘ K</kbd></button><button className="button button-outline top-action" onClick={exportVault}><Share2 size={15}/> Exportieren</button></div></header>
      <div className="tabs">{tabs.map(id => { const note = vault.notes.find(item => item.id === id); return note && <button key={id} className={`tab${activeId === id ? ' active' : ''}`} onClick={() => openNote(id)}><FileText size={14}/><span>{note.title}</span><span role="button" aria-label="Tab schließen" className="tab-close" onClick={event => { event.stopPropagation(); setTabs(current => current.filter(tab => tab !== id)); if (activeId === id) { const next = tabs.filter(tab => tab !== id).at(-1); next ? openNote(next) : setActiveId(null); } }}>×</span></button>; })}</div>
      <div className="content-wrap">
        <section className="editor-pane" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) event.preventDefault(); }}>
          {!activeNote ? <div className="welcome-view"><p className="eyebrow">DEIN DIGITALER GARTEN</p><h1>Hallo <em>{(profileGreeting || auth.user?.displayName || 'Manuel').trim().split(/\s+/)[0]}.</em></h1><p className="welcome-copy">Ein ruhiger Ort für Gedanken, Wissen und alles, was du nicht vergessen möchtest.</p><div className="welcome-actions"><button className="button button-primary" onClick={createNote}><FilePlus2 size={16}/> Erste Notiz schreiben</button><button className="button button-outline" onClick={() => setDialog('import')}><Download size={15}/> Vault importieren</button></div><div className="welcome-divider"/><div className="recent-head"><div><p className="eyebrow">LOS GEHT’S</p><h2>Dein Arbeitsbereich</h2></div><span className="local-badge"><i/> {auth.user ? cloudReady ? 'In Firebase gespeichert' : cloudStatus : 'Lokal zwischengespeichert'}</span></div><div className="start-grid"><button className="start-card" onClick={createNote}><FilePlus2 size={18}/><strong>Gedanken festhalten</strong><small>Eine neue Notiz beginnen</small></button><button className="start-card" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={18}/><strong>Wissen wiederfinden</strong><small>Alle Notizen durchsuchen</small></button><button className="start-card" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Command size={18}/><strong>Schnell navigieren</strong><small>Befehle und Aktionen</small></button></div></div> : <article className="note-view" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) event.preventDefault(); }} onDrop={dropInEditor} onClick={event => { if (mode === 'read' && !event.target.closest('button,a')) setMode('edit'); }}>
            <div className="note-heading"><div className="note-meta">{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(activeNote.updated))}<span>·</span>{wordCount} Wörter</div><div className="note-actions"><button className="button button-ghost mode-toggle" onClick={() => setMode(current => current === 'edit' ? 'read' : 'edit')}>{mode === 'edit' ? 'Vorschau' : 'Bearbeiten'}</button><button className="icon-button" title="Umbenennen" onClick={() => { setMode('edit'); noteInputRef.current?.focus(); }}><Pencil size={15}/></button><button className="icon-button" title="Markdown exportieren" onClick={() => exportNote(activeNote)}><Download size={15}/></button></div></div>
            {mode === 'edit' ? <><input ref={noteInputRef} className="note-title-input" value={title} onChange={event => setTitle(event.target.value)} onBlur={commitTitle} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitTitle(); event.currentTarget.blur(); } }}/><textarea ref={editorRef} className="markdown-editor" value={body} onChange={event => updateBody(event.target.value)} placeholder={'Schreib deinen Gedanken auf …\n\nTipp: Nutze #tags und [[Wikilinks]].'}/></> : <><h1 className="read-title">{activeNote.title}</h1><div className="properties-row">Erstellt <span>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(activeNote.created))}</span></div><div onClick={() => setMode('edit')}><MarkdownPreview source={body} onWiki={resolveWiki}/></div></>}
            <div className="editor-footer"><span><i className="status-dot"/> Alle Änderungen gespeichert</span><span>Markdown · UTF-8</span></div>
          </article>}
        </section>
        <aside className="right-sidebar"><div className="right-head"><span>NOTIZ-DETAILS</span><CircleHelp size={15}/></div>{activeNote ? <><div className="detail-section"><span>BACKLINKS</span>{backlinks.length ? backlinks.map(note => <button key={note.id} className="detail-link" onClick={() => openNote(note.id)}>{note.title}</button>) : <p>Noch keine Rückverweise</p>}</div><div className="detail-section"><span>DATEI-INFORMATIONEN</span><p>{activeNote.path}</p></div><div className="detail-section"><span>WORTANZAHL</span><p>{wordCount} Wörter</p></div></> : <div className="right-empty"><div className="detail-orbit">✳</div><strong>Alles an seinem Platz</strong><p>Öffne eine Notiz, um ihre Details und Verbindungen zu sehen.</p></div>}</aside>
      </div>
      <footer className="statusbar"><span><i className={`status-dot${auth.user && !cloudReady ? ' syncing' : ''}`}/> {auth.user ? cloudStatus : 'Lokal zwischengespeichert'}</span><span>{activeNote ? `${activeNote.title} · ${auth.user && cloudReady ? 'Firebase' : 'lokal'}` : 'Willkommen in Atelier'}</span><span>Markdown · UTF-8</span></footer>
    </main>

    <DialogFrame open={Boolean(dialog)} onOpenChange={open => !open && setDialog('')} title={dialog === 'folder' ? 'Neuer Ordner' : dialog === 'vault' ? 'Neuer Vault' : 'Markdown-Vault importieren'} description={dialog === 'import' ? 'Wähle einen Ordner oder mehrere Markdown-Dateien aus.' : 'Gib einen Namen ein, um fortzufahren.'}>
      {dialog === 'folder' || dialog === 'vault' ? <form className="dialog-form" onSubmit={event => { event.preventDefault(); dialog === 'folder' ? addFolder() : addVault(); }}><label htmlFor="name-field">{dialog === 'folder' ? 'Ordnername' : 'Vault-Name'}</label><input id="name-field" autoFocus value={field} onChange={event => setField(event.target.value)} placeholder={dialog === 'folder' ? 'z. B. Projekte' : 'Mein Projekt'}/><div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setDialog('')}>Abbrechen</button><button className="button button-primary">Erstellen</button></div></form> : <div className="dialog-form"><p>Markdown-Dateien mit Ordnerstruktur auswählen:</p><div className="dialog-actions"><label className="button button-outline file-picker-label">Ordner wählen<input type="file" webkitdirectory directory multiple hidden onChange={pickFile}/></label><label className="button button-outline file-picker-label">Dateien wählen<input type="file" multiple accept=".md,.markdown,.txt" hidden onChange={pickFile}/></label></div></div>}
    </DialogFrame>

    <DialogFrame open={searchOpen} onOpenChange={setSearchOpen} title="Suche im Wissensgarten" description="Volltextsuche in allen Notizen dieses Vaults.">
      <div className="search-dialog"><div className="search-field"><Search size={17}/><input autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Notiz oder Inhalt suchen …" onKeyDown={event => { if (event.key === 'Enter' && results[0]) selectResult(results[0]); }}/></div><div className="search-results">{results.map(note => <button key={note.id} className="search-result" onClick={() => selectResult(note)}><FileText size={15}/><span><strong>{note.title}</strong><small>{note.path} · {note.body.slice(0, 100)}</small></span></button>)}{!results.length && <p className="empty-tree">Keine Treffer</p>}</div></div>
    </DialogFrame>
    <DialogFrame open={graphOpen} onOpenChange={setGraphOpen} title="Wissensgraph" description={`${vault.notes.length} Notizen in ${vault.name}`}><div className="graph-preview">{vault.notes.map(note => <button key={note.id} onClick={() => { openNote(note.id); setGraphOpen(false); }}>{note.title}</button>)}</div></DialogFrame>
    <input id="vault-import" className="sr-only" type="file" multiple onChange={pickFile}/>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute/>}/><Route path="/*" element={<AuthGate><Workspace/></AuthGate>}/></Routes></BrowserRouter>;
}
