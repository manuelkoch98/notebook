import { useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2, Download, MoveRight, CornerDownRight, CornerUpLeft } from 'lucide-react';

const pathParent = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const basename = path => path.slice(path.lastIndexOf('/') + 1);
const NOTE_MIME = 'application/x-atelier-note';
const FOLDER_MIME = 'application/x-atelier-folder';
const hasFileDrag = event => event.dataTransfer.types.includes(NOTE_MIME) || event.dataTransfer.types.includes(FOLDER_MIME);

function MenuItem({ children, icon: Icon, danger = false, ...props }) {
  return <ContextMenu.Item className={`menu-item${danger ? ' danger' : ''}`} {...props}>{Icon && <Icon size={15}/>}<span>{children}</span></ContextMenu.Item>;
}

function NoteRow({ note, active, folders, onOpen, onRename, onDelete, onMove, onReorder, onExport, onDragStart, onDragEnd, draggedNoteId, dropTarget, onSetDropTarget }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(note.title);
  function startRename() { setDraft(note.title); setRenaming(true); }
  function finishRename() { const next = draft.trim(); if (next && next !== note.title) onRename(note.id, next); setRenaming(false); }
  const dropBefore = dropTarget === `note:${note.id}:before`;
  const dropAfter = dropTarget === `note:${note.id}:after`;
  const row = <div role="treeitem" tabIndex={0} draggable={!renaming} className={`tree-note${active ? ' selected' : ''}${renaming ? ' renaming' : ''}${dropBefore ? ' drop-before' : ''}${dropAfter ? ' drop-after' : ''}`}
    onClick={event => { if (event.currentTarget.closest('.file-tree')?.dataset.suppressClick === 'true') { event.currentTarget.closest('.file-tree').dataset.suppressClick = 'false'; event.preventDefault(); event.stopPropagation(); return; } if (!renaming) onOpen(note.id); }} onDoubleClick={startRename}
    onKeyDown={event => { if (renaming) { if (event.key === 'Enter') { event.preventDefault(); finishRename(); } if (event.key === 'Escape') setRenaming(false); return; } if (event.key === 'Enter') { event.preventDefault(); startRename(); } }}
    onDragStart={event => onDragStart(event, note)} onDragEnd={onDragEnd}
    onDragEnter={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') && draggedNoteId !== note.id) onSetDropTarget(`note:${note.id}:${event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2 ? 'before' : 'after'}`); }}
    onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note') && draggedNoteId !== note.id) { event.preventDefault(); onSetDropTarget(`note:${note.id}:${event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2 ? 'before' : 'after'}`); } }}
    onDrop={event => { const id = event.dataTransfer.getData('application/x-atelier-note'); if (!id || id === note.id) return; event.preventDefault(); event.stopPropagation(); const after = event.clientY >= event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2; onReorder(id, note.id, after); onDragEnd(); }}>
    <span className="tree-disclosure-spacer"/><FileText size={15} className="tree-file-icon"/>
    {renaming ? <input autoFocus value={draft} onClick={event => event.stopPropagation()} onChange={event => setDraft(event.target.value)} onBlur={finishRename} className="tree-rename-input" aria-label="Notiz umbenennen"/> : <span className="tree-label">{note.title}</span>}
  </div>;

  return <ContextMenu.Root>
    <ContextMenu.Trigger asChild>{row}</ContextMenu.Trigger>
    <ContextMenu.Portal><ContextMenu.Content className="context-menu" onCloseAutoFocus={event => event.preventDefault()}>
      <div className="menu-heading">{note.title}</div>
      <MenuItem icon={CornerDownRight} onSelect={() => onOpen(note.id)}>Öffnen</MenuItem>
      <MenuItem icon={Pencil} onSelect={startRename}>Umbenennen <kbd>↵</kbd></MenuItem>
      <ContextMenu.Sub><ContextMenu.SubTrigger className="menu-item"><MoveRight size={15}/><span>In Ordner verschieben</span><ChevronRight size={14} className="menu-chevron"/></ContextMenu.SubTrigger><ContextMenu.Portal><ContextMenu.SubContent className="context-menu">{folders.length ? folders.map(folder => <MenuItem key={folder} icon={Folder} onSelect={() => onMove(note.id, folder)}>{folder}</MenuItem>) : <div className="menu-empty">Noch keine Ordner</div>}<MenuItem icon={FolderOpen} onSelect={() => onMove(note.id, '')}>Hauptordner</MenuItem></ContextMenu.SubContent></ContextMenu.Portal></ContextMenu.Sub>
      <MenuItem icon={Download} onSelect={() => onExport(note)}>Markdown exportieren</MenuItem>
      <ContextMenu.Separator className="menu-separator"/>
      <MenuItem icon={Trash2} danger onSelect={() => onDelete(note.id)}>Löschen</MenuItem>
    </ContextMenu.Content></ContextMenu.Portal>
  </ContextMenu.Root>;
}

export default function FileTree({ vault, activeId, collapsed, setCollapsed, onOpen, onRename, onDelete, onMove, onReorder, onExport, onCreateNote, onCreateFolder, onImport, onExportVault, onDragStart, onMoveFolder }) {
  const treeRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const [draggedFolder, setDraggedFolder] = useState('');
  const [draggedNoteId, setDraggedNoteId] = useState('');
  const folders = [...new Set(vault.folders || [])].sort((a, b) => a.localeCompare(b, 'de'));
  const notes = vault.notes;
  const folderChildren = parent => folders.filter(folder => pathParent(folder) === parent);
  const noteChildren = parent => { const siblings = notes.filter(note => pathParent(note.path) === parent); const alphabetical = [...siblings].sort((a, b) => a.title.localeCompare(b.title, 'de')); const fallback = new Map(alphabetical.map((note, index) => [note.id, index])); return alphabetical.sort((a, b) => (Number.isFinite(a.order) ? a.order : fallback.get(a.id)) - (Number.isFinite(b.order) ? b.order : fallback.get(b.id)) || a.title.localeCompare(b.title, 'de')); };
  const toggle = folder => setCollapsed(current => { const next = new Set(current); next.has(folder) ? next.delete(folder) : next.add(folder); return next; });
  const startDrag = (event, note) => { setDragging(true); setDraggedNoteId(note.id); if (treeRef.current) treeRef.current.dataset.suppressClick = 'true'; onDragStart(event, note); };
  const startFolderDrag = (event, folder) => { setDragging(true); setDraggedNoteId(''); setDraggedFolder(folder); onDragStart(event, folder, 'folder'); };
  const canDropOn = folder => !draggedFolder || (folder !== draggedFolder && !folder.startsWith(`${draggedFolder}/`));
  const finishDrag = () => { setDragging(false); setDraggedNoteId(''); setDraggedFolder(''); setDropTarget(''); window.setTimeout(() => { if (treeRef.current) treeRef.current.dataset.suppressClick = 'false'; }, 350); };
  const acceptDrop = (event, folder) => { event.preventDefault(); event.stopPropagation(); const folderPath = event.dataTransfer.getData(FOLDER_MIME); const id = event.dataTransfer.getData(NOTE_MIME); if (folderPath && canDropOn(folder)) onMoveFolder(folderPath, folder); else if (id) onMove(id, folder); finishDrag(); };

  function renderFolder(folder, depth = 0) {
    const isCollapsed = collapsed.has(folder);
    const contents = [];
    if (!isCollapsed) {
      noteChildren(folder).forEach(note => contents.push(<NoteRow key={note.id} note={note} active={activeId === note.id} folders={folders} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onMove={onMove} onReorder={onReorder} onExport={onExport} onDragStart={startDrag} onDragEnd={finishDrag} draggedNoteId={draggedNoteId} dropTarget={dropTarget} onSetDropTarget={setDropTarget}/>));
      folderChildren(folder).forEach(child => contents.push(renderFolder(child, depth + 1)));
    }
    return <div className="tree-folder-group" key={folder}>
      <div role="treeitem" aria-expanded={!isCollapsed} tabIndex={0} className={`tree-folder${dropTarget === folder ? ' drop-target' : ''}`} style={{ '--tree-depth': depth }} data-folder-path={folder} draggable onDragStart={event => startFolderDrag(event, folder)} onDragEnd={finishDrag}
        onClick={() => toggle(folder)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(folder); } }}
        onDragEnter={event => { if (hasFileDrag(event) && canDropOn(folder)) setDropTarget(folder); }}
        onDragOver={event => { if (hasFileDrag(event) && canDropOn(folder)) event.preventDefault(); }}
        onDrop={event => acceptDrop(event, folder)}>
        <button type="button" className="disclosure-button" aria-label={isCollapsed ? 'Ordner ausklappen' : 'Ordner einklappen'} tabIndex={-1}>{isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button>
        {isCollapsed ? <Folder size={15} className="tree-folder-icon"/> : <FolderOpen size={15} className="tree-folder-icon"/>}<span className="tree-label">{basename(folder)}</span>
      </div>
      {!isCollapsed && <div className="tree-children">{contents}</div>}
    </div>;
  }

  const rows = [...folderChildren('').map(folder => renderFolder(folder)), ...noteChildren('').map(note => <NoteRow key={note.id} note={note} active={activeId === note.id} folders={folders} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onMove={onMove} onReorder={onReorder} onExport={onExport} onDragStart={startDrag} onDragEnd={finishDrag} draggedNoteId={draggedNoteId} dropTarget={dropTarget} onSetDropTarget={setDropTarget}/> )];
  return <section className="file-tree-panel" aria-label="Dateien">
    <div className="tree-panel-head"><span>Dateien</span><div className="tree-quick-actions"><button className="icon-button" title="Neue Notiz" onClick={onCreateNote}><Plus size={16}/></button><button className="icon-button" title="Neuer Ordner" onClick={onCreateFolder}><FolderOpen size={15}/></button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="icon-button" title="Dateimenü" aria-label="Dateimenü"><MoreHorizontal size={16}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="dropdown-menu" align="end" sideOffset={5}><DropdownMenu.Item className="dropdown-item" onSelect={onImport}><Download size={15}/>Importieren</DropdownMenu.Item><DropdownMenu.Item className="dropdown-item" onSelect={onExportVault}><Download size={15}/>Vault exportieren</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div>
    <div ref={treeRef} role="tree" className="file-tree" onDragOver={event => { if (!hasFileDrag(event)) return; const folderRow = event.target.closest('.tree-folder'); if (folderRow) { if (canDropOn(folderRow.dataset.folderPath)) event.preventDefault(); return; } if (event.target.closest('.tree-note')) return; event.preventDefault(); }} onDrop={event => { if (event.target.closest('.tree-folder,.tree-note')) return; acceptDrop(event, ''); }}><div className={`root-dropzone${dragging ? ' visible' : ''}${dropTarget === '__root__' ? ' drop-target' : ''}`} onDragEnter={() => setDropTarget('__root__')} onDragOver={event => { if (hasFileDrag(event)) event.preventDefault(); }} onDrop={event => acceptDrop(event, '')}><CornerUpLeft size={14}/><span>Hauptebene</span><small className="move-hint">/</small></div>{rows.length ? rows : <div className="empty-tree">Noch keine Notizen</div>}</div>
  </section>;
}
