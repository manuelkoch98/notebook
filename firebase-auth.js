const config = window.ATELIER_FIREBASE;
const loginPage = location.pathname.endsWith('/login.html');
const message = document.querySelector('#login-message');
const form = document.querySelector('#email-form');
const submit = document.querySelector('#email-submit');
const googleButton = document.querySelector('#google-sign-in');

function showMessage(text, kind = 'error') {
  if (!message) return;
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

function configureLogin(authApi) {
  let creatingAccount = false;
  const email = document.querySelector('#login-email');
  const title = document.querySelector('#login-title');
  const create = document.querySelector('#create-account');
  const reset = document.querySelector('#reset-password');

  function refreshMode() {
    title.textContent = creatingAccount ? 'Dein Konto erstellen.' : 'Willkommen zurück.';
    submit.textContent = creatingAccount ? 'Konto erstellen' : 'Anmelden';
    create.textContent = creatingAccount ? 'Zur Anmeldung' : 'Konto erstellen';
    document.querySelector('#login-password').autocomplete = creatingAccount ? 'new-password' : 'current-password';
    showMessage('');
  }

  create.addEventListener('click', () => { creatingAccount = !creatingAccount; refreshMode(); });
  googleButton.addEventListener('click', async () => {
    showMessage('Google-Anmeldung wird geöffnet.', 'info');
    try { await authApi.signInWithPopup(authApi.auth, new authApi.GoogleAuthProvider()); }
    catch (error) { showMessage(friendlyError(error)); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      const password = document.querySelector('#login-password').value;
      if (creatingAccount) await authApi.createUserWithEmailAndPassword(authApi.auth, email.value.trim(), password);
      else await authApi.signInWithEmailAndPassword(authApi.auth, email.value.trim(), password);
    } catch (error) { showMessage(friendlyError(error)); }
    finally { submit.disabled = false; }
  });
  reset.addEventListener('click', async () => {
    if (!email.value.trim()) { showMessage('Gib zuerst deine E-Mail-Adresse ein.', 'info'); email.focus(); return; }
    try {
      await authApi.sendPasswordResetEmail(authApi.auth, email.value.trim());
      showMessage('Wenn ein Konto zu dieser Adresse besteht, wurde eine E-Mail zum Zurücksetzen gesendet.', 'success');
    } catch (error) { showMessage(friendlyError(error)); }
  });
}

if (!config?.enabled) {
  document.documentElement.classList.remove('auth-pending');
  if (loginPage) location.replace('/');
} else {
  try {
    const [appSdk, authSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js')
    ]);
    const app = appSdk.initializeApp(config.config);
    const auth = authSdk.getAuth(app);
    const authApi = { auth, ...authSdk };

    if (loginPage) {
      configureLogin(authApi);
      googleButton.disabled = false;
      submit.disabled = false;
      showMessage('');
      authSdk.onAuthStateChanged(auth, user => { if (user) location.replace('/'); });
    } else {
      document.querySelector('[data-auth-sign-out]').addEventListener('click', () => authSdk.signOut(auth));
      authSdk.onAuthStateChanged(auth, user => {
        if (!user) { location.replace('/login.html'); return; }
        document.documentElement.classList.remove('auth-pending');
        const badge = document.querySelector('.avatar');
        badge.textContent = (user.displayName || user.email || 'A').trim().charAt(0).toUpperCase();
        badge.title = user.email || user.displayName || 'Angemeldet';
        document.querySelector('[data-auth-sign-out]').classList.remove('hidden');
        document.querySelector('#storage-label').textContent = 'Angemeldet · Notizen noch lokal';
        window.dispatchEvent(new CustomEvent('atelier-auth-ready', { detail: { user } }));
      });
    }
  } catch {
    if (loginPage) {
      showMessage('Firebase konnte nicht geladen werden. Prüfe die Internetverbindung und die Firebase-Konfiguration.');
    } else {
      location.replace('/login.html?firebaseError=1');
    }
  }
}
