import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bot, FileText, Folder, Link2, LogOut, MessageCircle, Plus, Search, Send, Sparkles, X } from 'lucide-react';
import DialogFrame from './ui/DialogFrame.jsx';
import { prepareChatCreation } from '../chatCreation.js';

const previewChat = import.meta.env.DEV
  && import.meta.env.MODE === 'chat-preview'
  && !window.ATELIER_FIREBASE?.enabled;

const normalize = value => value.normalize('NFC').toLocaleLowerCase('de');

function mentions(text, label) {
  return label.length >= 3 && normalize(text).includes(normalize(label));
}

function buildWorkspace(vault, question, messages, currentNote, relevant) {
  const recent = messages.slice(-6);
  const dialogue = [question, ...recent.map(message => message.content)].join('\n');
  const referencedIds = new Set(recent.flatMap(message => message.sources?.map(source => source.id) || []));
  const namedNotes = vault.notes.filter(note => mentions(dialogue, note.path) || mentions(dialogue, note.title));
  const candidates = [currentNote, ...namedNotes, ...vault.notes.filter(note => referencedIds.has(note.id)), ...relevant].filter(Boolean);
  const uniqueNotes = [...new Map(candidates.map(note => [note.id, note])).values()].slice(0, 16);
  const currentFolder = currentNote?.path.split('/').slice(0, -1).join('/');
  const folders = (vault.folders || []).filter(folder => folder === currentFolder
    || mentions(dialogue, folder) || mentions(dialogue, folder.split('/').at(-1)));
  return {
    currentNoteId: currentNote?.id ?? null,
    notes: uniqueNotes.map(({ id, title, path }) => ({ id, title, path })),
    folders,
  };
}

function previewWorkspaceReply({ question, workspace }) {
  const request = normalize(question);
  if (/\b(?:erstelle|erzeuge|lege|anlegen|neue|schreibe)\b/u.test(request) && /ordner|notiz|datei|\.md\b/u.test(request)) {
    const folders = [];
    const titles = [];
    const groups = question.split(/\b(ordner|notizen?|dateien?)\b/iu);
    for (let index = 1; index < groups.length; index += 2) {
      const names = [...groups[index + 1].matchAll(/[„"«‹]([^”"»“›]+)[”"»“›]/gu)].map(match => match[1]);
      if (groups[index].toLocaleLowerCase('de') === 'ordner') folders.push(...names);
      else titles.push(...names);
    }
    const destination = folders[0] || workspace.folders.find(folder => mentions(question, folder)) || '';
    if (!titles.length && /notiz|datei|\.md\b/u.test(request)) titles.push('Chat-Testnotiz');
    return {
      kind: 'create',
      summary: 'Hier ist der Vorschlag aus der lokalen Chatvorschau.',
      folders,
      notes: titles.map(title => ({
        title, folder: destination, markdown: '## Lokale Testnotiz\n\nDieser Inhalt stammt aus der lokalen Chatvorschau.\n',
      })),
    };
  }
  if (/bearbeit|ändere|kürze|ergänz|überarbeit/u.test(request)) {
    const note = workspace.notes.find(item => mentions(question, item.path) || mentions(question, item.title))
      || workspace.notes.find(item => item.id === workspace.currentNoteId);
    return note
      ? { kind: 'edit', noteId: note.id, instruction: question }
      : { kind: 'reply', message: 'Welche Notiz möchtest du bearbeiten?' };
  }
  return { kind: 'reply', message: 'Das ist eine lokale Testantwort. Hier kannst du das Chatverhalten ausprobieren.' };
}

async function requestChat(payload) {
  if (previewChat) {
    await new Promise(resolve => window.setTimeout(resolve, 1200));
    if (payload.noteEdit) {
      return JSON.stringify({
        summary: 'Ich habe einen Beispielabschnitt ergänzt.',
        markdown: payload.noteEdit.markdown.trimEnd() + '\n\n## Lokale Teständerung\n\nDieser Abschnitt stammt aus der lokalen Chatvorschau.\n',
      });
    }
    return JSON.stringify(previewWorkspaceReply(payload));
  }
  return window.__TAURI__.core.invoke('chatgpt_respond', payload);
}

function readChatJson(answer) {
  const text = answer.trim();
  const fenced = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return JSON.parse(fenced ? fenced[1] : text);
}

function readEditProposal(answer) {
  try {
    const result = readChatJson(answer);
    if (typeof result.summary !== 'string' || !result.summary.trim() || typeof result.markdown !== 'string') {
      throw new Error('Invalid edit proposal');
    }
    return result;
  } catch {
    throw new Error('Die KI hat keinen lesbaren Änderungsvorschlag geliefert. Versuche es mit einem konkreteren Auftrag.');
  }
}

function readWorkspaceReply(answer) {
  try {
    const result = readChatJson(answer);
    if (result?.kind === 'reply' && typeof result.message === 'string' && result.message.trim()) return result;
    if (result?.kind === 'edit' && typeof result.noteId === 'string'
      && typeof result.instruction === 'string' && result.instruction.trim()) return result;
    if (result?.kind === 'create' && typeof result.summary === 'string' && result.summary.trim()) {
      const validNote = note => typeof note?.title === 'string' && note.title.trim()
        && typeof note.folder === 'string' && typeof note.markdown === 'string';
      if (Array.isArray(result.folders) && result.folders.every(folder => typeof folder === 'string' && folder.trim())
        && Array.isArray(result.notes) && result.notes.every(validNote)) return result;
      if (validNote(result)) return { ...result, folders: [], notes: [result] };
    }
  } catch {
    if (answer.trim() && !['`', '{', '['].includes(answer.trim()[0])) return { kind: 'reply', message: answer };
  }
  throw new Error('Die Antwort konnte nicht verarbeitet werden. Formuliere deinen Auftrag bitte noch einmal.');
}

function proposalCommand(text) {
  const command = normalize(text).replace(/[.!]+$/, '').trim();
  if (/^(?:ja,? )?(?:bitte )?(?:den )?(?:vorschlag |änderung |notiz |datei )?(?:übernehmen|speichern|bestätigen)$/.test(command)) return 'apply';
  if (/^(?:vorschlag )?(?:verwerfen|abbrechen)$/.test(command)) return 'discard';
  if (/^(?:vorschau|vorschlag (?:anzeigen|zeigen|prüfen))$/.test(command)) return 'review';
  return null;
}

function creationSummary({ folders, notes }) {
  const counts = [];
  if (folders.length) counts.push(`${folders.length} Ordner`);
  if (notes.length) counts.push(notes.length === 1 ? '1 Notiz' : `${notes.length} Notizen`);
  return counts.join(' und ');
}

function CreationList({ proposal, preview = false }) {
  return <ul className="chat-creation-list">
    {proposal.folders.map(path => <li key={path}>
      <div className="chat-proposal-path"><Folder size={15}/><span>{path}</span></div>
    </li>)}
    {proposal.notes.map(note => <li key={note.id}>
      {preview ? <details>
        <summary>{note.path}</summary>
        <pre>{note.body || 'Leere Notiz'}</pre>
      </details> : <div className="chat-proposal-path"><FileText size={15}/><span>{note.path}</span></div>}
    </li>)}
  </ul>;
}

function findRelevantNotes(notes, query) {
  const terms = query.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [];
  if (!terms.length) return [];
  return notes.map(note => {
    const text = `${note.title}\n${note.path}\n${note.body}`.toLocaleLowerCase();
    const score = terms.reduce((sum, term) => sum + (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0);
    const firstMatch = Math.min(...terms.map(term => { const index = note.body.toLocaleLowerCase().indexOf(term); return index < 0 ? Infinity : index; }));
    const excerptAt = Number.isFinite(firstMatch) ? Math.max(0, firstMatch - 180) : 0;
    const excerpt = note.body.slice(excerptAt, excerptAt + 620).replace(/^#+\s*/gm, '').trim();
    const context = note.body.slice(0, 3000).trim();
    return { ...note, score, excerpt, context };
  }).filter(note => note.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

export default function KnowledgeChat({ vault, currentNote, open, compact, editingNote, onEditModeChange, onOpenSource, onApplyProposal, onClose }) {
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState(null);
  const [showContext, setShowContext] = useState(false);
  const [connection, setConnection] = useState({ loading: true, desktop: Boolean(window.__TAURI__), connected: false, plan_enabled: false, email: null });
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [applying, setApplying] = useState(false);
  const sendingRef = useRef(false);
  const applyingRef = useRef(false);
  const connectionRequested = useRef(false);
  const threadRef = useRef(null);
  const composerRef = useRef(null);
  const scopeId = useId();
  const selectedScope = currentNote ? scope ?? 'current' : 'vault';
  const latestProposal = messages.findLast(message => message.proposal || message.status);
  const relevant = useMemo(() => {
    if (editingNote) return [{ ...editingNote, excerpt: editingNote.body.slice(0, 620) }];
    if (selectedScope === 'current' && currentNote) {
      return [{ ...currentNote, context: currentNote.body.slice(0, 3000), excerpt: currentNote.body.slice(0, 620) }];
    }
    return findRelevantNotes(vault.notes, question);
  }, [editingNote, currentNote, selectedScope, vault.notes, question]);
  const pdfCount = (vault.attachments || []).length;

  useEffect(() => {
    if (!open || connectionRequested.current) return;
    connectionRequested.current = true;
    if (previewChat) { setConnection({ loading: false, desktop: false, plan_enabled: true }); return; }
    if (!window.__TAURI__?.core?.invoke) { setConnection({ loading: false, desktop: false, connected: false, plan_enabled: false, email: null }); return; }
    window.__TAURI__.core.invoke('chatgpt_status').then(status => setConnection({ loading: false, ...status })).catch(() => setConnection({ loading: false, desktop: true, connected: false, plan_enabled: false, email: null }));
  }, [open]);

  useEffect(() => {
    if (open && threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [open, messages, sending, error, showContext]);

  useEffect(() => {
    if (open && editingNote) composerRef.current?.focus();
  }, [open, editingNote?.id]);

  async function connectChatGPT() {
    if (!window.__TAURI__?.core?.invoke || connecting) return;
    setConnecting(true); setError('');
    try { setConnection({ loading: false, ...await window.__TAURI__.core.invoke('chatgpt_connect') }); }
    catch (reason) { setError(reason?.toString?.() || 'ChatGPT konnte nicht verbunden werden.'); }
    finally { setConnecting(false); }
  }

  async function disconnectChatGPT() {
    if (!window.__TAURI__?.core?.invoke || sendingRef.current) return;
    try { await window.__TAURI__.core.invoke('chatgpt_disconnect'); setConnection({ loading: false, desktop: true, connected: false, plan_enabled: false, email: null }); setMessages([]); }
    catch (reason) { setError(reason?.toString?.() || 'Verbindung konnte nicht getrennt werden.'); }
  }

  async function sendQuestion(event) {
    event.preventDefault();
    const trimmed = question.trim();
    const command = proposalCommand(trimmed);
    if (!trimmed || sendingRef.current || applyingRef.current || (!command && !connection.plan_enabled)) return;
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', content: trimmed }]);
    setQuestion('');
    setError('');
    setShowContext(false);

    if (command) {
      if (!latestProposal?.proposal) {
        addReply('Es gibt gerade keinen offenen Vorschlag.');
      } else if (command === 'apply') {
        await applyProposal(latestProposal);
      } else if (command === 'discard') {
        finishReview(latestProposal, 'Vorschlag verworfen');
        addReply('Vorschlag verworfen.');
      } else {
        setReviewError('');
        setReview(latestProposal);
      }
      return;
    }

    sendingRef.current = true;
    setSending(true);
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    try {
      if (editingNote) {
        await proposeEdit(editingNote, trimmed, history);
        return;
      }
      const workspace = buildWorkspace(vault, trimmed, messages, currentNote, relevant);
      const context = relevant.map(note => `QUELLE: ${note.title}\nPFAD: ${note.path}\nINHALT:\n${note.context}`).join('\n\n---\n\n');
      const answer = await requestChat({
        question: trimmed,
        context,
        history,
        noteEdit: null,
        workspace,
      });
      const reply = readWorkspaceReply(answer);
      if (reply.kind === 'reply') {
        addReply(reply.message, relevant.map(({ id, title }) => ({ id, title })));
      } else if (reply.kind === 'edit') {
        const note = workspace.notes.some(item => item.id === reply.noteId)
          ? vault.notes.find(item => item.id === reply.noteId)
          : null;
        if (!note) addReply('Welche Notiz soll ich bearbeiten? Gib bitte den Titel oder Pfad an.');
        else await proposeEdit(note, reply.instruction, history);
      } else {
        addReply(reply.summary, [], prepareChatCreation(vault, reply));
      }
    } catch (reason) { setError(reason?.message || String(reason || 'Die Anfrage ist fehlgeschlagen.')); }
    finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function addReply(content, sources = [], proposal = null) {
    setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', content, sources, proposal }]);
  }

  async function proposeEdit(note, instruction, history) {
    if (new TextEncoder().encode(note.body).length > 24_000) {
      throw new Error('Diese Notiz ist für einen vollständigen Änderungsvorschlag zu lang (maximal 24 KB).');
    }
    const target = { vaultId: vault.id, id: note.id, title: note.title, path: note.path, body: note.body };
    const answer = await requestChat({
      question: instruction,
      context: '',
      history,
      noteEdit: { title: target.title, path: target.path, markdown: target.body },
      workspace: null,
    });
    const edit = readEditProposal(answer);
    const proposal = edit.markdown === target.body ? null : { kind: 'edit', target, markdown: edit.markdown };
    addReply(edit.summary, [{ id: note.id, title: note.title }], proposal);
  }

  function finishReview(entry, status) {
    setMessages(current => current.map(message => message.id === entry.id
      ? { ...message, proposal: null, status }
      : message));
    setReview(null);
  }

  async function applyProposal(entry, inReview = false) {
    if (!entry?.proposal || sendingRef.current || applyingRef.current) return;
    applyingRef.current = true;
    setApplying(true);
    setError('');
    setReviewError('');
    try {
      await onApplyProposal(entry.proposal);
      const proposal = entry.proposal;
      if (proposal.kind === 'create') {
        const status = `${creationSummary(proposal)} angelegt`;
        finishReview(entry, status);
        addReply(status + '.', proposal.notes.map(({ id, title }) => ({ id, title })));
      } else {
        finishReview(entry, 'Änderung übernommen');
        addReply(`Änderung übernommen · ${proposal.target.path}`, [proposal.target]);
      }
    } catch (reason) {
      const reportError = inReview ? setReviewError : setError;
      reportError(reason?.message || 'Die Notiz konnte nicht gespeichert werden.');
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }

  return <section className={`knowledge-chat${compact ? ' compact' : ''}`} aria-label="Chat mit deinem Wissensgarten">
    <div className="chat-heading">
      <div className="chat-heading-icon"><MessageCircle size={19}/></div>
      <div><h1>Wissenschat</h1></div>
      <button className="button button-outline chat-new-button" type="button" title="Neuer Chat" aria-label="Neuer Chat" disabled={sending || applying} onClick={() => { setQuestion(''); setMessages([]); setError(''); setShowContext(false); }}><Plus size={15}/>{!compact && ' Neuer Chat'}</button>
      <button className="icon-button" type="button" title="Wissenschat schließen" aria-label="Wissenschat schließen" onClick={onClose}><X size={17}/></button>
    </div>

    <div className="chat-thread" ref={threadRef} role="log" aria-label="Chatverlauf">
      {!messages.length && <div className="chat-welcome">
        <span className="chat-sparkle"><Sparkles size={17}/></span>
        <h2>{editingNote ? 'Was soll ich ändern?' : 'Was möchtest du wissen?'}</h2>
        {!compact && !editingNote && <><p>Frag nach deinem Wissen oder gib einen Auftrag für Notizen und Ordner.</p>
        <div className="chat-suggestions">
          {['Fasse meine wichtigsten Gedanken zusammen', 'Erstelle eine Checkliste als neue Notiz', 'Welche Notizen hängen thematisch zusammen?'].map(text => <button key={text} type="button" onClick={() => setQuestion(text)}>{text}</button>)}
        </div></>}
      </div>}
      {messages.map(message => <article key={message.id} className={`chat-message ${message.role}`}>
        <span className="chat-message-icon">{message.role === 'assistant' ? <Sparkles size={15}/> : 'Du'}</span>
        <div>
          <div className="chat-message-text">{message.content}</div>
          {message.proposal && <div className="chat-proposal">
            {message.proposal.kind === 'create'
              ? <CreationList proposal={message.proposal}/>
              : <div className="chat-proposal-path"><FileText size={15}/><span>{message.proposal.target.path}</span></div>}
            {message.id === latestProposal?.id && <div className="chat-proposal-hint">Schreib „Vorschau“ zum Ansehen oder „Übernehmen“ zum Speichern.</div>}
            <button type="button" className="button button-outline chat-review-button" onClick={() => { setReviewError(''); setReview(message); }}>Vorschlag prüfen</button>
          </div>}
          {message.status && <div className="chat-edit-status">{message.status}</div>}
          {message.sources?.length > 0 && <div className="chat-message-sources"><span>QUELLEN</span>{message.sources.map(source => <button type="button" key={source.id} onClick={() => onOpenSource(source.id)}><Link2 size={13}/>{source.title}</button>)}</div>}
        </div>
      </article>)}
      {sending && <div className="chat-thinking" role="status"><span className="spinner"/> Antwort wird erstellt …</div>}
      {applying && !review && <div className="chat-thinking" role="status"><span className="spinner"/> Vorschlag wird gespeichert …</div>}
      {error && <div className="chat-error" role="alert">{error}</div>}
      {showContext && <div className="chat-context-preview"><div className="chat-context-title"><Search size={15}/><strong>Voraussichtlicher Kontext</strong><span>{relevant.length} Notizen</span></div>{relevant.length ? relevant.map(note => <button key={note.id} type="button" className="chat-source" onClick={() => onOpenSource(note.id)}><FileText size={15}/><span><strong>{note.title}</strong><small>{note.path} · {note.excerpt || 'Kein Textauszug vorhanden'}</small></span></button>) : <p className="chat-context-empty">Schreib eine Frage, um passende Notizen in diesem Vault zu finden.</p>}</div>}
    </div>

    <div className="chat-composer-wrap">
      <div className="chat-provider-note"><Bot size={15}/>{previewChat ? <span>Lokale Chatvorschau</span> : connection.loading ? <span>ChatGPT-Verbindung wird geprüft …</span> : connection.plan_enabled ? <><span>ChatGPT-Abo aktiv</span>{!compact && <><span className="chat-dot"/><span>{connection.email}</span></>}<button type="button" className="chat-disconnect" onClick={disconnectChatGPT} disabled={sending} aria-label="ChatGPT trennen" title="ChatGPT trennen"><LogOut size={13}/></button></> : <><span>{connection.desktop ? 'ChatGPT-Abo nicht verbunden' : 'Nur in der Desktop-App'}</span><span className="chat-dot"/><span>{vault.notes.length} Notizen{pdfCount ? ` · ${pdfCount} PDFs` : ''}</span></>}</div>
      {connection.desktop && !connection.plan_enabled && <button type="button" className="chat-connect" onClick={connectChatGPT} disabled={connecting || connection.loading}>{connecting ? <><span className="spinner"/> ChatGPT wird verbunden …</> : <><Bot size={15}/> Mit ChatGPT verbinden</>}</button>}
      {editingNote && <div className="chat-edit-target"><FileText size={15}/><span title={editingNote.path}>{editingNote.title}</span><button type="button" className="icon-button" title="Bearbeitungsmodus verlassen" aria-label="Bearbeitungsmodus verlassen" onClick={() => onEditModeChange(false)}><X size={14}/></button></div>}
      <form className="chat-composer" onSubmit={sendQuestion}>
        <textarea ref={composerRef} aria-label={editingNote ? 'Änderungsauftrag' : 'Frage an deinen Wissensgarten'}
          value={question} onChange={event => setQuestion(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) sendQuestion(event);
          }}
          placeholder={editingNote ? 'Beschreibe, was ich ändern soll …' : 'Stell eine Frage oder gib einen Auftrag …'} rows={2}/>
        <div className="chat-composer-actions">
          {!editingNote && <><label className={compact ? 'sr-only' : ''} htmlFor={scopeId}>Kontext</label><select id={scopeId} value={selectedScope} onChange={event => setScope(event.target.value)}><option value="vault">Ganzer Vault</option>{currentNote && <option value="current">Aktuelle Notiz</option>}</select></>}
          {!editingNote && currentNote && <button type="button" className="chat-mode-toggle" onClick={() => onEditModeChange(true)}><Sparkles size={14}/> Notiz bearbeiten</button>}
          <button type="button" className="chat-context-toggle" title="Kontext ansehen" aria-label="Kontext ansehen" aria-expanded={showContext} onClick={() => setShowContext(value => !value)}>{compact ? <Search size={15}/> : showContext ? 'Kontext ausblenden' : 'Kontext ansehen'}</button>
          <button type="submit" className="button button-primary chat-send" disabled={sending || applying || !question.trim() || (!connection.plan_enabled && !proposalCommand(question.trim()))}><Send size={15}/> Senden</button>
        </div>
      </form>
      {!previewChat && !compact && <p className="chat-connection-hint">OpenAI erhält passende Auszüge. Für eine Überarbeitung wird der vollständige Text der ausgewählten Notiz verwendet.</p>}
    </div>

    <DialogFrame open={open && Boolean(review)} onOpenChange={value => { if (!value && !applyingRef.current) setReview(null); }}
      title={review?.proposal.kind === 'create' ? 'Neue Ordner und Notizen prüfen' : 'Markdown-Änderung prüfen'}
      description={review?.proposal.kind === 'create' ? creationSummary(review.proposal) : review?.proposal.target.path || ''}
      className="chat-review-dialog">
      {review && <>
        <div className={`chat-review-versions${review.proposal.kind === 'create' ? ' single' : ''}`}>
          {review.proposal.kind === 'create' ? <CreationList proposal={review.proposal} preview/> : <>
            <section><h3>Bisher</h3><pre>{review.proposal.target.body || 'Leere Notiz'}</pre></section>
            <section><h3>Vorschlag</h3><pre>{review.proposal.markdown || 'Leere Notiz'}</pre></section>
          </>}
        </div>
        {reviewError && <p className="chat-error" role="alert">{reviewError}</p>}
        <div className="chat-review-actions">
          <button type="button" className="button button-outline" disabled={applying} onClick={() => finishReview(review, 'Vorschlag verworfen')}>Verwerfen</button>
          <button type="button" className="button button-primary" disabled={applying || sending} onClick={() => applyProposal(review, true)}>{applying ? 'Wird gespeichert …' : 'Übernehmen'}</button>
        </div>
      </>}
    </DialogFrame>
  </section>;
}
