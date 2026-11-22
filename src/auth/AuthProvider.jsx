import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const config = window.ATELIER_FIREBASE;

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({ loading: Boolean(config?.enabled), enabled: Boolean(config?.enabled), user: null, auth: null, sdk: null, error: '' });

  useEffect(() => {
    if (!config?.enabled) return;
    let unsubscribe;
    let disposed = false;
    Promise.all([
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/13.4.0/firebase-storage.js')
    ]).then(([appSdk, sdk, firestoreSdk, storageSdk]) => {
      if (disposed) return;
      const app = appSdk.initializeApp(config.config);
      const auth = sdk.getAuth(app);
      const storage = storageSdk.getStorage(app);
      let db;
      try { db = firestoreSdk.initializeFirestore(app, { localCache: firestoreSdk.persistentLocalCache({ tabManager: firestoreSdk.persistentMultipleTabManager() }) }); }
      catch { db = firestoreSdk.getFirestore(app); }
      setAuthState(current => ({ ...current, auth, sdk, db, firestoreSdk, storage, storageSdk }));
      unsubscribe = sdk.onAuthStateChanged(auth, user => setAuthState(current => ({ ...current, loading: false, user })));
    }).catch(() => setAuthState(current => ({ ...current, loading: false, error: 'Firebase konnte nicht geladen werden. Prüfe die Verbindung und Konfiguration.' })));
    return () => { disposed = true; unsubscribe?.(); };
  }, []);

  const value = useMemo(() => ({ ...authState,
    signInGoogle: () => authState.sdk.signInWithPopup(authState.auth, new authState.sdk.GoogleAuthProvider()),
    signInEmail: (email, password) => authState.sdk.signInWithEmailAndPassword(authState.auth, email, password),
    createAccount: (email, password) => authState.sdk.createUserWithEmailAndPassword(authState.auth, email, password),
    linkGoogle: () => authState.sdk.linkWithPopup(authState.auth.currentUser, new authState.sdk.GoogleAuthProvider()),
    linkEmailPassword: password => authState.sdk.linkWithCredential(authState.auth.currentUser, authState.sdk.EmailAuthProvider.credential(authState.auth.currentUser.email, password)),
    resetPassword: email => authState.sdk.sendPasswordResetEmail(authState.auth, email),
    signOut: () => authState.sdk.signOut(authState.auth),
    updateProfile: (displayName) => authState.sdk.updateProfile(authState.auth.currentUser, { displayName })
  }), [authState]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth muss innerhalb des AuthProvider verwendet werden.');
  return value;
}
