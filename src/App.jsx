import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Command, FilePlus2, FileText, Search, Share2, PanelLeft, Plus, Network, Pencil, Trash2, Download, CircleHelp, MessageCircle } from 'lucide-react';
import { useAuth } from './auth/AuthProvider.jsx';
import FileTree from './components/FileTree.jsx';
import LoginPage from './components/LoginPage.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';
import ProfileMenu from './components/ProfileMenu.jsx';
import BrandMark from './components/BrandMark.jsx';
import DialogFrame from './components/ui/DialogFrame.jsx';
import ConfirmDialog from './components/ui/ConfirmDialog.jsx';
import KnowledgeChat from './components/KnowledgeChat.jsx';
import { validateChatCreation } from './chatCreation.js';

const DB_KEY = 'atelier-db-v1';
const SAVED_STATUS = 'Alle Änderungen gespeichert';
const LOADING_STATUS = 'Notizen werden geladen …';
const SAVING_STATUS = 'Änderungen werden gespeichert …';
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

function buildKnowledgeGraph(notes) {
  const byName = new Map();
  notes.forEach(note => {
    byName.set(note.title.toLocaleLowerCase(), note.id);
    byName.set(note.path.replace(/\.md$/i, '').toLocaleLowerCase(), note.id);
  });
  const edges = [];
  const seen = new Set();
  notes.forEach(note => {
    for (const match of note.body.matchAll(/\[\[([^\]]+)\]\]/g)) {
      const target = match[1].split('|')[0].split('#')[0].trim().toLocaleLowerCase();
      const targetId = byName.get(target);
      if (!targetId || targetId === note.id) continue;
      const key = [note.id, targetId].sort().join('<->');
      if (!seen.has(key)) { seen.add(key); edges.push({ source: note.id, target: targetId }); }
    }
  });

  const width = 1000; const height = 620; const center = { x: width / 2, y: height / 2 };
  const nodes = notes.map((note, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 70 + 190 * Math.sqrt((index + 0.5) / Math.max(notes.length, 1));
    const labelLength = Math.min(note.title.length, 24);
    return { ...note, nodeWidth: Math.max(112, Math.min(220, labelLength * 7.3 + 30)), x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
  const positions = new Map(nodes.map(node => [node.id, node]));
  for (let iteration = 0; iteration < 140; iteration += 1) {
    const forces = new Map(nodes.map(node => [node.id, { x: (center.x - node.x) * 0.002, y: (center.y - node.y) * 0.002 }]));
    for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i]; const b = nodes[j]; const dx = b.x - a.x; const dy = b.y - a.y;
      const distance = Math.max(1, Math.hypot(dx, dy)); const force = Math.max(0, (a.nodeWidth + b.nodeWidth) / 2 + 14 - distance) * 0.035;
      const fx = dx / distance * force; const fy = dy / distance * force;
      forces.get(a.id).x -= fx; forces.get(a.id).y -= fy; forces.get(b.id).x += fx; forces.get(b.id).y += fy;
    }
    for (const edge of edges) {
      const a = positions.get(edge.source); const b = positions.get(edge.target); if (!a || !b) continue;
      const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - (a.nodeWidth + b.nodeWidth) / 2 - 28) * 0.003;
      const fx = dx / distance * force; const fy = dy / distance * force;
      forces.get(a.id).x += fx; forces.get(a.id).y += fy; forces.get(b.id).x -= fx; forces.get(b.id).y -= fy;
    }
    for (const node of nodes) {
      const force = forces.get(node.id);
      node.x = Math.max(105, Math.min(width - 105, node.x + force.x));
      node.y = Math.max(36, Math.min(height - 36, node.y + force.y));
    }
  }
  return { nodes, edges, width, height };
}

function KnowledgeGraph({ notes, activeId, onOpen }) {
  const graph = useMemo(() => buildKnowledgeGraph(notes), [notes]);
  const positions = new Map(graph.nodes.map(node => [node.id, node]));
  return <div className="knowledge-graph">
    <svg viewBox={`0 0 ${graph.width} ${graph.height}`} role="img" aria-label={`Wissensgraph mit ${graph.nodes.length} Notizen und ${graph.edges.length} Verbindungen`}>
      <g className="graph-edges">{graph.edges.map(edge => { const source = positions.get(edge.source); const target = positions.get(edge.target); return <line key={`${edge.source}-${edge.target}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y}/>; })}</g>
      <g className="graph-nodes">{graph.nodes.map(node => {
        const degree = graph.edges.filter(edge => edge.source === node.id || edge.target === node.id).length;
        const label = node.title.length > 24 ? `${node.title.slice(0, 22)}…` : node.title;
        const nodeWidth = node.nodeWidth;
        return <g key={node.id} className={`graph-node${node.id === activeId ? ' active' : ''}${degree ? ' connected' : ' isolated'}`} transform={`translate(${node.x} ${node.y})`} role="button" tabIndex={0} aria-label={`Notiz öffnen: ${node.title}`} onClick={() => onOpen(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(node.id); } }}>
          <title>{node.title}{degree ? ` · ${degree} Verbindungen` : ' · keine Verbindungen'}</title>
          <rect x={-nodeWidth / 2} y="-19" width={nodeWidth} height="38" rx="19"/>
          <circle className="graph-node-dot" cx={-nodeWidth / 2 + 14} cy="0" r={degree ? 4 : 3}/>
          <text x="0" y="1">{label}</text>
        </g>;
      })}</g>
    </svg>
    <div className="graph-legend"><span><i className="graph-legend-link"/> Wikilink-Verbindung</span><span>{graph.nodes.length} Notizen · {graph.edges.length} Verbindungen</span></div>
  </div>;
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatEditNoteId, setChatEditNoteId] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(() => localStorage.getItem('atelier-details-collapsed') === 'true');
  const [sidebarWidth, setSidebarWidth] = useState(() => Math.max(190, Math.min(480, Number(localStorage.getItem('atelier-sidebar-width')) || 256)));
  const [toast, setToast] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(auth.user ? LOADING_STATUS : SAVED_STATUS);
  const [savingNote, setSavingNote] = useState(false);
  const [syncWake, setSyncWake] = useState(0);
  const [, setProfileVersion] = useState(0);
  const editorRef = useRef(null);
  const sidebarResizing = useRef(false);
  const noteInputRef = useRef(null);
  const focusTitleRef = useRef(false);
  const vault = db.vaults.find(item => item.id === vaultId) || db.vaults[0];
  const activeNote = vault?.notes.find(note => note.id === activeId) || null;
  const chatBesideDocument = chatOpen && Boolean(activeNote || activePdf);
  const standaloneChat = chatOpen && !chatBesideDocument;
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
  useEffect(() => { localStorage.setItem('atelier-details-collapsed', String(detailsCollapsed)); }, [detailsCollapsed]);
  useEffect(() => { const update = () => setProfileVersion(value => value + 1); window.addEventListener('atelier-profile-updated', update); return () => window.removeEventListener('atelier-profile-updated', update); }, []);
  useEffect(() => { const refresh = () => setDb(current => ({ ...current, vaults: [...current.vaults] })); window.addEventListener('online', refresh); return () => window.removeEventListener('online', refresh); }, []);
  useEffect(() => { if (activeNote) { setBody(activeNote.body); setTitle(activeNote.title); } }, [activeId, activeNote?.body, activeNote?.title]);
  useEffect(() => {
    if (!activeNote || mode !== 'edit') return;
    const frame = requestAnimationFrame(() => { (focusTitleRef.current ? noteInputRef.current : editorRef.current)?.focus(); focusTitleRef.current = false; });
    return () => cancelAnimationFrame(frame);
  }, [activeId, mode, activeNote]);
  useEffect(() => {
    if (!auth.user || !auth.db || !auth.firestoreSdk) { setCloudReady(false); setCloudStatus(auth.user ? LOADING_STATUS : SAVED_STATUS); return; }
    const fs = auth.firestoreSdk;
    const root = fs.collection(auth.db, 'users', auth.user.uid, 'vaults');
    let cancelled = false;
    let rootUnsubscribe;
    const noteUnsubscribes = new Map();
    const noteSnapshots = new Map();
    const readyVaults = new Set();
    let latestVaultDocs = [];
    let initializing = false;
    let rootServerReady = false;
    setCloudReady(false);
    setCloudStatus(LOADING_STATUS);

    const applyCloudSnapshot = (vaultDocs) => {
      if (cancelled || !rootServerReady || vaultDocs.some(item => !readyVaults.has(item.id))) return;
      const cloudVaults = vaultDocs.map(item => {
        const local = dbRef.current.vaults.find(vault => vault.id === item.id);
        const remoteNotes = noteSnapshots.get(item.id) || [];
        const deletedNoteIds = new Set(local?.deletedNoteIds || []);
        const notes = remoteNotes.filter(note => !deletedNoteIds.has(note.id)).map(note => {
          const localNote = local?.notes.find(candidate => candidate.id === note.id);
          const dirty = localNote && localNote.baseUpdatedAt !== undefined && (localNote.body !== localNote.baseBody || localNote.title !== localNote.baseTitle || localNote.path !== localNote.basePath || localNote.order !== localNote.baseOrder);
          return dirty ? localNote : { ...note, baseUpdatedAt: note.updatedAt, baseBody: note.body, baseTitle: note.title, basePath: note.path, baseOrder: note.order };
        });
        const remoteIds = new Set(remoteNotes.map(note => note.id));
        const pendingLocal = (local?.notes || []).filter(note => !remoteIds.has(note.id) && (note.baseUpdatedAt === undefined || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath || note.order !== note.baseOrder));
        return { id: item.id, name: item.data.name || 'Mein Wissensgarten', folders: item.data.folders || [], attachments: item.data.attachments || [], deletedNoteIds: [...deletedNoteIds], notes: [...notes, ...pendingLocal] };
      });
      if (cloudVaults.length) {
        setDb(current => JSON.stringify(current) === JSON.stringify({ vaults: cloudVaults }) ? current : { vaults: cloudVaults });
        setVaultId(current => cloudVaults.some(item => item.id === current) ? current : cloudVaults[0].id);
        setCloudReady(true);
        setCloudStatus(SAVED_STATUS);
      } else {
        setCloudReady(true);
        setCloudStatus(SAVED_STATUS);
      }
    };

    rootUnsubscribe = fs.onSnapshot(root, { includeMetadataChanges: true }, async snapshot => {
      if (cancelled) return;
      rootServerReady = !snapshot.metadata.fromCache;
      if (snapshot.empty && rootServerReady && !initializing) {
        initializing = true;
        try {
          await Promise.all(db.vaults.map(async item => {
            const vaultRef = fs.doc(root, item.id);
            await fs.setDoc(vaultRef, { name: item.name, folders: item.folders || [], attachments: item.attachments || [], updatedAt: Date.now() });
            const notesRef = fs.collection(vaultRef, 'notes');
            await Promise.all(item.notes.map(note => fs.setDoc(fs.doc(notesRef, note.id), { id: note.id, title: note.title, path: note.path, body: note.body, created: note.created, updated: note.updated, updatedAt: note.updated || Date.now() })));
          }));
        } catch (error) { if (!cancelled) setCloudStatus('Änderungen konnten nicht gespeichert werden'); }
        return;
      }
      const docs = snapshot.docs.map(item => ({ id: item.id, data: item.data() }));
      latestVaultDocs = docs;
      const currentIds = new Set(docs.map(item => item.id));
      for (const [id, unsubscribe] of noteUnsubscribes) if (!currentIds.has(id)) { unsubscribe(); noteUnsubscribes.delete(id); readyVaults.delete(id); noteSnapshots.delete(id); }
      for (const item of docs) if (!noteUnsubscribes.has(item.id)) {
        const notesRef = fs.collection(root, item.id, 'notes');
        noteUnsubscribes.set(item.id, fs.onSnapshot(notesRef, { includeMetadataChanges: true }, notes => {
          noteSnapshots.set(item.id, notes.docs.map(note => ({ id: note.id, ...note.data(), baseUpdatedAt: note.data().updatedAt, baseBody: note.data().body, baseTitle: note.data().title, basePath: note.data().path, baseOrder: note.data().order })));
          if (!notes.metadata.fromCache) readyVaults.add(item.id);
          applyCloudSnapshot(latestVaultDocs);
        }, () => setCloudStatus('Notizen konnten nicht geladen werden')));
      }
      applyCloudSnapshot(docs);
    }, () => { if (!cancelled) setCloudStatus('Verbindung fehlgeschlagen'); });

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
      setCloudStatus(mode === 'edit' && activeNote && !saveLockRef.current ? 'Änderungen werden beim Verlassen gespeichert …' : SAVING_STATUS);
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
          const deletedNoteIds = item.deletedNoteIds || [];
          if (!saveOnly && deletedNoteIds.length) {
            await Promise.all(deletedNoteIds.map(id => fs.deleteDoc(fs.doc(notesRef, id))));
            setDb(current => ({ vaults: current.vaults.map(vault => vault.id === item.id ? { ...vault, deletedNoteIds: (vault.deletedNoteIds || []).filter(id => !deletedNoteIds.includes(id)) } : vault) }));
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
        setCloudStatus(conflictsSaved ? 'Konflikt gesichert: beide Textfassungen bleiben erhalten' : deferredActiveNote ? 'Entwurf gespeichert' : SAVED_STATUS);
      } catch (error) { setCloudStatus('Offline · Änderungen werden später gespeichert'); }
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
    setCloudStatus(SAVING_STATUS);
    editorRef.current?.blur();
  }
  function openNote(id, nextMode = 'read') {
    if (saveLockRef.current) return;
    if (mode === 'edit') commitTitle();
    const note = vault.notes.find(item => item.id === id); if (!note) return;
    setChatEditNoteId(current => current === id ? current : null);
    setActivePdf(null); setActiveId(id); setTitle(note.title); setBody(note.body); setTabs(current => current.includes(id) ? current : [...current, id]); setMode(nextMode); setSidebarOpen(false);
  }
  function openNoteWithAI(id) {
    if (saveLockRef.current) return;
    openNote(id);
    setChatEditNoteId(id);
    setChatOpen(true);
  }
  async function applyChatEdit(target, markdown) {
    const matchesTarget = note => note?.id === target.id && note.title === target.title
      && note.path === target.path && note.body === target.body;
    const changedMessage = 'Die Notiz wurde seit dem Vorschlag geändert, verschoben oder gelöscht. Fordere einen neuen Vorschlag an.';
    const targetVault = dbRef.current.vaults.find(item => item.id === target.vaultId);
    const note = targetVault?.notes.find(item => item.id === target.id);
    if (vault.id !== target.vaultId || !matchesTarget(note)) throw new Error(changedMessage);
    if (saveLockRef.current || (mode === 'edit' && activeId === target.id)) {
      throw new Error('Beende zuerst die laufende Bearbeitung und warte, bis sie gespeichert ist.');
    }

    const updated = Date.now();
    if (!auth.user) {
      updateVault(current => ({
        ...current,
        notes: current.notes.map(item => matchesTarget(item) ? { ...item, body: markdown, updated } : item),
      }));
      return;
    }

    const fs = auth.firestoreSdk;
    if (!cloudReady || !fs || !auth.db || note.baseUpdatedAt === undefined
      || note.body !== note.baseBody || note.title !== note.baseTitle || note.path !== note.basePath) {
      throw new Error('Warte, bis die Notiz gespeichert ist, und versuche es erneut.');
    }
    const ref = fs.doc(auth.db, 'users', auth.user.uid, 'vaults', target.vaultId, 'notes', target.id);
    await fs.runTransaction(auth.db, async transaction => {
      const snapshot = await transaction.get(ref);
      const remote = snapshot.exists() ? snapshot.data() : null;
      if (!remote || !matchesTarget({ ...remote, id: snapshot.id }) || remote.updatedAt !== note.baseUpdatedAt) {
        throw new Error(changedMessage);
      }
      transaction.update(ref, { body: markdown, updated, updatedAt: updated });
    });
  }
  async function createChatItems(proposal) {
    const currentVault = dbRef.current.vaults.find(item => item.id === proposal.vaultId);
    if (vault.id !== proposal.vaultId || !currentVault) {
      throw new Error('Wechsle zum ursprünglichen Vault, um den Vorschlag zu speichern.');
    }
    validateChatCreation(currentVault, proposal);
    const now = Date.now();
    const counts = new Map();
    for (const note of currentVault.notes) {
      const folder = parentPath(note.path);
      counts.set(folder, (counts.get(folder) || 0) + 1);
    }
    const notes = proposal.notes.map(note => {
      const folder = parentPath(note.path);
      const order = counts.get(folder) || 0;
      counts.set(folder, order + 1);
      return { ...note, created: now, updated: now, order };
    });
    const withFolders = current => [...new Set([...(current.folders || []), ...proposal.folders])];
    if (!auth.user) {
      updateVault(current => ({
        ...current,
        folders: withFolders(current),
        notes: [...current.notes, ...notes.filter(note => !current.notes.some(existing => existing.id === note.id))],
      }));
      return;
    }

    const fs = auth.firestoreSdk;
    if (!cloudReady || !auth.db || !fs) throw new Error('Warte auf die Verbindung und versuche es erneut.');
    if (syncInFlight.current) throw new Error('Änderungen werden gerade gespeichert. Versuche es gleich erneut.');
    const vaultRef = fs.doc(auth.db, 'users', auth.user.uid, 'vaults', proposal.vaultId);
    const notesRef = fs.collection(vaultRef, 'notes');
    const paths = [...new Set([...proposal.folders, ...notes.map(note => note.path)])];
    const refs = notes.map(note => fs.doc(notesRef, note.id));
    syncInFlight.current = true;
    try {
      const before = await fs.getDocFromServer(vaultRef);
      if (!before.exists()) throw new Error('Der Vault ist nicht mehr vorhanden.');
      const revision = before.data().updatedAt;
      const pathsInUse = await fs.getDocsFromServer(fs.query(notesRef, fs.where('path', 'in', paths)));

      await fs.runTransaction(auth.db, async transaction => {
        const [remoteVault, ...existing] = await Promise.all([
          transaction.get(vaultRef), ...refs.map(ref => transaction.get(ref)),
        ]);
        if (!remoteVault.exists() || remoteVault.data().updatedAt !== revision) {
          throw new Error('Der Vault wurde gerade geändert. Versuche es erneut.');
        }
        const metadata = remoteVault.data();
        const remoteFiles = pathsInUse.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }));
        validateChatCreation({ ...metadata, notes: remoteFiles }, proposal);
        for (const [index, note] of notes.entries()) {
          if (existing[index].exists()) {
            const previous = existing[index].data();
            if (previous.path !== note.path || previous.title !== note.title || previous.body !== note.body) {
              throw new Error(`„${note.path}“ ist bereits belegt.`);
            }
          } else {
            transaction.set(refs[index], { ...note, updatedAt: now });
          }
        }
        transaction.update(vaultRef, { folders: withFolders(metadata), updatedAt: Math.max(now, (revision || 0) + 1) });
      });
      if (proposal.folders.length) {
        updateVault(current => ({ ...current, folders: withFolders(current) }));
      }
    } finally {
      syncInFlight.current = false;
      if (syncPending.current) {
        syncPending.current = false;
        setSyncWake(value => value + 1);
      }
    }
  }
  async function applyChatProposal(proposal) {
    if (saveLockRef.current) throw new Error('Warte, bis die laufende Änderung gespeichert ist.');
    if (proposal.kind === 'create') await createChatItems(proposal);
    else await applyChatEdit(proposal.target, proposal.markdown);
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
      updateVault(current => ({ ...current, notes: current.notes.filter(item => item.id !== id), deletedNoteIds: [...new Set([...(current.deletedNoteIds || []), id])] }));
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
      updateVault(current => ({ ...current, folders: current.folders.filter(item => !childFolders.includes(item)), notes: current.notes.filter(note => !removedIds.has(note.id)), deletedNoteIds: [...new Set([...(current.deletedNoteIds || []), ...removedIds])], attachments: (current.attachments || []).filter(file => !removedAttachments.some(removed => removed.id === file.id)) }));
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
      if (!auth.db || !auth.firestoreSdk) return notify('Die Verbindung wird noch hergestellt. Versuche es gleich erneut.');
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
      } catch (error) { return notify('Vault konnte nicht gelöscht werden.'); }
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
    setCloudStatus('PDF wird gespeichert …');
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
      setCloudStatus(SAVED_STATUS);
      notify(`${added.length} PDF-Datei(en) hinzugefügt`);
    } catch {
      setCloudStatus('PDF konnte nicht gespeichert werden');
      notify('PDF konnte nicht gespeichert werden.');
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
  const storageStatus = auth.user ? cloudStatus : SAVED_STATUS;
  const storageConfirmed = storageStatus === SAVED_STATUS || storageStatus === 'Entwurf gespeichert';
  const statusDotClass = storageConfirmed ? 'status-dot' : 'status-dot syncing';

  function preventFileDropNavigation(event) {
    // Drop targets in the file tree still receive the event and can import the files.
    if (event.dataTransfer.types.includes('Files')) event.preventDefault();
  }

  return <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` }}
    onDragOverCapture={preventFileDropNavigation} onDropCapture={preventFileDropNavigation}
    onPointerDown={event => { if (!saveLockRef.current && mode === 'edit' && activeNote && !event.target.closest('.note-view')) { commitTitle(); beginSaveBarrier(); setMode('read'); } }}>
    <aside className="rail"><Link to="/" className="brand-mark" aria-label="atelier Startseite" onClick={() => { setChatOpen(false); setActivePdf(null); setActiveId(null); setTabs([]); }}><BrandMark/></Link><button className={`rail-button${!chatOpen ? ' active' : ''}`} title="Dateien" onClick={() => { setChatOpen(false); setSidebarOpen(open => !open); }}><PanelLeft size={17}/></button><button className="rail-button" title="Suche" onClick={() => { setChatOpen(false); setSearchText(''); setSearchOpen(true); }}><Search size={17}/></button><button className={`rail-button${chatOpen ? ' active' : ''}`} title="Wissenschat" aria-label="Wissenschat" aria-pressed={chatOpen} onClick={() => setChatOpen(value => !value)}><MessageCircle size={17}/></button><button className="rail-button" title="Graph" onClick={() => { setChatOpen(false); setGraphOpen(true); }}><Network size={17}/></button><div className="rail-spacer"/><button className="rail-button" title="Befehlspalette" onClick={() => { setChatOpen(false); setSearchText(''); setSearchOpen(true); }}><Command size={17}/></button><ProfileMenu/></aside>
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
      <FileTree vault={vault} activeId={activeId} collapsed={collapsed} setCollapsed={setCollapsed} onOpen={openNote} onEditWithAI={openNoteWithAI} onRename={renameNote} onDelete={deleteNote} onMove={moveNote} onExport={exportNote} onCreateNote={createNote} onCreateFolder={startNewFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder} onImport={() => setDialog('import')} onExportVault={exportVault} onDragStart={dragStart} onMoveFolder={moveFolder} onReorder={reorderNote} onReorderFolder={reorderFolder} onImportAttachments={importAttachments} onOpenAttachment={openAttachment} onMoveAttachment={moveAttachment} onRenameAttachment={renameAttachment} onDeleteAttachment={deleteAttachment}/>
      <div className="sidebar-status"><span className={statusDotClass}/><span>{storageStatus}</span></div>
    </aside>
    <div className="sidebar-resizer" role="separator" aria-label="Breite der Seitenleiste ändern" aria-orientation="vertical" aria-valuemin={190} aria-valuemax={480} aria-valuenow={sidebarWidth} tabIndex={0}
      onPointerDown={event => { event.preventDefault(); event.stopPropagation(); sidebarResizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={resizeSidebar}
      onPointerUp={event => { event.stopPropagation(); sidebarResizing.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { sidebarResizing.current = false; }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSidebarWidth(width => Math.max(190, Math.min(480, width + (event.key === 'ArrowRight' ? 12 : -12)))); } }}/>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs">
          <span>{vault.name}</span><span className="crumb-sep">/</span>
          <strong>{standaloneChat ? 'Wissenschat' : activeNote?.title || activePdf?.name || 'Willkommen'}</strong>
        </div>
        <div className="topbar-actions">
          <button className="button button-ghost top-action" onClick={() => { setSearchText(''); setSearchOpen(true); }}>
            <Search size={16}/><span>Suchen</span><kbd>⌘ K</kbd>
          </button>
          {(activeNote || activePdf) && <button className="button button-outline top-action" type="button"
            aria-label="Wissenschat am Dokument" title="Wissenschat am Dokument" aria-pressed={chatOpen}
            onClick={() => setChatOpen(value => !value)}>
            <MessageCircle size={15}/><span>Wissenschat</span>
          </button>}
          {!standaloneChat && <button className="button button-outline top-action" onClick={exportVault}>
            <Share2 size={15}/> Exportieren
          </button>}
        </div>
      </header>
      <div className="tabs">{tabs.map(id => { const pdf = id.startsWith('pdf:') ? (vault.attachments || []).find(file => file.id === id.slice(4)) : null; const note = pdf ? null : vault.notes.find(item => item.id === id); const label = pdf?.name || note?.title; return label && <button key={id} className={`tab${(pdf ? activePdf?.id === pdf.id : activeId === id) ? ' active' : ''}`} onClick={() => activateTab(id)}><FileText size={14}/><span>{label}</span><span role="button" aria-label="Tab schließen" className="tab-close" onClick={event => { event.stopPropagation(); closeTab(id); }}>×</span></button>; })}</div>
      <div className={`content-wrap${detailsCollapsed ? ' details-collapsed' : ''}${standaloneChat ? ' chat-content-wrap' : chatBesideDocument ? ' chat-side-wrap' : ''}`}>
        <section className="editor-pane" hidden={standaloneChat} onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') || event.dataTransfer.types.includes('application/x-atelier-attachment')) event.preventDefault(); }}>
          {activePdf ? <div className="pdf-view"><div className="pdf-view-heading"><FileText size={17}/><span>{activePdf.path}</span><a className="button button-outline" href={activePdf.url} download={activePdf.name}>PDF herunterladen</a></div><iframe title={activePdf.name} src={activePdf.url} className="pdf-frame"/></div> : !activeNote ? <div className="welcome-view"><p className="eyebrow">DEINE DIGITALEN NOTIZEN</p><h1>Hallo <em>{(profileGreeting || auth.user?.displayName || 'Manuel').trim().split(/\s+/)[0]}.</em></h1><p className="welcome-copy">Ein ruhiger Ort für Gedanken, Wissen und alles, was du nicht vergessen möchtest.</p><div className="welcome-actions"><button className="button button-primary" onClick={createNote}><FilePlus2 size={16}/> Erste Notiz schreiben</button><button className="button button-outline" onClick={() => setDialog('import')}><Download size={15}/> Vault importieren</button></div><div className="welcome-divider"/><div className="recent-head"><div><p className="eyebrow">LOS GEHT’S</p><h2>Dein Arbeitsbereich</h2></div><span className="local-badge"><i className={statusDotClass}/> {storageStatus}</span></div><div className="start-grid"><button className="start-card" onClick={createNote}><FilePlus2 size={18}/><strong>Gedanken festhalten</strong><small>Eine neue Notiz beginnen</small></button><button className="start-card" onClick={() => { setChatOpen(true); }}><MessageCircle size={18}/><strong>Mit deinem Wissen chatten</strong><small>Fragen über alle Notizen stellen</small></button><button className="start-card" onClick={() => { setChatOpen(false); setSearchText(''); setSearchOpen(true); }}><Search size={18}/><strong>Wissen wiederfinden</strong><small>Alle Notizen durchsuchen</small></button></div></div> : <article className="note-view" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') || event.dataTransfer.types.includes('application/x-atelier-attachment')) event.preventDefault(); }} onDrop={dropInEditor} onClick={event => { if (mode === 'read' && !event.target.closest('button,a,input')) setMode('edit'); }}>
            <div className="note-heading"><div className="note-meta">{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(activeNote.updated))}<span>·</span>{wordCount} Wörter</div><div className="note-actions"><button className="button button-ghost mode-toggle" onClick={toggleNoteMode}>{mode === 'edit' ? 'Vorschau' : 'Bearbeiten'}</button><button className="icon-button" title="Umbenennen" onClick={() => { if (mode === 'edit') noteInputRef.current?.focus(); else { focusTitleRef.current = true; setMode('edit'); } }}><Pencil size={15}/></button><button className="icon-button" title="Markdown exportieren" onClick={() => exportNote(activeNote)}><Download size={15}/></button></div></div>
            {mode === 'edit' ? <><input ref={noteInputRef} className="note-title-input read-title" value={title} onChange={event => setTitle(event.target.value)} onBlur={commitTitle} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitTitle(); event.currentTarget.blur(); } }}/><div className="properties-row">Erstellt <span>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(activeNote.created))}</span></div><textarea ref={editorRef} className="markdown-editor" value={body} onChange={event => updateBody(event.target.value)} placeholder={'Schreib deinen Gedanken auf …\n\nTipp: Nutze #tags und [[Wikilinks]].'}/></> : <><h1 className="read-title">{activeNote.title}</h1><div className="properties-row">Erstellt <span>{new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(activeNote.created))}</span></div><div onClick={event => { if (!event.target.closest('input,a')) setMode('edit'); }}><MarkdownPreview source={body} onWiki={resolveWiki} onToggleTask={toggleTask}/></div></>}
            <div className="editor-footer"><span><i className={statusDotClass}/> {storageStatus}</span><span>Markdown · UTF-8</span></div>
          </article>}
        </section>
        {!chatOpen && <aside className={`right-sidebar${detailsCollapsed ? ' collapsed' : ''}`}><div className="right-head">{!detailsCollapsed && <><span>{activePdf ? 'PDF-DETAILS' : 'NOTIZ-DETAILS'}</span><CircleHelp size={15}/></>}<button className="icon-button details-toggle" type="button" title={detailsCollapsed ? 'Details einblenden' : 'Details einklappen'} aria-label={detailsCollapsed ? 'Details einblenden' : 'Details einklappen'} aria-expanded={!detailsCollapsed} onClick={() => setDetailsCollapsed(value => !value)}>{detailsCollapsed ? <ChevronLeft size={15}/> : <ChevronRight size={15}/>}</button></div>{!detailsCollapsed && (activeNote ? <><div className="detail-section"><span>BACKLINKS</span>{backlinks.length ? backlinks.map(note => <button key={note.id} className="detail-link" onClick={() => openNote(note.id)}>{note.title}</button>) : <p>Noch keine Rückverweise</p>}</div><div className="detail-section"><span>DATEI-INFORMATIONEN</span><p>{activeNote.path}</p></div><div className="detail-section"><span>WORTANZAHL</span><p>{wordCount} Wörter</p></div></> : activePdf ? <><div className="detail-section"><span>DATEI-INFORMATIONEN</span><p>{activePdf.path}</p></div><div className="detail-section"><span>DATEIGRÖSSE</span><p>{(activePdf.size / 1024 / 1024).toFixed(2)} MB</p></div></> : <div className="right-empty"><div className="detail-orbit">✳</div><strong>Alles an seinem Platz</strong><p>Öffne eine Notiz, um ihre Details und Verbindungen zu sehen.</p></div>)}</aside>}
        <div className="knowledge-chat-pane" hidden={!chatOpen}>
          <KnowledgeChat
            key={vault.id}
            vault={vault}
            currentNote={activeNote}
            open={chatOpen}
            compact={chatBesideDocument}
            editingNote={activeNote?.id === chatEditNoteId ? activeNote : null}
            onEditModeChange={enabled => setChatEditNoteId(enabled ? activeNote?.id : null)}
            onOpenSource={openNote}
            onApplyProposal={applyChatProposal}
            onClose={() => setChatOpen(false)}
          />
        </div>
      </div>
      <footer className="statusbar"><span><i className={statusDotClass}/> {storageStatus}</span><span>{activeNote?.title || activePdf?.name || 'Willkommen in atelier'}</span><span>{activePdf ? 'PDF' : 'Markdown · UTF-8'}</span></footer>
    </main>

    <DialogFrame open={Boolean(dialog)} onOpenChange={open => !open && setDialog('')} title={dialog === 'folder' ? 'Neuer Ordner' : dialog === 'vault' ? 'Neuer Vault' : dialog === 'vault-rename' ? 'Vault umbenennen' : 'Markdown-Vault importieren'} description={dialog === 'import' ? 'Wähle einen Ordner oder mehrere Markdown-Dateien aus.' : dialog === 'vault-rename' ? 'Vergib einen neuen Namen für diesen Arbeitsbereich.' : 'Gib einen Namen ein, um fortzufahren.'}>
      {dialog === 'folder' || dialog === 'vault' || dialog === 'vault-rename' ? <form className="dialog-form" onSubmit={event => { event.preventDefault(); if (dialog === 'folder') addFolder(); else if (dialog === 'vault-rename') renameVault(editingVaultId, field); else addVault(); }}><label htmlFor="name-field">{dialog === 'folder' ? 'Ordnername' : 'Vault-Name'}</label><input id="name-field" autoFocus value={field} onChange={event => setField(event.target.value)} placeholder={dialog === 'folder' ? 'z. B. Projekte' : 'Mein Projekt'}/>{dialog === 'folder' && folderParent && <p>Wird in „{folderParent}“ angelegt.</p>}<div className="dialog-actions"><button type="button" className="button button-ghost" onClick={() => setDialog('')}>Abbrechen</button><button className="button button-primary">{dialog === 'vault-rename' ? 'Speichern' : 'Erstellen'}</button></div></form> : <div className="dialog-form"><p>Markdown-Dateien mit Ordnerstruktur auswählen:</p><div className="dialog-actions"><label className="button button-outline file-picker-label">Ordner wählen<input type="file" webkitdirectory="" directory="" multiple hidden onChange={pickFile}/></label><label className="button button-outline file-picker-label">Dateien wählen<input type="file" multiple accept=".md,.markdown,.txt" hidden onChange={pickFile}/></label></div></div>}
    </DialogFrame>

    <DialogFrame open={searchOpen} onOpenChange={setSearchOpen} title="Suche im Wissensgarten" description="Volltextsuche in allen Notizen dieses Vaults.">
      <div className="search-dialog"><div className="search-field"><Search size={17}/><input autoFocus value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Notiz oder Inhalt suchen …" onKeyDown={event => { if (event.key === 'Enter' && results[0]) selectResult(results[0]); }}/></div><div className="search-results">{results.map(note => <button key={note.id} className="search-result" onClick={() => selectResult(note)}><FileText size={15}/><span><strong>{note.title}</strong><small>{note.path} · {note.body.slice(0, 100)}</small></span></button>)}{!results.length && <p className="empty-tree">Keine Treffer</p>}</div></div>
    </DialogFrame>
    <DialogFrame open={graphOpen} onOpenChange={setGraphOpen} title="Wissensgraph" description={`${vault.notes.length} Notizen in ${vault.name}`} className="graph-dialog"><KnowledgeGraph notes={vault.notes} activeId={activeId} onOpen={id => { openNote(id); setGraphOpen(false); }}/></DialogFrame>
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={open => !open && setConfirmation(null)} title={confirmation?.title || ''} description={confirmation?.description || ''} confirmLabel={confirmation?.confirmLabel} danger={confirmation?.danger} onConfirm={confirmation?.onConfirm || (() => setConfirmation(null))}/>
    <input id="vault-import" className="sr-only" type="file" multiple onChange={pickFile}/>
    {toast && <div className="toast" role="status">{toast}</div>}
    {savingNote && <div className="save-blocker" role="status" aria-live="polite"><span className="spinner"/><span>Änderungen werden gespeichert …</span></div>}
  </div>;
}

export default function App() {
  return <BrowserRouter><Routes><Route path="/login" element={<LoginRoute/>}/><Route path="/*" element={<AuthGate><Workspace/></AuthGate>}/></Routes></BrowserRouter>;
}
