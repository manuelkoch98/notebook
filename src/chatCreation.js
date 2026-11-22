const pathKey = path => path.normalize('NFC').toLocaleLowerCase('de');
const parentPath = path => path.slice(0, Math.max(0, path.lastIndexOf('/')));

function pathPart(value) {
  const part = value.normalize('NFC').trim();
  if (!part || part === '.' || part === '..' || part.length > 150 || /[\\/:*?"<>|\x00-\x1f]/.test(part)) {
    throw new Error('Ein vorgeschlagener Datei- oder Ordnername ist ungültig.');
  }
  return part;
}

function folderPath(value) {
  return value.split('/').map(pathPart).join('/');
}

export function prepareChatCreation(vault, reply) {
  const knownFolders = new Map((vault.folders || []).map(path => [pathKey(path), path]));
  const folders = [];
  for (const requested of reply.folders) {
    let parent = '';
    for (const part of folderPath(requested).split('/')) {
      const path = parent ? `${parent}/${part}` : part;
      const known = knownFolders.get(pathKey(path));
      if (!known) {
        knownFolders.set(pathKey(path), path);
        folders.push(path);
      }
      parent = known || path;
    }
  }

  const notes = reply.notes.map(({ title, folder, markdown }) => {
    const name = pathPart(title.trim().replace(/\.md$/i, ''));
    const parent = folder ? knownFolders.get(pathKey(folderPath(folder))) : '';
    if (parent === undefined) throw new Error(`Der Zielordner „${folder}“ fehlt im Vorschlag.`);
    if (new TextEncoder().encode(markdown).length > 24_000) {
      throw new Error(`Der Vorschlag für „${name}“ ist zu lang (maximal 24 KB pro Notiz).`);
    }
    return { id: crypto.randomUUID(), title: name, path: [parent, `${name}.md`].filter(Boolean).join('/'), body: markdown };
  });

  if (folders.length + notes.length > 25) throw new Error('Teile den Auftrag bitte auf höchstens 25 Ordner und Notizen pro Vorschlag auf.');
  if (!folders.length && !notes.length) throw new Error('Die vorgeschlagenen Ordner sind bereits vorhanden.');
  const proposal = { kind: 'create', vaultId: vault.id, folders, notes };
  validateChatCreation(vault, proposal);
  return proposal;
}

export function validateChatCreation(vault, proposal) {
  const folders = new Map((vault.folders || []).map(path => [pathKey(path), path]));
  const files = new Map([...(vault.notes || []), ...(vault.attachments || [])].map(file => [pathKey(file.path), file]));
  const plannedPaths = new Set();

  function requireParent(path) {
    const parent = parentPath(path);
    if (parent && folders.get(pathKey(parent)) !== parent) {
      throw new Error(`Der Zielordner „${parent}“ ist nicht mehr vorhanden. Fordere einen neuen Vorschlag an.`);
    }
  }

  for (const path of proposal.folders) {
    requireParent(path);
    const key = pathKey(path);
    const existing = folders.get(key);
    if (files.has(key) || (existing && existing !== path)) throw new Error(`„${path}“ ist bereits belegt.`);
    folders.set(key, path);
  }
  for (const note of proposal.notes) {
    requireParent(note.path);
    const key = pathKey(note.path);
    const existing = files.get(key);
    const alreadySaved = existing?.id === note.id && existing.path === note.path && existing.body === note.body;
    if (folders.has(key) || plannedPaths.has(key) || (existing && !alreadySaved)) {
      throw new Error(`„${note.path}“ ist bereits belegt. Wähle einen anderen Namen.`);
    }
    plannedPaths.add(key);
  }
}
