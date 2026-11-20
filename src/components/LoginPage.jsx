import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import BrandMark from './BrandMark.jsx';

const googleIcon = <svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303a12 12 0 0 1-4.196 5.571v.001l6.489 5.034C41.426 34.493 44 29.687 44 24c0-1.341-.138-2.65-.389-3.917z"/><path fill="#34A853" d="M24 44c5.4 0 9.926-1.79 13.234-4.849l-6.489-5.034C28.946 35.507 26.715 36.4 24 36.4c-5.224 0-9.646-3.526-11.234-8.269l-6.695 5.164C9.356 39.556 16.227 44 24 44z"/><path fill="#FBBC05" d="M12.766 28.131A12.03 12.03 0 0 1 12.1 24c0-1.438.252-2.817.702-4.101l-6.695-5.164A19.94 19.94 0 0 0 4 24c0 3.228.77 6.275 2.107 8.969l6.659-4.838z"/><path fill="#EA4335" d="M24 11.6c2.927 0 5.556 1.007 7.625 2.982l5.72-5.72C33.917 5.59 29.4 4 24 4 16.227 4 9.356 8.444 6.107 14.735l6.695 5.164C14.354 15.126 18.776 11.6 24 11.6z"/></svg>;

function errorText(error) {
  const errors = {
    'auth/unauthorized-domain': 'Diese Domain ist in Firebase Authentication nicht freigeschaltet.',
    'auth/operation-not-allowed': 'Dieser Anmeldeweg ist in Firebase noch nicht aktiviert.',
    'auth/popup-closed-by-user': 'Das Google-Anmeldefenster wurde geschlossen.',
    'auth/popup-blocked': 'Der Browser hat das Pop-up blockiert.',
    'auth/invalid-credential': 'E-Mail-Adresse oder Passwort stimmt nicht.',
    'auth/email-already-in-use': 'Dieses Konto gibt es bereits. Melde dich stattdessen an.',
    'auth/weak-password': 'Das Passwort muss mindestens sechs Zeichen haben.'
  };
  return errors[error?.code] || 'Anmeldung fehlgeschlagen. Bitte prüfe deine Angaben und versuche es erneut.';
}

export default function LoginPage() {
  const auth = useAuth();
  const [create, setCreate] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (auth.loading) return <div className="page-loader"><span className="spinner"/> Verbindung zu atelier …</div>;
  if (auth.user) return <Navigate to="/" replace/>;

  async function run(action) {
    setBusy(true); setNotice('');
    try { await action(); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  }

  return <main className="auth-page">
    <Link to="/login" className="auth-wordmark"><span className="brand-mark auth-brand-mark"><BrandMark/></span><span>atelier</span></Link>
    <section className="auth-card">
      <div className="auth-heading"><p className="eyebrow">DEIN PERSÖNLICHER WISSENSGARTEN</p><h1>{create ? 'Konto erstellen' : 'Willkommen zurück'}</h1><p>{create ? 'Richte deinen Zugang zu atelier ein.' : 'Melde dich an, um deinen Wissensgarten zu öffnen.'}</p></div>
      <button className="button button-outline google-button" disabled={busy || !auth.sdk} onClick={() => run(auth.signInGoogle)}>{googleIcon}<span>Mit Google fortfahren</span></button>
      <div className="auth-divider"><span>oder mit E-Mail</span></div>
      <form className="auth-form" onSubmit={event => { event.preventDefault(); run(() => create ? auth.createAccount(email, password) : auth.signInEmail(email, password)); }}>
        <label htmlFor="email">E-Mail-Adresse</label><input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="du@beispiel.at"/>
        <label htmlFor="password">Passwort</label><input id="password" type="password" autoComplete={create ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={event => setPassword(event.target.value)} placeholder="Mindestens 6 Zeichen"/>
        <button className="button button-primary auth-submit" disabled={busy || !auth.sdk}>{busy ? 'Einen Moment …' : create ? 'Konto erstellen' : 'Anmelden'}</button>
      </form>
      <div className="auth-footer"><button className="link-button" onClick={() => { setCreate(!create); setNotice(''); }}>{create ? 'Zur Anmeldung' : 'Konto erstellen'}</button><button className="link-button" onClick={() => run(() => email ? auth.resetPassword(email) : Promise.reject({ code: 'missing-email' }))}>Passwort vergessen?</button></div>
      {!auth.enabled && <p role="alert" className="form-notice">Firebase-Anmeldung ist für diese App-Instanz nicht konfiguriert. Bitte prüfe die Firebase-Umgebungsvariablen.</p>}
      {notice && <p role="alert" className="form-notice">{notice}</p>}
      {auth.error && <p role="alert" className="form-notice">{auth.error}</p>}
      <p className="auth-footnote">Deine Notizen werden in deinem privaten Firebase-Konto gespeichert und für Offline-Arbeit zwischengespeichert.</p>
    </section>
    <section className="desktop-downloads" aria-label="atelier Desktop herunterladen">
      <p>atelier für deinen Desktop</p>
      <div><a className="button button-outline" href="https://github.com/manuelkoch98/notebook/releases" target="_blank" rel="noreferrer"><Download size={15}/> macOS · DMG</a><a className="button button-outline" href="https://github.com/manuelkoch98/notebook/releases" target="_blank" rel="noreferrer"><Download size={15}/> Windows · EXE</a></div>
      <small>Downloads öffnen die GitHub-Releases. Das private Repository erfordert GitHub-Zugriff.</small>
    </section>
    <span className="auth-copyright">atelier · DEIN RUHIGER ORT FÜR GEDANKEN</span>
  </main>;
}
