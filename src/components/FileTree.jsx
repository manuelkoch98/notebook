import { useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, MoreHorizontal, Pencil, Plus, Trash2, Download, MoveRight, CornerDownRight, CornerUpLeft } from 'lucide-react';

const pathParent = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const basename = path => path.slice(path.lastIndexOf('/') + 1);

function MenuItem({ children, icon: Icon, danger = false, ...props }) {
  return <ContextMenu.Item className={`menu-item${danger ? ' danger' : ''}`} {...props}>{Icon && <Icon size={15}/>}<span>{children}</span></ContextMenu.Item>;
}

function NoteRow({ note, active, folders, onOpen, onRename, onDelete, onMove, onExport, onDragStart, onDragEnd }) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(note.title);
  function startRename() { setDraft(note.title); setRenaming(true); }
  function finishRename() { const next = draft.trim(); if (next && next !== note.title) onRename(note.id, next); setRenaming(false); }
  const row = <div role="treeitem" tabIndex={0} draggable={!renaming} className={`tree-note${active ? ' selected' : ''}${renaming ? ' renaming' : ''}`}
    onClick={() => !renaming && onOpen(note.id)} onDoubleClick={startRename}
    onKeyDown={event => { if (renaming) { if (event.key === 'Enter') { event.preventDefault(); finishRename(); } if (event.key === 'Escape') setRenaming(false); return; } if (event.key === 'Enter') { event.preventDefault(); startRename(); } }}
    onDragStart={event => onDragStart(event, note)} onDragEnd={onDragEnd} onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) event.preventDefault(); }}>
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

export default function FileTree({ vault, activeId, collapsed, setCollapsed, onOpen, onRename, onDelete, onMove, onExport, onCreateNote, onCreateFolder, onImport, onExportVault, onDragStart }) {
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const folders = [...new Set(vault.folders || [])].sort((a, b) => a.localeCompare(b, 'de'));
  const notes = vault.notes;
  const folderChildren = parent => folders.filter(folder => pathParent(folder) === parent);
  const noteChildren = parent => notes.filter(note => pathParent(note.path) === parent).sort((a, b) => a.title.localeCompare(b.title, 'de'));
  const toggle = folder => setCollapsed(current => { const next = new Set(current); next.has(folder) ? next.delete(folder) : next.add(folder); return next; });
  const startDrag = (event, note) => { setDragging(true); onDragStart(event, note); };
  const finishDrag = () => { setDragging(false); setDropTarget(''); };
  const acceptDrop = (event, folder) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('application/x-atelier-note'); if (id) onMove(id, folder); finishDrag(); };

  function renderFolder(folder, depth = 0) {
    const isCollapsed = collapsed.has(folder);
    const contents = [];
    if (!isCollapsed) {
      noteChildren(folder).forEach(note => contents.push(<NoteRow key={note.id} note={note} active={activeId === note.id} folders={folders} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onMove={onMove} onExport={onExport} onDragStart={startDrag} onDragEnd={finishDrag}/>));
      folderChildren(folder).forEach(child => contents.push(renderFolder(child, depth + 1)));
    }
    return <div className="tree-folder-group" key={folder}>
      <div role="treeitem" aria-expanded={!isCollapsed} tabIndex={0} className={`tree-folder${dropTarget === folder ? ' drop-target' : ''}`} style={{ '--tree-depth': depth }}
        onClick={() => toggle(folder)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(folder); } }}
        onDragEnter={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) setDropTarget(folder); }}
        onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) event.preventDefault(); }}
        onDrop={event => acceptDrop(event, folder)}>
        <button type="button" className="disclosure-button" aria-label={isCollapsed ? 'Ordner ausklappen' : 'Ordner einklappen'} tabIndex={-1}>{isCollapsed ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}</button>
        {isCollapsed ? <Folder size={15} className="tree-folder-icon"/> : <FolderOpen size={15} className="tree-folder-icon"/>}<span className="tree-label">{basename(folder)}</span>{dropTarget === folder && <small className="move-hint">Ebene {folder.split('/').length} · {folder}</small>}
      </div>
      {!isCollapsed && <div className="tree-children">{contents}</div>}
    </div>;
  }

  const rows = [...folderChildren('').map(folder => renderFolder(folder)), ...noteChildren('').map(note => <NoteRow key={note.id} note={note} active={activeId === note.id} folders={folders} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onMove={onMove} onExport={onExport} onDragStart={startDrag} onDragEnd={finishDrag}/> )];
  return <section className="file-tree-panel" aria-label="Dateien">
    <div className="tree-panel-head"><span>Dateien</span><div className="tree-quick-actions"><button className="icon-button" title="Neue Notiz" onClick={onCreateNote}><Plus size={16}/></button><button className="icon-button" title="Neuer Ordner" onClick={onCreateFolder}><FolderOpen size={15}/></button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="icon-button" title="Dateimenü" aria-label="Dateimenü"><MoreHorizontal size={16}/></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="dropdown-menu" align="end" sideOffset={5}><DropdownMenu.Item className="dropdown-item" onSelect={onImport}><Download size={15}/>Importieren</DropdownMenu.Item><DropdownMenu.Item className="dropdown-item" onSelect={onExportVault}><Download size={15}/>Vault exportieren</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div></div>
    <div role="tree" className="file-tree" onDragOver={event => { if (event.dataTransfer.types.includes('application/x-atelier-note')) event.preventDefault(); }} onDrop={event => acceptDrop(event, '')}><div className={`root-dropzone${dragging ? ' visible' : ''}${dropTarget === '__root__' ? ' drop-target' : ''}`} onDragEnter={() => setDropTarget('__root__')} onDragOver={event => event.preventDefault()} onDrop={event => acceptDrop(event, '')}><CornerUpLeft size={14}/><span>Hauptebene</span><small className="move-hint">/</small></div>{rows.length ? rows : <div className="empty-tree">Noch keine Notizen</div>}</div>
  </section>;
}
