import { useEffect, useMemo, useState } from 'react';
import { Bot, FileText, Link2, LogOut, MessageCircle, Plus, Search, Send, Sparkles } from 'lucide-react';

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

export default function KnowledgeChat({ vault, currentNote, onOpenSource }) {
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState('vault');
  const [showContext, setShowContext] = useState(false);
  const [connection, setConnection] = useState({ loading: true, desktop: Boolean(window.__TAURI__), connected: false, plan_enabled: false, email: null });
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const notes = scope === 'current' && currentNote ? [currentNote] : vault.notes;
  const relevant = useMemo(() => findRelevantNotes(notes, question), [notes, question]);
  const pdfCount = (vault.attachments || []).length;

  useEffect(() => {
    if (!window.__TAURI__?.core?.invoke) { setConnection({ loading: false, desktop: false, connected: false, plan_enabled: false, email: null }); return; }
    window.__TAURI__.core.invoke('chatgpt_status').then(status => setConnection({ loading: false, ...status })).catch(() => setConnection({ loading: false, desktop: true, connected: false, plan_enabled: false, email: null }));
  }, []);

  async function connectChatGPT() {
    if (!window.__TAURI__?.core?.invoke || connecting) return;
    setConnecting(true); setError('');
    try { setConnection({ loading: false, ...await window.__TAURI__.core.invoke('chatgpt_connect') }); }
    catch (reason) { setError(reason?.toString?.() || 'ChatGPT konnte nicht verbunden werden.'); }
    finally { setConnecting(false); }
  }

  async function disconnectChatGPT() {
    if (!window.__TAURI__?.core?.invoke) return;
    try { await window.__TAURI__.core.invoke('chatgpt_disconnect'); setConnection({ loading: false, desktop: true, connected: false, plan_enabled: false, email: null }); setMessages([]); }
    catch (reason) { setError(reason?.toString?.() || 'Verbindung konnte nicht getrennt werden.'); }
  }

  async function sendQuestion(event) {
    event?.preventDefault?.();
    const trimmed = question.trim();
    if (!trimmed || sending || !connection.plan_enabled || !window.__TAURI__?.core?.invoke) return;
    setSending(true); setError('');
    const sources = relevant.map(note => ({ id: note.id, title: note.title, path: note.path }));
    const nextMessages = [...messages, { role: 'user', content: trimmed, sources: [] }];
    setMessages(nextMessages); setQuestion('');
    const context = relevant.map(note => `QUELLE: ${note.title}\nPFAD: ${note.path}\nINHALT:\n${note.context}`).join('\n\n---\n\n');
    try {
      const answer = await window.__TAURI__.core.invoke('chatgpt_respond', {
        question: trimmed,
        context,
        history: messages.slice(-10).map(message => ({ role: message.role, content: message.content })),
      });
      setMessages(current => [...current, { role: 'assistant', content: answer, sources }]);
    } catch (reason) { setError(reason?.toString?.() || 'Die Anfrage ist fehlgeschlagen.'); }
    finally { setSending(false); }
  }

  return <section className="knowledge-chat" aria-label="Chat mit deinem Wissensgarten">
    <div className="chat-heading">
      <div className="chat-heading-icon"><MessageCircle size={19}/></div>
      <div><h1>Wissenschat</h1></div>
      <button className="button button-outline chat-new-button" type="button" onClick={() => { setQuestion(''); setMessages([]); setError(''); }}><Plus size={15}/> Neuer Chat</button>
    </div>

      <div className="chat-thread">
      {!messages.length && <div className="chat-welcome">
        <span className="chat-sparkle"><Sparkles size={17}/></span>
        <h2>Was möchtest du wissen?</h2>
        <p>Der Chat sucht passende Notizen in deinem Wissensgarten und zeigt die verwendeten Quellen an.</p>
        <div className="chat-suggestions">
          {['Fasse meine wichtigsten Gedanken zusammen', 'Welche Notizen hängen thematisch zusammen?', 'Was habe ich zu meiner Masterarbeit festgehalten?'].map(text => <button key={text} type="button" onClick={() => setQuestion(text)}>{text}</button>)}
        </div>
      </div>}
      {messages.map((message, index) => <article key={`${index}-${message.role}`} className={`chat-message ${message.role}`}><span className="chat-message-icon">{message.role === 'assistant' ? <Sparkles size={15}/> : 'Du'}</span><div><div className="chat-message-text">{message.content}</div>{message.sources?.length > 0 && <div className="chat-message-sources"><span>QUELLEN</span>{message.sources.map(source => <button type="button" key={source.id} onClick={() => onOpenSource(source.id)}><Link2 size={13}/>{source.title}</button>)}</div>}</div></article>)}
      {sending && <div className="chat-thinking"><span className="spinner"/> Antwort wird erstellt …</div>}
      {error && <div className="chat-error" role="alert">{error}</div>}
      {showContext && <div className="chat-context-preview"><div className="chat-context-title"><Search size={15}/><strong>Voraussichtlicher Kontext</strong><span>{relevant.length} Notizen</span></div>{relevant.length ? relevant.map(note => <button key={note.id} type="button" className="chat-source" onClick={() => onOpenSource(note.id)}><FileText size={15}/><span><strong>{note.title}</strong><small>{note.path} · {note.excerpt || 'Kein Textauszug vorhanden'}</small></span></button>) : <p className="chat-context-empty">Schreib eine Frage, um passende Notizen in diesem Vault zu finden.</p>}</div>}
    </div>

    <div className="chat-composer-wrap">
      <div className="chat-provider-note"><Bot size={15}/>{connection.loading ? <span>ChatGPT-Verbindung wird geprüft …</span> : connection.plan_enabled ? <><span>ChatGPT-Abo aktiv</span><span className="chat-dot"/><span>{connection.email}</span><button type="button" className="chat-disconnect" onClick={disconnectChatGPT} title="ChatGPT trennen"><LogOut size={13}/></button></> : <><span>{connection.desktop ? 'ChatGPT-Abo nicht verbunden' : 'Nur in der Desktop-App'}</span><span className="chat-dot"/><span>{vault.notes.length} Notizen{pdfCount ? ` · ${pdfCount} PDFs` : ''}</span></>}</div>
      {connection.desktop && !connection.plan_enabled && <button type="button" className="chat-connect" onClick={connectChatGPT} disabled={connecting || connection.loading}>{connecting ? <><span className="spinner"/> ChatGPT wird verbunden …</> : <><Bot size={15}/> Mit ChatGPT verbinden</>}</button>}
      <form className="chat-composer" onSubmit={sendQuestion}><textarea aria-label="Frage an deinen Wissensgarten" value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) sendQuestion(event); }} placeholder="Stelle eine Frage zu deinem Wissensgarten …" rows={2}/><div className="chat-composer-actions"><label htmlFor="chat-scope">Kontext</label><select id="chat-scope" value={scope} onChange={event => setScope(event.target.value)}><option value="vault">Ganzer Vault</option>{currentNote && <option value="current">Aktuelle Notiz</option>}</select><button type="button" className="chat-context-toggle" aria-expanded={showContext} onClick={() => setShowContext(value => !value)}>{showContext ? 'Kontext ausblenden' : 'Kontext ansehen'}</button><button type="submit" className="button button-primary chat-send" disabled={sending || !question.trim() || !connection.plan_enabled}><Send size={15}/> Senden</button></div></form>
      <p className="chat-connection-hint">Nur passende Notizenauszüge werden mit deiner Frage an OpenAI gesendet. Die Abo-Nutzung folgt deinem ChatGPT-Kontingent; es gibt keinen API-Fallback.</p>
    </div>
  </section>;
}
