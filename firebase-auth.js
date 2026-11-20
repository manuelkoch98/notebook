const config = window.ATELIER_FIREBASE;
const loginScreen = document.querySelector('#login-screen');
const appShell = document.querySelector('.app-shell');
const message = document.querySelector('#login-message');
const form = document.querySelector('#email-form');
const submit = document.querySelector('#email-submit');
const googleButton = document.querySelector('#google-sign-in');
let authApi;
let creatingAccount = false;

function showMessage(text, kind = 'error') {
  message.textContent = text;
  message.dataset.kind = kind;
}

function friendlyError(error) {
  const messages = {
    'auth/unauthorized-domain': 'Diese Domain ist in Firebase Authentication noch nicht freigeschaltet.',
    'auth/operation-not-allowed': 'Dieser Anmeldeweg ist in Firebase Console noch nicht aktiviert.',
    'auth/popup-closed-by-user': 'Das Google-Anmeldefenster wurde geschlossen.',
    'auth/popup-blocked': 'Der Browser hat das Google-Anmeldefenster blockiert. Erlaube Pop-ups für diese Seite.',
    'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
    'auth/email-already-in-use': 'Für diese E-Mail gibt es bereits ein Konto. Melde dich an.',
    'auth/weak-password': 'Wähle ein stärkeres Passwort mit mindestens sechs Zeichen.',
    'auth/invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.'
  };
  return messages[error?.code] || 'Anmeldung fehlgeschlagen. Prüfe die Firebase-Einstellungen und versuche es erneut.';
}

function revealApp(user = null) {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  document.documentElement.classList.remove('requires-auth');
  const badge = document.querySelector('.avatar');
  const signOut = document.querySelector('[data-auth-sign-out]');
  const label = document.querySelector('#storage-label');
  if (user) {
    badge.textContent = (user.displayName || user.email || 'A').trim().charAt(0).toUpperCase();
    badge.title = user.email || user.displayName || 'Angemeldet';
    signOut.classList.remove('hidden');
    label.textContent = 'Angemeldet · Notizen noch lokal';
    window.dispatchEvent(new CustomEvent('atelier-auth-ready', { detail: { user } }));
  } else {
    badge.textContent = 'M';
    badge.title = 'Lokaler Arbeitsbereich';
    signOut.classList.add('hidden');
    label.textContent = 'Nur auf diesem Gerät';
    window.dispatchEvent(new CustomEvent('atelier-auth-ready', { detail: { user: null } }));
  }
}

function refreshEmailMode() {
  document.querySelector('#login-title').textContent = creatingAccount ? 'Dein Konto erstellen.' : 'Willkommen zurück.';
  submit.textContent = creatingAccount ? 'Konto erstellen' : 'Anmelden';
  document.querySelector('#create-account').textContent = creatingAccount ? 'Zur Anmeldung' : 'Konto erstellen';
  document.querySelector('#login-password').autocomplete = creatingAccount ? 'new-password' : 'current-password';
  showMessage('');
}

document.querySelector('#create-account').addEventListener('click', () => {
  creatingAccount = !creatingAccount;
  refreshEmailMode();
});

document.querySelector('#google-sign-in').addEventListener('click', async () => {
  if (!authApi) { showMessage('Firebase wird noch geladen. Bitte gleich erneut versuchen.', 'info'); return; }
  showMessage('Google-Anmeldung wird geöffnet.', 'info');
  try {
    await authApi.signInWithPopup(authApi.auth, new authApi.GoogleAuthProvider());
  } catch (error) {
    showMessage(friendlyError(error));
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!authApi) { showMessage('Firebase wird noch geladen. Bitte gleich erneut versuchen.', 'info'); return; }
  const email = document.querySelector('#login-email').value.trim();
  const password = document.querySelector('#login-password').value;
  submit.disabled = true;
  try {
    if (creatingAccount) await authApi.createUserWithEmailAndPassword(authApi.auth, email, password);
    else await authApi.signInWithEmailAndPassword(authApi.auth, email, password);
  } catch (error) {
    showMessage(friendlyError(error));
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#reset-password').addEventListener('click', async () => {
  if (!authApi) { showMessage('Firebase wird noch geladen. Bitte gleich erneut versuchen.', 'info'); return; }
  const email = document.querySelector('#login-email').value.trim();
  if (!email) {
    showMessage('Gib zuerst deine E-Mail-Adresse ein.', 'info');
    document.querySelector('#login-email').focus();
    return;
  }
  try {
    await authApi.sendPasswordResetEmail(authApi.auth, email);
    showMessage('Wenn ein Konto zu dieser Adresse besteht, wurde eine E-Mail zum Zurücksetzen gesendet.', 'success');
  } catch (error) {
    showMessage(friendlyError(error));
  }
});

document.querySelector('[data-auth-sign-out]').addEventListener('click', async () => {
  if (authApi) await authApi.signOut(authApi.auth);
});

if (!config?.enabled) {
  revealApp();
} else {
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  showMessage('Firebase wird geladen …', 'info');
  googleButton.disabled = true;
  submit.disabled = true;
  try {
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')
    ]);
    const app = appSdk.initializeApp(config.config);
    const auth = authSdk.getAuth(app);
    authApi = { auth, ...authSdk };
    googleButton.disabled = false;
    submit.disabled = false;
    showMessage('');
    authSdk.onAuthStateChanged(auth, user => user ? revealApp(user) : (() => {
      appShell.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      document.documentElement.classList.add('requires-auth');
    })());
  } catch {
    showMessage('Firebase konnte nicht geladen werden. Prüfe die Internetverbindung und die Firebase-Konfiguration.');
  }
}
