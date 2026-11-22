import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, Command, FilePlus2, FileText, Search, Share2, PanelLeft, Plus, Network, Pencil, Trash2, Download, CircleHelp } from 'lucide-react';
import { useAuth } from './auth/AuthProvider.jsx';
import FileTree from './components/FileTree.jsx';
import LoginPage from './components/LoginPage.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import BrandMark from './components/BrandMark.jsx';
import DialogFrame from './components/ui/DialogFrame.jsx';
import ConfirmDialog from './components/ui/ConfirmDialog.jsx';

const DB_KEY = 'atelier-db-v1';
const freshVault = () => ({ id: 'main', name: 'Mein Wissensgarten', folders: ['Ideen', 'Notizen'], notes: [
  { id: 'welcome-note', title: 'Willkommen in atelier', path: 'Willkommen in atelier.md', body: '## Ein guter Ort für deine Gedanken\n\natelier ist deine persönliche Markdown-Wissenswerkstatt. Verbinde Notizen mit **[[Wikilinks]]** und finde Gedanken später mit der Suche wieder.\n\n### Dein erster Schritt\n\n- Schreib eine Notiz\n- Verknüpfe sie mit `[[einer anderen Notiz]]`\n- Nutze #ideen für ein Tag\n', created: Date.now(), updated: Date.now() },
  { id: 'wikilinks', title: 'Wikilinks', path: 'Ideen/Wikilinks.md', body: '## Gedanken verbinden\n\nEin Link wie [[Willkommen in atelier]] verbindet diese Notiz mit deiner Startseite.\n\n#verbindungen', created: Date.now(), updated: Date.now() }
] });
function initialDB(key = DB_KEY) {
  try { const value = JSON.parse(localStorage.getItem(key)); if (value?.vaults?.length) return value; }
  catch {}
  return { vaults: [freshVault()] };
}
function uniqueNoteTitle(vault, folder = '') {
  let title = 'Neue Notiz'; let counter = 2;
  while (vault.notes.some(note => note.path.toLowerCase() === `${folder ? `${folder}/` : ''}${title}.md`.toLowerCase())) title = `Neue Notiz ${counter++}`;
  return title;
}
const uid = () => crypto.randomUUID();
const cleanTitle = value => value.trim().replace(/\.md$/i, '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ') || 'Unbenannt';
const parentPath = value => value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : '';
const sortNotes = notes => { const alphabetical = [...notes].sort((a, b) => a.title.localeCompare(b.title, 'de')); const fallback = new Map(alphabetical.map((note, index) => [note.id, index])); return alphabetical.sort((a, b) => (Number.isFinite(a.order) ? a.order : fallback.get(a.id)) - (Number.isFinite(b.order) ? b.order : fallback.get(b.id)) || a.title.localeCompare(b.title, 'de')); }
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nextNoteOrder = notes => sortNotes(notes).length;
function loadCollapsedFolders(key) {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return new Set(Array.isArray(value) ? value : []); }
  catch { return new Set(); }
}

function AuthGate({ children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <div className="page-loader"><span className="spinner"/> atelier wird geöffnet …</div>;
  if (auth.error) return <div className="page-loader error-page">{auth.error}<Link to="/login">Anmeldung öffnen</Link></div>;
  if (auth.enabled && !auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  return children;
}

function LoginRoute() {
  const auth = useAuth();
  if (auth.loading) return <div className="page-loader"><span className="spinner"/> Verbindung zu atelier …</div>;
  if (auth.user) return <Navigate to="/" replace/>;
  return <LoginPage/>;
}

function Workspace() {
  const auth = useAuth();
  const navigate = useNavigate();
  const cacheKey = auth.user ? `${DB_KEY}:${auth.user.uid}` : DB_KEY;
  const [db, setDb] = useState(() => initialDB(cacheKey));
  const [vaultId, setVaultId] = useState(() => initialDB(cacheKey).vaults[0]?.id || 'main');
  const [activeId, setActiveId] = useState(null);
  const [activePdf, setActivePdf] = useState(null);
  const [tabs, setTabs] = useState([]);
  const collapseKey = `atelier-collapsed-v1:${cacheKey}:${vaultId}`;
  const [collapsedState, setCollapsedState] = useState(() => ({ key: collapseKey, value: loadCollapsedFolders(collapseKey) }));
  const collapsed = collapsedState.key === collapseKey ? collapsedState.value : loadCollapsedFolders(collapseKey);
  const setCollapsed = updater => setCollapsedState(current => {
    const value = current.key === collapseKey ? current.value : loadCollapsedFolders(collapseKey);
    return { key: collapseKey, value: typeof updater === 'function' ? updater(value) : updater };
  });
  const [mode, setMode] = useState('read');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dialog, setDialog] = useState('');
  const [field, setField] = useState('');
  const [editingVaultId, setEditingVaultId] = useState('');
  const [folderParent, setFolderParent] = useState('');
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => Math.max(190, Math.min(480, Number(localStorage.getItem('atelier-sidebar-width')) || 256)));
  const [toast, setToast] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('Lokal zwischengespeichert');
  const [savingNote, setSavingNote] = useState(false);
  const [syncWake, setSyncWake] = useState(0);
  const [, setProfileVersion] = useState(0);
  const editorRef = useRef(null);
  const sidebarResizing = useRef(false);
  const noteInputRef = useRef(null);
  const focusTitleRef = useRef(false);
  const vault = db.vaults.find(item => item.id === vaultId) || db.vaults[0];
  const activeNote = vault?.notes.find(note => note.id === activeId) || null;
  const dbRef = useRef(db);
  dbRef.current = db;
  const syncInFlight = useRef(false);
  const syncPending = useRef(false);
  const saveLockRef = useRef(false);
  const saveOnlyNoteRef = useRef(null);
  const profileGreeting = auth.user ? localStorage.getItem(`atelier-profile-name:${auth.user.uid}`) : localStorage.getItem('atelier-profile-name:local');

  useEffect(() => { localStorage.setItem(cacheKey, JSON.stringify(db)); }, [cacheKey, db]);
  useEffect(() => { if (collapsedState.key === collapseKey) localStorage.setItem(collapseKey, JSON.stringify([...collapsedState.value])); }, [collapseKey, collapsedState]);
  useEffect(() => { localStorage.setItem('atelier-sidebar-width', String(sidebarWidth)); }, [sidebarWidth]);
  useEffect(() => { const update = () => setProfileVersion(value => value + 1); window.addEventListener('atelier-profile-updated', update); return () => window.removeEventListener('atelier-profile-updated', update); }, []);
  useEffect(() => { const refresh = () => setDb(current => ({ ...current, vaults: [...current.vaults] })); window.addEventListener('online', refresh); return () => window.removeEventListener('online', refresh); }, []);
  useEffect(() => { if (activeNote) { setBody(activeNote.body); setTitle(activeNote.title); } }, [activeId, activeNote?.body, activeNote?.title]);
  useEffect(() => {
    if (!activeNote || mode !== 'edit') return;
    const frame = requestAnimationFrame(() => { (focusTitleRef.current ? noteInputRef.current : editorRef.current)?.focus(); focusTitleRef.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [activeId, mode, activeNote]);
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
          const dirty = localNote && localNote.baseUpdatedAt !== undefined && (localNote.body !== localNote.baseBody || localNote.title !== localNote.baseTitle || localNote.path !== localNote.basePath || localNote.order !== localNote.baseOrder);
          return dirty ? localNote : { ...note, baseUpdatedAt: note.updatedAt, baseBody: note.body, baseTitle: note.title, basePath: note.path, baseOrder: note.order };
        });
        const remoteIds = new Set(remoteNotes.map(note => note.id));
        const pendingLocal = (local?.notes || []).filter(note => !remoteIds.has(note.id) && (note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath || note.order !== note.baseOrder));
        return { id: item.id, name: item.data.name || 'Mein Wissensgarten', folders: item.data.folders || [], attachments: item.data.attachments || [], notes: [...notes, ...pendingLocal] };
      });
      if (cloudVaults.length) {
        setDb(current => JSON.stringify(current) === JSON.stringify({ vaults: cloudVaults }) ? current : { vaults: cloudVaults });
        setVaultId(current => cloudVaults.some(item => item.id === current) ? current : cloudVaults[0].id);
        setCloudReady(true);
        setCloudStatus('Mit Cloud synchronisiert');
      }
    };

    rootUnsubscribe = fs.onSnapshot(root, async snapshot => {
      if (cancelled) return;
      if (snapshot.empty && !initializing) {
        initializing = true;
        try {
          await Promise.all(db.vaults.map(async item => {
            const vaultRef = fs.doc(root, item.id);
            await fs.setDoc(vaultRef, { name: item.name, folders: item.folders || [], attachments: item.attachments || [], updatedAt: Date.now() });
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
          noteSnapshots.set(item.id, notes.docs.map(note => ({ id: note.id, ...note.data(), baseUpdatedAt: note.data().updatedAt, baseBody: note.data().body, baseTitle: note.data().title, basePath: note.data().path, baseOrder: note.data().order })));
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
      if (syncInFlight.current) { syncPending.current = true; return; }
      syncInFlight.current = true;
      const saveOnly = saveOnlyNoteRef.current;
      setCloudStatus(saveLockRef.current ? 'Notiz wird in der Cloud gespeichert …' : mode === 'edit' && activeNote ? 'Textänderungen werden beim Verlassen gespeichert …' : 'Änderungen werden synchronisiert …');
      let conflictsSaved = 0;
      let deferredActiveNote = false;
      try {
        for (const item of dbRef.current.vaults) {
          if (saveOnly && item.id !== saveOnly.vaultId) continue;
          const vaultRef = fs.doc(root, item.id);
          if (!saveOnly) {
            const metadata = { name: item.name, folders: item.folders || [], attachments: item.attachments || [] };
            const metadataSnapshot = await fs.getDoc(vaultRef);
            const existingMetadata = metadataSnapshot.exists() ? metadataSnapshot.data() : {};
            if (!metadataSnapshot.exists() || existingMetadata.name !== metadata.name || JSON.stringify(existingMetadata.folders || []) !== JSON.stringify(metadata.folders) || JSON.stringify(existingMetadata.attachments || []) !== JSON.stringify(metadata.attachments))
              await fs.setDoc(vaultRef, { ...metadata, updatedAt: Date.now() }, { merge: true });
          }
          const notesRef = fs.collection(vaultRef, 'notes');
          if (!saveOnly) {
            const remote = await fs.getDocs(notesRef);
            const localIds = new Set(item.notes.map(note => note.id));
            await Promise.all(remote.docs.filter(note => !localIds.has(note.id)).map(note => fs.deleteDoc(note.ref)));
          }
          const normalized = note => ({ id: note.id, title: note.title, path: note.path, body: note.body, created: note.created, updated: note.updated, ...(Number.isFinite(note.order) ? { order: note.order } : {}) });
          for (const note of item.notes) {
            if (saveOnly && note.id !== saveOnly.noteId) continue;
            const isEditingThisNote = mode === 'edit' && note.id === activeId;
            const hasLocalEdits = note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath || note.order !== note.baseOrder;
            if (isEditingThisNote && hasLocalEdits) { deferredActiveNote = true; continue; }
            if (!hasLocalEdits) continue;
            const noteRef = fs.doc(notesRef, note.id);
            const result = await fs.runTransaction(auth.db, async transaction => {
              const snapshot = await transaction.get(noteRef);
              const existing = snapshot.exists() ? snapshot.data() : null;
              const localChanged = note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath || note.order !== note.baseOrder;
              const remoteChanged = existing && note.baseUpdatedAt !== undefined && existing.updatedAt !== note.baseUpdatedAt;
              const now = Date.now();
              if (remoteChanged && localChanged && (existing.body !== note.body || existing.title !== note.title || existing.path !== note.path || existing.order !== note.order)) {
                const conflictId = uid();
                const conflictTitle = cleanTitle(`${existing.title || note.title} (Konflikt ${new Date(now).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })})`);
                const conflictPath = `${parentPath(note.path) ? `${parentPath(note.path)}/` : ''}${conflictTitle}.md`;
                const conflictNote = { ...existing, id: conflictId, title: conflictTitle, path: conflictPath, updated: now };
                transaction.set(fs.doc(notesRef, conflictId), { ...normalized(conflictNote), updatedAt: now });
                transaction.set(noteRef, { ...normalized({ ...note, updated: now }), updatedAt: now }, { merge: true });
                return { conflict: true, now, remote: existing, conflictId, conflictTitle, conflictPath };
              }
              if (!existing || existing.body !== note.body || existing.title !== note.title || existing.path !== note.path || existing.updated !== note.updated || existing.order !== note.order) {
                transaction.set(noteRef, { ...normalized(note), updatedAt: now }, { merge: true });
                return { conflict: false, now };
              }
              return { conflict: false, now: existing.updatedAt };
            });
            if (result.conflict) {
              conflictsSaved += 1;
              setDb(current => ({ vaults: current.vaults.map(vault => {
                if (vault.id !== item.id) return vault;
                const localNote = { ...note, updated: result.now, baseUpdatedAt: result.now, baseBody: note.body, baseTitle: note.title, basePath: note.path, baseOrder: note.order };
                const conflictNote = { id: result.conflictId, ...result.remote, id: result.conflictId, title: result.conflictTitle, path: result.conflictPath, updated: result.now, baseUpdatedAt: result.now, baseBody: result.remote.body, baseTitle: result.conflictTitle, basePath: result.conflictPath, baseOrder: result.remote.order };
                return { ...vault, notes: [...vault.notes.map(candidate => candidate.id === note.id ? localNote : candidate), conflictNote] };
              }) }));
            } else {
              setDb(current => {
                let changed = false;
                const vaults = current.vaults.map(vault => {
                  if (vault.id !== item.id) return vault;
                  let vaultChanged = false;
                  const notes = vault.notes.map(existing => {
                    if (existing.id !== note.id || (existing.baseUpdatedAt === result.now && existing.baseBody === note.body && existing.baseTitle === note.title && existing.basePath === note.path && existing.baseOrder === note.order)) return existing;
                    changed = true; vaultChanged = true;
                    return { ...existing, baseUpdatedAt: result.now, baseBody: note.body, baseTitle: note.title, basePath: note.path, baseOrder: note.order };
                  });
                  return vaultChanged ? { ...vault, notes } : vault;
                });
                return changed ? { ...current, vaults } : current;
              });
            }
          }
        }
        if (saveOnly) {
          saveOnlyNoteRef.current = null;
          saveLockRef.current = false;
          setSavingNote(false);
        }
        setCloudStatus(conflictsSaved ? 'Konflikt gesichert: beide Textfassungen bleiben erhalten' : deferredActiveNote ? 'Entwurf lokal gesichert · Firebase-Speicherung beim Verlassen' : 'Mit Cloud synchronisiert');
      } catch (error) { setCloudStatus('Offline · Änderungen warten auf Synchronisierung'); }
      finally {
        syncInFlight.current = false;
        if (saveOnly) saveOnlyNoteRef.current = null;
        if (saveLockRef.current && !syncPending.current) { saveLockRef.current = false; setSavingNote(false); }
        if (syncPending.current) { syncPending.current = false; setSyncWake(value => value + 1); }
      }
    }, mode === 'edit' ? 450 : 0);
    return () => window.clearTimeout(timer);
  }, [db, cloudReady, auth.user, auth.db, auth.firestoreSdk, mode, activeId, syncWake]);
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
  function beginSaveBarrier() {
    if (!auth.user || !cloudReady) return;
    const note = activeNote;
    if (!note) return;
    const changed = note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath || note.order !== note.baseOrder || title !== note.title;
    if (!changed) return;
    saveOnlyNoteRef.current = { vaultId, noteId: note.id };
    saveLockRef.current = true;
    setSavingNote(true);
    setCloudStatus('Notiz wird in der Cloud gespeichert …');
    editorRef.current?.blur();
  }
  function openNote(id, nextMode = 'read') {
    if (saveLockRef.current) return;
    if (mode === 'edit') commitTitle();
    const note = vault.notes.find(item => item.id === id); if (!note) return;
    setActivePdf(null); setActiveId(id); setTitle(note.title); setBody(note.body); setTabs(current => current.includes(id) ? current : [...current, id]); setMode(nextMode); setSidebarOpen(false);
  }
  function createNote(inFolder = '') {
    if (saveLockRef.current) return;
    const name = uniqueNoteTitle(vault, inFolder);
    const siblings = sortNotes(vault.notes.filter(item => parentPath(item.path) === inFolder));
    const normalizedOrder = new Map(siblings.map((item, index) => [item.id, index]));
    const note = { id: uid(), title: name, path: `${inFolder ? `${inFolder}/` : ''}${name}.md`, body: '', order: siblings.length, created: Date.now(), updated: Date.now() };
    updateVault(current => ({ ...current, notes: [...current.notes.map(item => normalizedOrder.has(item.id) ? { ...item, order: normalizedOrder.get(item.id) } : item), note] }));
    setActivePdf(null); setActiveId(note.id); setTabs(current => [...current, note.id]); setTitle(note.title); setBody(''); setMode('edit');
    window.setTimeout(() => noteInputRef.current?.focus(), 0);
  }
  function updateBody(value) {
    setBody(value);
    if (!activeId) return;
    updateVault(current => ({ ...current, notes: current.notes.map(note => note.id === activeId ? { ...note, body: value, updated: Date.now() } : note) }));
  }
  function toggleTask(lineIndex) {
    const lines = body.split('\n');
    const match = lines[lineIndex]?.match(/^(\s*[-*+]\s+\[)([ xX])(\])/);
    if (!match) return;
    lines[lineIndex] = `${match[1]}${match[2].trim() ? ' ' : 'x'}${match[3]}${lines[lineIndex].slice(match[0].length)}`;
    updateBody(lines.join('\n'));
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
  function toggleNoteMode() {
    if (mode === 'edit') { commitTitle(); beginSaveBarrier(); setMode('read'); }
    else setMode('edit');
  }
  function requestConfirmation(options) { setConfirmation(options); }
  function deleteNote(id) {
    if (saveLockRef.current) return;
    const note = vault.notes.find(item => item.id === id); if (!note) return;
    requestConfirmation({ title: 'Notiz löschen?', description: `„${note.title}“ wird dauerhaft gelöscht.`, confirmLabel: 'Notiz löschen', danger: true, onConfirm: () => {
      updateVault(current => ({ ...current, notes: current.notes.filter(item => item.id !== id) }));
      setTabs(current => current.filter(item => item !== id));
      if (activeId === id) { setActiveId(null); setTitle(''); setBody(''); }
      setConfirmation(null); notify('Notiz gelöscht');
    } });
  }
  function moveNote(id, folder) {
    const target = vault.notes.find(note => note.id === id); if (!target) return;
    const nextPath = `${folder ? `${folder}/` : ''}${target.path.split('/').pop()}`;
    if (vault.notes.some(note => note.id !== id && note.path.toLowerCase() === nextPath.toLowerCase())) return notify('In diesem Ordner gibt es bereits eine Datei mit diesem Namen.');
    const siblings = sortNotes(vault.notes.filter(note => note.id !== id && parentPath(note.path) === folder));
    const positions = new Map(siblings.map((note, index) => [note.id, index]));
    const destinationOrder = siblings.length;
    updateVault(current => ({ ...current, notes: current.notes.map(note => note.id === id ? { ...note, path: nextPath, order: destinationOrder, updated: Date.now() } : positions.has(note.id) ? { ...note, order: positions.get(note.id) } : note) }));
    notify(folder ? `In „${folder}“ verschoben` : 'Auf die Hauptebene verschoben');
  }
  function reorderNote(id, targetId, after) {
    const source = vault.notes.find(note => note.id === id);
    const target = vault.notes.find(note => note.id === targetId);
    if (!source || !target || source.id === target.id) return;
    const destination = parentPath(target.path);
    const nextPath = `${destination ? `${destination}/` : ''}${source.path.split('/').pop()}`;
    if (vault.notes.some(note => note.id !== source.id && note.path.toLocaleLowerCase() === nextPath.toLocaleLowerCase())) return notify('In diesem Ordner gibt es bereits eine Datei mit diesem Namen.');
    const siblings = sortNotes(vault.notes.filter(note => note.id !== source.id && parentPath(note.path) === destination));
    const targetIndex = siblings.findIndex(note => note.id === target.id);
    siblings.splice(Math.max(0, targetIndex + (after ? 1 : 0)), 0, source);
    const positions = new Map(siblings.map((note, index) => [note.id, index]));
    updateVault(current => ({ ...current, notes: current.notes.map(note => positions.has(note.id) ? { ...note, path: note.id === source.id ? nextPath : note.path, order: positions.get(note.id), updated: Date.now() } : note) }));
  }
  function moveFolder(source, destination) {
    if (!vault.folders.includes(source)) return;
    if (destination === source || destination.startsWith(`${source}/`)) return notify('Ein Ordner kann nicht in sich selbst verschoben werden.');
    const nextRoot = `${destination ? `${destination}/` : ''}${source.split('/').pop()}`;
    if (nextRoot === source) return;
    const movingFolders = vault.folders.filter(folder => folder === source || folder.startsWith(`${source}/`));
    const movedFolderPaths = new Map(movingFolders.map(folder => [folder, `${nextRoot}${folder.slice(source.length)}`]));
    setCollapsed(current => new Set([...current].map(path => movedFolderPaths.get(path) || path)));
    const movingNotes = vault.notes.filter(note => note.path.startsWith(`${source}/`));
    const movedNotePaths = new Map(movingNotes.map(note => [note.id, `${nextRoot}${note.path.slice(source.length)}`]));
    const movedAttachments = new Map((vault.attachments || []).filter(file => file.path.startsWith(`${source}/`)).map(file => [file.id, `${nextRoot}${file.path.slice(source.length)}`]));
    const existingFolders = new Set(vault.folders.filter(folder => !movedFolderPaths.has(folder)).map(folder => folder.toLocaleLowerCase()));
    if ([...movedFolderPaths.values()].some(folder => existingFolders.has(folder.toLocaleLowerCase()))) return notify('An dieser Stelle gibt es bereits einen gleichnamigen Ordner.');
    const existingNotes = new Set(vault.notes.filter(note => !movedNotePaths.has(note.id)).map(note => note.path.toLocaleLowerCase()));
    if ([...movedNotePaths.values()].some(path => existingNotes.has(path.toLocaleLowerCase()))) return notify('An dieser Stelle gibt es bereits eine gleichnamige Notiz.');
    updateVault(current => ({
      ...current,
      folders: current.folders.map(folder => movedFolderPaths.get(folder) || folder),
      notes: current.notes.map(note => movedNotePaths.has(note.id) ? { ...note, path: movedNotePaths.get(note.id), updated: Date.now() } : note),
      attachments: (current.attachments || []).map(file => movedAttachments.has(file.id) ? { ...file, path: movedAttachments.get(file.id) } : file)
    }));
    setActivePdf(current => current && movedAttachments.has(current.id) ? { ...current, path: movedAttachments.get(current.id) } : current);
    notify(destination ? `Ordner nach „${destination}“ verschoben` : 'Ordner auf die Hauptebene verschoben');
  }
  function reorderFolder(source, target, after) {
    if (source === target || parentPath(source) !== parentPath(target)) return;
    const parent = parentPath(source);
    const siblings = vault.folders.filter(folder => parentPath(folder) === parent);
    const from = siblings.indexOf(source);
    const to = siblings.indexOf(target);
    if (from < 0 || to < 0) return;
    siblings.splice(from, 1);
    const targetIndex = siblings.indexOf(target);
    siblings.splice(targetIndex + (after ? 1 : 0), 0, source);
    let index = 0;
    updateVault(current => ({ ...current, folders: current.folders.map(folder => parentPath(folder) === parent ? siblings[index++] : folder) }));
  }
  function renameFolder(source, rawName) {
    const name = cleanTitle(rawName);
    const nextRoot = `${parentPath(source) ? `${parentPath(source)}/` : ''}${name}`;
    if (nextRoot === source) return;
    const movingFolders = vault.folders.filter(folder => folder === source || folder.startsWith(`${source}/`));
    const mappedFolders = new Map(movingFolders.map(folder => [folder, `${nextRoot}${folder.slice(source.length)}`]));
    setCollapsed(current => new Set([...current].map(path => mappedFolders.get(path) || path)));
    const unchanged = new Set(vault.folders.filter(folder => !mappedFolders.has(folder)).map(folder => folder.toLocaleLowerCase()));
    if ([...mappedFolders.values()].some(folder => unchanged.has(folder.toLocaleLowerCase()))) return notify('An dieser Stelle gibt es bereits einen gleichnamigen Ordner.');
    const movingNotes = vault.notes.filter(note => note.path.startsWith(`${source}/`));
    const mappedNotes = new Map(movingNotes.map(note => [note.id, `${nextRoot}${note.path.slice(source.length)}`]));
    const mappedAttachments = new Map((vault.attachments || []).filter(file => file.path.startsWith(`${source}/`)).map(file => [file.id, `${nextRoot}${file.path.slice(source.length)}`]));
    const unchangedNotes = new Set(vault.notes.filter(note => !mappedNotes.has(note.id)).map(note => note.path.toLocaleLowerCase()));
    if ([...mappedNotes.values()].some(path => unchangedNotes.has(path.toLocaleLowerCase()))) return notify('Durch das Umbenennen würde eine Notiz überschrieben.');
    updateVault(current => ({ ...current, folders: current.folders.map(folder => mappedFolders.get(folder) || folder), notes: current.notes.map(note => mappedNotes.has(note.id) ? { ...note, path: mappedNotes.get(note.id), updated: Date.now() } : note), attachments: (current.attachments || []).map(file => mappedAttachments.has(file.id) ? { ...file, path: mappedAttachments.get(file.id) } : file) }));
    setActivePdf(current => current && mappedAttachments.has(current.id) ? { ...current, path: mappedAttachments.get(current.id) } : current);
    notify(`Ordner „${name}“ umbenannt`);
  }
  function deleteFolder(folder) {
    const childFolders = vault.folders.filter(item => item === folder || item.startsWith(`${folder}/`));
    const removedNotes = vault.notes.filter(note => note.path.startsWith(`${folder}/`));
    requestConfirmation({ title: 'Ordner löschen?', description: `„${folder}“ mit ${removedNotes.length} Datei(en) und allen Unterordnern dauerhaft löschen?`, confirmLabel: 'Ordner löschen', danger: true, onConfirm: () => {
      const removedIds = new Set(removedNotes.map(note => note.id));
      const removedAttachments = (vault.attachments || []).filter(file => file.path.startsWith(`${folder}/`));
      setCollapsed(current => new Set([...current].filter(path => path !== folder && !path.startsWith(`${folder}/`))));
      if (auth.storage && auth.storageSdk) removedAttachments.forEach(file => auth.storageSdk.deleteObject(auth.storageSdk.ref(auth.storage, file.storagePath)).catch(() => {}));
      updateVault(current => ({ ...current, folders: current.folders.filter(item => !childFolders.includes(item)), notes: current.notes.filter(note => !removedIds.has(note.id)), attachments: (current.attachments || []).filter(file => !removedAttachments.some(removed => removed.id === file.id)) }));
      setTabs(current => current.filter(id => !removedIds.has(id) && !removedAttachments.some(file => id === `pdf:${file.id}`)));
      if (activePdf && removedAttachments.some(file => file.id === activePdf.id)) { const next = tabs.filter(id => !removedIds.has(id) && !removedAttachments.some(file => id === `pdf:${file.id}`)).at(-1); if (next) activateTab(next); else setActivePdf(null); }
      if (activeId && removedIds.has(activeId)) { setActiveId(null); setTitle(''); setBody(''); }
      setConfirmation(null); notify(`Ordner „${folder}“ gelöscht`);
    } });
  }
  function addFolder() {
    const name = cleanTitle(field.trim()); if (!field.trim()) return;
    const path = `${folderParent ? `${folderParent}/` : ''}${name}`;
    if (vault.folders.some(folder => folder.toLocaleLowerCase() === path.toLocaleLowerCase())) return notify('Dieser Ordner existiert bereits.');
    updateVault(current => ({ ...current, folders: [...new Set([...current.folders, path])] })); setField(''); setDialog(''); notify(`Ordner „${name}“ erstellt`);
  }
  function addVault() {
    if (!field.trim()) return;
    const item = { id: uid(), name: field.trim(), folders: [], notes: [] };
    setDb(current => ({ ...current, vaults: [...current.vaults, item] })); setVaultId(item.id); setActivePdf(null); setActiveId(null); setTabs([]); setField(''); setDialog('');
  }
  function renameVault(id, rawName) {
    const name = rawName.trim();
    if (!name) return notify('Der Vault-Name darf nicht leer sein.');
    if (db.vaults.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return notify('Ein Vault mit diesem Namen existiert bereits.');
    setDb(current => ({ ...current, vaults: current.vaults.map(item => item.id === id ? { ...item, name } : item) }));
    setDialog(''); setEditingVaultId(''); setField(''); notify(`Vault in „${name}“ umbenannt`);
  }
  async function deleteVault(id) {
    const target = db.vaults.find(item => item.id === id);
    if (!target) return;
    if (db.vaults.length <= 1) return notify('Lege zuerst einen weiteren Vault an, bevor du diesen löschst.');
    requestConfirmation({ title: 'Vault löschen?', description: `Vault „${target.name}“ samt allen Notizen und Ordnern endgültig löschen?`, confirmLabel: 'Vault endgültig löschen', danger: true, onConfirm: () => { setConfirmation(null); void performDeleteVault(id); } });
  }
  async function performDeleteVault(id) {
    const target = db.vaults.find(item => item.id === id);
    if (!target) return;
    if (auth.user) {
      if (!auth.db || !auth.firestoreSdk) return notify('Firebase ist noch nicht verbunden. Versuche es gleich noch einmal.');
      const fs = auth.firestoreSdk;
      try {
        const vaultRef = fs.doc(fs.collection(auth.db, 'users', auth.user.uid, 'vaults'), target.id);
        const notes = await fs.getDocs(fs.collection(vaultRef, 'notes'));
        for (let offset = 0; offset < notes.docs.length; offset += 450) {
          const batch = fs.writeBatch(auth.db);
          notes.docs.slice(offset, offset + 450).forEach(note => batch.delete(note.ref));
          await batch.commit();
        }
        await fs.deleteDoc(vaultRef);
      } catch (error) { return notify('Vault konnte nicht aus Firebase gelöscht werden.'); }
    }
    const next = db.vaults.find(item => item.id !== id);
    setDb(current => ({ ...current, vaults: current.vaults.filter(item => item.id !== id) }));
    if (vaultId === id && next) { setVaultId(next.id); setActiveId(null); setTabs([]); setTitle(''); setBody(''); setMode('read'); }
    notify(`Vault „${target.name}“ gelöscht`);
  }
  function startRenameVault(item = vault) { setEditingVaultId(item.id); setField(item.name); setDialog('vault-rename'); }
  function switchVault(id) {
    if (saveLockRef.current) return;
    if (id === vaultId) return;
    if (mode === 'edit') commitTitle();
    setVaultId(id); setActivePdf(null); setActiveId(null); setTabs([]); setTitle(''); setBody(''); setMode('read');
  }
  function startNewFolder(parent = '') { setFolderParent(parent); setField(''); setDialog('folder'); }
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
      const folder = parentPath(path);
      const order = nextNoteOrder([...vault.notes.filter(item => parentPath(item.path) === folder), ...imported.filter(item => parentPath(item.path) === folder)]);
      imported.push({ id: uid(), title: noteTitle, path, body: await file.text(), order, created: Date.now(), updated: Date.now() });
    }
    if (!imported.length) { setDialog(''); return notify('Keine Markdown-Dateien gefunden'); }
    updateVault(current => ({ ...current, notes: [...current.notes.filter(note => !imported.some(item => item.path === note.path)), ...imported], folders: [...new Set([...current.folders, ...imported.flatMap(note => { const parts = parentPath(note.path).split('/').filter(Boolean); return parts.map((_, index) => parts.slice(0, index + 1).join('/')); })])] }));
    setDialog('');
    notify(`${imported.length} Datei(en) importiert`);
  }
  async function importAttachments(files, folder = '') {
    const candidates = [...files].filter(file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
    const knownPaths = new Set([...vault.notes.map(note => note.path), ...(vault.attachments || []).map(file => file.path)].map(path => path.toLocaleLowerCase()));
    const pdfs = candidates.filter(file => {
      const path = `${folder ? `${folder}/` : ''}${file.name}`.toLocaleLowerCase();
      if (knownPaths.has(path)) { notify(`„${file.name}“ gibt es in diesem Ordner bereits.`); return false; }
      knownPaths.add(path); return true;
    });
    if (!pdfs.length) return;
    if (!auth.user || !auth.storage || !auth.storageSdk) return notify('Bitte anmelden, um PDFs im Vault abzulegen.');
    setCloudStatus('PDF wird hochgeladen …');
    const added = [];
    try {
      for (const file of pdfs) {
        const id = uid();
        const storagePath = `users/${auth.user.uid}/vaults/${vault.id}/attachments/${id}`;
        await auth.storageSdk.uploadBytes(auth.storageSdk.ref(auth.storage, storagePath), file, { contentType: 'application/pdf' });
        const path = `${folder ? `${folder}/` : ''}${file.name}`;
        added.push({ id, name: file.name, path, storagePath, size: file.size, type: 'application/pdf', created: Date.now() });
      }
      const parentFolders = added.flatMap(file => { const parts = parentPath(file.path).split('/').filter(Boolean); return parts.map((_, index) => parts.slice(0, index + 1).join('/')); });
      updateVault(current => ({ ...current, attachments: [...(current.attachments || []).filter(file => !added.some(next => next.path.toLocaleLowerCase() === file.path.toLocaleLowerCase())), ...added], folders: [...new Set([...current.folders, ...parentFolders])] }));
      setCloudStatus('Mit Cloud synchronisiert');
      notify(`${added.length} PDF-Datei(en) hinzugefügt`);
    } catch {
      setCloudStatus('PDF-Upload fehlgeschlagen');
      notify('PDF konnte nicht in Firebase Storage gespeichert werden.');
    }
  }
  async function openAttachment(file) {
    if (saveLockRef.current) return;
    try {
      const url = await auth.storageSdk.getDownloadURL(auth.storageSdk.ref(auth.storage, file.storagePath));
      if (mode === 'edit') commitTitle();
      const tabId = `pdf:${file.id}`;
      setActivePdf({ ...file, url }); setActiveId(null); setTabs(current => current.includes(tabId) ? current : [...current, tabId]); setMode('read'); setSidebarOpen(false);
    } catch { notify('PDF konnte nicht geöffnet werden.'); }
  }
  function activateTab(tabId) {
    if (saveLockRef.current) return;
    if (tabId.startsWith('pdf:')) {
      const file = (vault.attachments || []).find(item => item.id === tabId.slice(4));
      if (file) openAttachment(file);
    } else openNote(tabId);
  }
  function moveAttachment(id, folder) {
    const file = (vault.attachments || []).find(item => item.id === id); if (!file) return;
    const nextPath = `${folder ? `${folder}/` : ''}${file.name}`;
    if ((vault.attachments || []).some(item => item.id !== id && item.path.toLocaleLowerCase() === nextPath.toLocaleLowerCase()) || vault.notes.some(note => note.path.toLocaleLowerCase() === nextPath.toLocaleLowerCase())) return notify('In diesem Ordner gibt es bereits eine Datei mit diesem Namen.');
    updateVault(current => ({ ...current, attachments: (current.attachments || []).map(item => item.id === id ? { ...item, path: nextPath } : item) }));
    setActivePdf(current => current?.id === id ? { ...current, path: nextPath } : current);
    notify(folder ? `In „${folder}“ verschoben` : 'Auf die Hauptebene verschoben');
  }
  function renameAttachment(id, name) {
    const file = (vault.attachments || []).find(item => item.id === id); if (!file) return;
    const baseName = name.trim().replace(/[\\/:*?"<>|]/g, '-'); if (!baseName) return;
    const nextName = baseName.toLocaleLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
    const nextPath = `${parentPath(file.path) ? `${parentPath(file.path)}/` : ''}${nextName}`;
    if ((vault.attachments || []).some(item => item.id !== id && item.path.toLocaleLowerCase() === nextPath.toLocaleLowerCase()) || vault.notes.some(note => note.path.toLocaleLowerCase() === nextPath.toLocaleLowerCase())) return notify('Eine Datei mit diesem Namen existiert bereits.');
    updateVault(current => ({ ...current, attachments: (current.attachments || []).map(item => item.id === id ? { ...item, name: nextName, path: nextPath } : item) }));
    setActivePdf(current => current?.id === id ? { ...current, name: nextName, path: nextPath } : current);
  }
  function deleteAttachment(id) {
    const file = (vault.attachments || []).find(item => item.id === id); if (!file) return;
    requestConfirmation({ title: 'PDF löschen?', description: `„${file.name}“ wird dauerhaft gelöscht.`, confirmLabel: 'PDF löschen', danger: true, onConfirm: () => {
      if (auth.storage && auth.storageSdk) auth.storageSdk.deleteObject(auth.storageSdk.ref(auth.storage, file.storagePath)).catch(() => {});
      updateVault(current => ({ ...current, attachments: (current.attachments || []).filter(item => item.id !== id) }));
      setTabs(current => current.filter(tab => tab !== `pdf:${id}`));
      if (activePdf?.id === id) { const next = tabs.filter(tab => tab !== `pdf:${id}`).at(-1); if (next) activateTab(next); else setActivePdf(null); }
      setConfirmation(null); notify('PDF gelöscht');
    } });
  }
  function dragStart(event, item, kind = 'note') {
    if (kind === 'folder') { event.dataTransfer.setData('application/x-atelier-folder', item); event.dataTransfer.setData('text/plain', item); }
    else if (kind === 'attachment') { event.dataTransfer.setData('application/x-atelier-attachment', item.id); event.dataTransfer.setData('text/plain', item.name); }
    else { event.dataTransfer.setData('application/x-atelier-note', item.id); event.dataTransfer.setData('text/plain', `[[${item.title}]]`); }
    event.dataTransfer.effectAllowed = 'copyMove';
  }
  function dropInEditor(event) {
    const id = event.dataTransfer.getData('application/x-atelier-note');
    const attachmentId = event.dataTransfer.getData('application/x-atelier-attachment');
    const linked = vault.notes.find(note => note.id === id);
    const linkedPdf = (vault.attachments || []).find(file => file.id === attachmentId);
    if ((!linked && !linkedPdf) || !activeNote) return;
    event.preventDefault();
    const editor = editorRef.current; const insertion = linked ? `[[${linked.title}]]` : `[[${linkedPdf.path}|${linkedPdf.name}]]`;
    const start = editor?.selectionStart ?? body.length; const end = editor?.selectionEnd ?? start;
    const prefix = !editor && body.length && !body.endsWith('\n') ? '\n' : '';
    const textToInsert = `${prefix}${insertion}`;
    const next = `${body.slice(0, start)}${textToInsert}${body.slice(end)}`;
    updateBody(next); setMode('edit');
    requestAnimationFrame(() => { const target = editorRef.current; target?.focus(); target?.setSelectionRange(start + textToInsert.length, start + textToInsert.length); });
  }
  function resolveWiki(target) {
    const attachment = (vault.attachments || []).find(file => file.name.toLocaleLowerCase() === target.toLocaleLowerCase() || file.path.toLocaleLowerCase() === target.toLocaleLowerCase() || file.path.replace(/\.pdf$/i, '').toLocaleLowerCase() === target.toLocaleLowerCase());
    if (attachment) { openAttachment(attachment); return; }
    let note = vault.notes.find(item => item.title.toLowerCase() === target.toLowerCase() || item.path.replace(/\.md$/i, '').toLowerCase() === target.toLowerCase());
    if (!note) {
      note = { id: uid(), title: cleanTitle(target), path: `${cleanTitle(target)}.md`, body: '', created: Date.now(), updated: Date.now() };
      updateVault(current => ({ ...current, notes: [...current.notes, note] }));
    }
    openNote(note.id);
  }
  function pickFile(event) { importFiles([...event.target.files]); event.target.value = ''; }
  function selectResult(note) { openNote(note.id); setSearchOpen(false); }
  function closeTab(tabId) {
    if (saveLockRef.current) return;
    setTabs(current => current.filter(id => id !== tabId));
    const wasActive = tabId === activeId || tabId === `pdf:${activePdf?.id}`;
    if (!wasActive) return;
    const next = tabs.filter(id => id !== tabId).at(-1);
    if (next) activateTab(next); else { setActivePdf(null); setActiveId(null); setTitle(''); setBody(''); }
  }
  function resizeSidebar(event) {
    if (!sidebarResizing.current) return;
    const maxWidth = Math.max(190, Math.min(480, window.innerWidth - 48 - 360));
    setSidebarWidth(Math.max(190, Math.min(maxWidth, event.clientX - 48)));
  }

  const backlinks = useMemo(() => activeNote ? vault.notes.filter(note => note.id !== activeNote.id && note.body.toLowerCase().includes(`[[${activeNote.title.toLowerCase()}`)) : [], [vault, activeNote]);
  const results = useMemo(() => {
    const query = searchText.toLowerCase();
    return vault.notes.filter(note => !query || `${note.title}\n${note.body}`.toLowerCase().includes(query));
  }, [vault, searchText]);
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` }} onPointerDown={event => { if (!saveLockRef.current && mode === 'edit' && activeNote && !event.target.closest('.note-view')) { commitTitle(); beginSaveBarrier(); setMode('read'); } }}>
    <aside className="rail"><Link to="/" className="brand-mark" aria-label="atelier Startseite" onClick={() => { setActivePdf(null); setActiveId(null); setTabs([]); }}><BrandMark/></Link><button className="rail-button active" title="Dateien" onClick={() => setSidebarOpen(open => !open)}><PanelLeft size={17}/></button><button className="rail-button" title="Suche" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={17}/></button><button className="rail-button" title="Graph" onClick={() => setGraphOpen(true)}><Network size={17}/></button><div className="rail-spacer"/><button className="rail-button" title="Befehlspalette" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Command size={17}/></button><ProfileMenu/></aside>
    <aside className="sidebar">
      <div className="workspace-head"><div className="workspace-identity"><span className="workspace-caption">ARBEITSBEREICH</span>
        <DropdownMenu.Root><DropdownMenu.Trigger asChild><button type="button" className="workspace-select-button" aria-label="Vault auswählen"><span>{vault.name}</span><ChevronDown size={15}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="workspace-menu" align="start" sideOffset={6}>
          <div className="workspace-menu-label">VAULTS</div>
          {db.vaults.map(item => <DropdownMenu.Item key={item.id} className="workspace-menu-item" onSelect={() => switchVault(item.id)}><Check size={15} className={item.id === vault.id ? 'workspace-check active' : 'workspace-check'}/><span>{item.name}</span></DropdownMenu.Item>)}
          <DropdownMenu.Separator className="menu-separator"/>
          <DropdownMenu.Item className="workspace-menu-item" onSelect={() => startRenameVault()}><Pencil size={15}/><span>Vault umbenennen</span></DropdownMenu.Item>
          <DropdownMenu.Item className="workspace-menu-item danger" disabled={db.vaults.length <= 1} onSelect={() => deleteVault(vault.id)}><Trash2 size={15}/><span>Vault löschen</span></DropdownMenu.Item>
          {db.vaults.length <= 1 && <div className="workspace-menu-hint">Zum Löschen zuerst einen weiteren Vault anlegen.</div>}
        </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
      </div><button className="icon-button" aria-label="Neuen Vault erstellen" title="Neuen Vault erstellen" onClick={() => { setField(''); setDialog('vault'); }}><Plus size={19}/></button></div>
      <FileTree vault={vault} activeId={activeId} collapsed={collapsed} setCollapsed={setCollapsed} onOpen={openNote} onRename={renameNote} onDelete={deleteNote} onMove={moveNote} onExport={exportNote} onCreateNote={createNote} onCreateFolder={startNewFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onImport={() => setDialog('import')} onExportVault={exportVault} onDragStart={dragStart} onMoveFolder={moveFolder} onReorder={reorderNote} onReorderFolder={reorderFolder} onImportAttachments={importAttachments} onOpenAttachment={openAttachment} onMoveAttachment={moveAttachment} onRenameAttachment={renameAttachment} onDeleteAttachment={deleteAttachment}/>
      <div className="sidebar-status"><span className={`status-dot${auth.user && !cloudReady ? ' syncing' : ''}`}/><span>{auth.user ? cloudStatus : 'Lokal zwischengespeichert'}</span></div>
    </aside>
    <div className="sidebar-resizer" role="separator" aria-label="Breite der Seitenleiste ändern" aria-orientation="vertical" aria-valuemin={190} aria-valuemax={480} aria-valuenow={sidebarWidth} tabIndex={0}
      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); sidebarResizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={resizeSidebar}
      onPointerUp={event => { event.stopPropagation(); sidebarResizing.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { sidebarResizing.current = false; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSidebarWidth(width => Math.max(190, Math.min(480, width + (event.key === 'ArrowRight' ? 12 : -12)))); } }}/>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>{vault.name}</span><span className="crumb-sep">/</span><strong>{activeNote?.title || activePdf?.name || 'Willkommen'}</strong></div><div className="topbar-actions"><button className="button button-ghost top-action" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={16}/><span>Suchen</span><kbd>⌘ K</kbd></button><button className="button button-outline top-action" onClick={exportVault}><Share2 size={15}/> Exportieren</button></div></header>
      <div className="tabs">{tabs.map(id => { const pdf = id.startsWith('pdf:') ? (vault.attachments || []).find(file => file.id === id.slice(4)) : null; const note = pdf ? null : vault.notes.find(item => item.id === id); const label = pdf?.name || note?.title; return label && <button key={id} className={`tab${(pdf ? activePdf?.id === pdf.id : activeId === id) ? ' active' : ''}`} onClick={() => activateTab(id)}><FileText size={14}/><span>{label}</span><span role="button" aria-label="Tab schließen" className="tab-close" onClick={event => { event.stopPropagation(); closeTab(id); }}>×</span></button>; })}</div>
      <div className="content-wrap">
        <section className="editor-pane" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') || event.dataTransfer.types.includes('application/x-atelier-attachment')) event.preventDefault(); }}>
          {activePdf ? <div className="pdf-view"><div className="pdf-view-heading"><FileText size={17}/><span>{activePdf.path}</span><a className="button button-outline" href={activePdf.url} download={activePdf.name}>PDF herunterladen</a></div><iframe title={activePdf.name} src={activePdf.url} className="pdf-frame"/></div> : !activeNote ? <div className="welcome-view"><p className="eyebrow">DEINE DIGITALEN NOTIZEN</p><h1>Hallo <em>{(profileGreeting || auth.user?.displayName || 'Manuel').trim().split(/\s+/)[0]}.</em></h1><p className="welcome-copy">Ein ruhiger Ort für Gedanken, Wissen und alles, was du nicht vergessen möchtest.</p><div className="welcome-actions"><button className="button button-primary" onClick={createNote}><FilePlus2 size={16}/> Erste Notiz schreiben</button><button className="button button-outline" onClick={() => setDialog('import')}><Download size={15}/> Vault importieren</button></div><div className="welcome-divider"/><div className="recent-head"><div><p className="eyebrow">LOS GEHT’S</p><h2>Dein Arbeitsbereich</h2></div><span className="local-badge"><i/> {auth.user ? cloudReady ? 'Mit Cloud synchronisiert' : cloudStatus : 'Lokal zwischengespeichert'}</span></div><div className="start-grid"><button className="start-card" onClick={createNote}><FilePlus2 size={18}/><strong>Gedanken festhalten</strong><small>Eine neue Notiz beginnen</small></button><button className="start-card" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Search size={18}/><strong>Wissen wiederfinden</strong><small>Alle Notizen durchsuchen</small></button><button className="start-card" onClick={() => { setSearchText(''); setSearchOpen(true); }}><Command size={18}/><strong>Schnell navigieren</strong><small>Befehle und Aktionen</small></button></div></div> : <article className="note-view" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') || event.dataTransfer.types.includes('application/x-atelier-attachment')) event.preventDefault(); }} onDrop={dropInEditor} onClick={event => { if (mode === 'read' && !event.target.closest('button,a,input')) setMode('edit'); }}>
            <div className="note-heading"><div className="note-meta">{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(activeNote.updated))}<span>·</span>{wordCount} Wörter</div><div className="note-actions"><button className="button button-ghost mode-toggle" onClick={toggleNoteMode}>{mode === 'edit' ? 'Vorschau' : 'Bearbeiten'}</button><button className="icon-button" title="Umbenennen" onClick={() => { if (mode === 'edit') noteInputRef.current?.focus(); else { focusTitleRef.current = true; setMode('edit'); } }}><Pencil size={15}/></button><button className="icon-button" title="Markdown exportieren" onClick={() => exportNote(activeNote)}><Download size={15}/></button></div></div>
            {mode === 'edit' ? <><input ref={noteInputRef} className="note-title-input read-title" value={title} onChange={event => setTitle(event.target.value)} onBlur={commitTitle} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitTitle(); event.currentTarget.blur(); } }}/><div className="properties-row">Erstellt <span>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(activeNote.created))}</span></div><textarea ref={editorRef} className="markdown-editor" value={body} onChange={event => updateBody(event.target.value)} placeholder={'Schreib deinen Gedanken auf …\n\nTipp: Nutze #tags und [[Wikilinks]].'}/></> : <><h1 className="read-title">{activeNote.title}</h1><div className="properties-row">Erstellt <span>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(activeNote.created))}</span></div><div onClick={event => { if (!event.target.closest('input,a')) setMode('edit'); }}><MarkdownPreview source={body} onWiki={resolveWiki} onToggleTask={toggleTask}/></div></>}
            <div className="editor-footer"><span><i className="status-dot"/> Alle Änderungen gespeichert</span><span>Markdown · UTF-8</span></div>
          </article>}
        </section>
        <aside className="right-sidebar"><div className="right-head"><span>{activePdf ? 'PDF-DETAILS' : 'NOTIZ-DETAILS'}</span><CircleHelp size={15}/></div>{activeNote ? <><div className="detail-section"><span>BACKLINKS</span>{backlinks.length ? backlinks.map(note => <button key={note.id} className="detail-link" onClick={() => openNote(note.id)}>{note.title}</button>) : <p>Noch keine Rückverweise</p>}</div><div className="detail-section"><span>DATEI-INFORMATIONEN</span><p>{activeNote.path}</p></div><div className="detail-section"><span>WORTANZAHL</span><p>{wordCount} Wörter</p></div></> : activePdf ? <><div className="detail-section"><span>DATEI-INFORMATIONEN</span><p>{activePdf.path}</p></div><div className="detail-section"><span>DATEIGRÖSSE</span><p>{(activePdf.size / 1024 / 1024).toFixed(2)} MB</p></div></> : <div className="right-empty"><div className="detail-orbit">✳</div><strong>Alles an seinem Platz</strong><p>Öffne eine Notiz, um ihre Details und Verbindungen zu sehen.</p></div>}</aside>
      </div>
      <footer className="statusbar"><span><i className={`status-dot${auth.user && !cloudReady ? ' syncing' : ''}`}/> {auth.user ? cloudStatus : 'Lokal zwischengespeichert'}</span><span>{activeNote ? `${activeNote.title} · ${auth.user && cloudReady ? 'Cloud' : 'lokal'}` : activePdf?.name || 'Willkommen in atelier'}</span><span>{activePdf ? 'PDF · Firebase Storage' : 'Markdown · UTF-8'}</span></footer>
    </main>

    <DialogFrame open={Boolean(dialog)} onOpenChange={open => !open && setDialog('')} title={dialog === 'folder' ? 'Neuer Ordner' : dialog === 'vault' ? 'Neuer Vault' : dialog === 'vault-rename' ? 'Vault umbenennen' : 'Markdown-Vault importieren'} description={dialog === 'import' ? 'Wähle einen Ordner oder mehrere Markdown-Dateien aus.' : dialog === 'vault-rename' ? 'Vergib einen neuen Namen für diesen Arbeitsbereich.' : 'Gib einen Namen ein, um fortzufahren.'}>
      {dialog === 'folder' || dialog === 'vault' || dialog === 'vault-rename' ? <form className="dialog-form" onSubmit={event => { event.preventDefault(); if (dialog === 'folder') addFolder(); else if (dialog === 'vault-rename') renameVault(editingVaultId, field); else addVault(); }}><label htmlFor="name-field">{dialog === 'folder' ? 'Ordnername' : 'Vault-Name'}</label><input id="name-field" autoFocus value={field} onChange={event => setField(event.target.value)} placeholder={dialog === 'folder' ? 'z. B. Projekte' : 'Mein Projekt'}/>{dialog === 'folder' && folderParent && <p>Wird in „{folderParent}“ angelegt.</p>}<div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setDialog('')}>Abbrechen</button><button className="button button-primary">{dialog === 'vault-rename' ? 'Speichern' : 'Erstellen'}</button></div></form> : <div className="dialog-form"><p>Markdown-Dateien mit Ordnerstruktur auswählen:</p><div className="dialog-actions"><label className="button button-outline file-picker-label">Ordner wählen<input type="file" webkitdirectory="" directory="" multiple hidden onChange={pickFile}/></label><label className="button button-outline file-picker-label">Dateien wählen<input type="file" multiple accept=".md,.markdown,.txt" hidden onChange={pickFile}/></label></div></div>}
    </DialogFrame>

    <DialogFrame open={searchOpen} onOpenChange={setSearchOpen} title="Suche im Wissensgarten" description="Volltextsuche in allen Notizen dieses Vaults.">
      <div className="search-dialog"><div className="search-field"><Search size={17}/><input autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Notiz oder Inhalt suchen …" onKeyDown={event => { if (event.key === 'Enter' && results[0]) selectResult(results[0]); }}/></div><div className="search-results">{results.map(note => <button key={note.id} className="search-result" onClick={() => selectResult(note)}><FileText size={15}/><span><strong>{note.title}</strong><small>{note.path} · {note.body.slice(0, 100)}</small></span></button>)}{!results.length && <p className="empty-tree">Keine Treffer</p>}</div></div>
    </DialogFrame>
    <DialogFrame open={graphOpen} onOpenChange={setGraphOpen} title="Wissensgraph" description={`${vault.notes.length} Notizen in ${vault.name}`}><div className="graph-preview">{vault.notes.map(note => <button key={note.id} onClick={() => { openNote(note.id); setGraphOpen(false); }}>{note.title}</button>)}</div></DialogFrame>
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={open => !open && setConfirmation(null)} title={confirmation?.title || ''} description={confirmation?.description || ''} confirmLabel={confirmation?.confirmLabel} danger={confirmation?.danger} onConfirm={confirmation?.onConfirm || (() => setConfirmation(null))}/>
    <input id="vault-import" className="sr-only" type="file" multiple onChange={pickFile}/>
    {toast && <div className="toast" role="status">{toast}</div>}
    {savingNote && <div className="save-blocker" role="status" aria-live="polite"><span className="spinner"/><span>Änderungen werden gespeichert …</span></div>}
  </div>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute/>}/><Route path="/*" element={<AuthGate><Workspace/></AuthGate>}/></Routes></BrowserRouter>;
}
