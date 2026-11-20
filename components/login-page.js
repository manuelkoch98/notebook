const googleMark = `<svg class="google-logo" aria-hidden="true" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.611 20.083H42V20H24v8h11.303a12 12 0 0 1-4.196 5.571v.001l6.489 5.034C41.426 34.493 44 29.687 44 24c0-1.341-.138-2.65-.389-3.917z"/><path fill="#34A853" d="M24 44c5.4 0 9.926-1.79 13.234-4.849l-6.489-5.034C28.946 35.507 26.715 36.4 24 36.4c-5.224 0-9.646-3.526-11.234-8.269l-6.695 5.164C9.356 39.556 16.227 44 24 44z"/><path fill="#FBBC05" d="M12.766 28.131A12.03 12.03 0 0 1 12.1 24c0-1.438.252-2.817.702-4.101l-6.695-5.164A19.94 19.94 0 0 0 4 24c0 3.228.77 6.275 2.107 8.969l6.659-4.838z"/><path fill="#EA4335" d="M24 11.6c2.927 0 5.556 1.007 7.625 2.982l5.72-5.72C33.917 5.59 29.4 4 24 4 16.227 4 9.356 8.444 6.107 14.735l6.695 5.164C14.354 15.126 18.776 11.6 24 11.6z"/></svg>`;

customElements.define('atelier-login-page', class extends HTMLElement {
  connectedCallback() {
    if (this.childElementCount) return;
    this.innerHTML = `<main class="login-screen" aria-labelledby="login-title"><section class="login-card">
      <div class="login-brand"><span class="brand-mark">a<span>.</span></span><span>ATELIER</span></div>
      <div class="welcome-kicker">DEIN PERSÖNLICHER WISSENSGARTEN</div>
      <h1 id="login-title">Willkommen zurück.</h1><p class="login-intro">Melde dich an, um Atelier zu öffnen.</p>
      <button id="google-sign-in" class="google-button" disabled>${googleMark}Mit Google fortfahren</button>
      <div class="login-divider"><span>oder mit E-Mail</span></div>
      <form id="email-form" class="login-form"><label for="login-email">E-Mail-Adresse</label><input id="login-email" type="email" autocomplete="email" required placeholder="du@beispiel.at"/><label for="login-password">Passwort</label><input id="login-password" type="password" autocomplete="current-password" required minlength="6" placeholder="Mindestens 6 Zeichen"/><button id="email-submit" class="primary-button login-submit" type="submit" disabled>Anmelden</button></form>
      <div class="login-links"><button id="create-account" class="text-button">Konto erstellen</button><button id="reset-password" class="text-button">Passwort vergessen?</button></div>
      <p id="login-message" class="login-message" role="status" aria-live="polite"></p>
      <p class="login-note">Deine Notizen bleiben aktuell lokal auf diesem Gerät gespeichert.</p>
    </section></main>`;
  }
});
