# atelier

Eine eigenständig gestaltete, browserbasierte Notiz-App. Nach Anmeldung ist Firestore der primäre Speicher für Vaults und Markdown-Notizen. Firebase Offline-Persistenz und ein nutzerbezogener Browser-Cache unterstützen Offline-Arbeit. Die Cloud-Verbindung ist implementiert, wurde aber noch nicht mit einem echten Konto oder im Emulator Ende-zu-Ende abgenommen.

## Aufbau der Oberfläche

Die App ist eine React-Anwendung mit React Router. Die Anmeldung ist eine echte Route unter `/login`; unangemeldete Nutzer werden von `/` dorthin weitergeleitet, nach erfolgreicher Anmeldung geht es zurück zum Arbeitsbereich. Wiederverwendbare Oberflächen liegen als React-Komponenten unter `src/components/`, Authentifizierung in `src/auth/`, und der Workspace-Controller in `src/App.jsx`. Radix UI liefert zugängliche Kontext-, Dropdown- und Dialog-Menüs; die Komponenten folgen den neutralen shadcn/ui-Farb- und Abstands-Token.

## Lokal starten

Voraussetzungen: Node.js 20.19+ oder Node.js 22.12+. Im Projektordner:

```sh
npm run dev
```

Dann `http://localhost:4178` öffnen. Die Login-Seite ist `http://localhost:4178/login`. Vite liefert `/login` direkt an den React Router aus. Die PWA benötigt localhost oder HTTPS. Bei Anmeldung lädt und speichert die App Vaults/Notizen in Firestore; pro Firebase-Nutzer gibt es zusätzlich einen lokalen Browsercache für Offline-Arbeit. Ohne Anmeldung dient der lokale Modus nur als Vorschau.

## Firebase

Das Client-Konfigurationsmuster liegt in `.env.example`; daraus eine lokale `.env` machen und die Web-App-Werte aus Firebase Console → Projekteinstellungen → Allgemein eintragen. Diese Web-SDK-Werte sind keine Admin-Zugangsdaten. Firebase Admin SDK-Schlüssel, Service-Account-JSON, Tokens und echte Testdaten gehören niemals ins Repository.

Firestore-/Storage-Regeln liegen in `firebase/`. Sie sperren den Zugriff auf `users/{uid}/vaults/{vaultId}` für angemeldete Nutzer auf genau die eigene UID. Die Emulator-Konfiguration liegt in `firebase.json`; `npm run test:rules` erstellt zwei kurzlebige Konten und prüft, dass das zweite Konto den fremden Vault nicht lesen oder ändern kann. Dafür werden Node.js und ein verwendbares Java JDK benötigt; Firebase dokumentiert JDK 11+ und weist auf Java 21 für kommende Firestore-Emulator-Versionen hin.

Die Web-Anmeldung nutzt Firebase Authentication mit Google und E-Mail/Passwort. Im Profil können zusätzliche Methoden mit dem angemeldeten Firebase-Konto verknüpft werden, sodass sie dieselbe UID und dieselben Vaults verwenden. Bereits getrennte Firebase-UID-Konten werden nicht automatisch zusammengeführt. Die vom Nutzer bereitgestellte Web-Konfiguration liegt lokal in `.env.local` (wird ignoriert und nicht committet). `npm run build` schreibt daraus `dist/firebase-config.js`; Vercel muss dieselben `VITE_FIREBASE_*`-Werte und `VITE_CLOUD_ENABLED=true` als Build-Variablen erhalten. In der Firebase Console müssen Google und E-Mail/Passwort als Anmeldeanbieter aktiviert sein; die Vercel-Domain muss unter Authentication → Settings → Authorized domains stehen. **Anmeldung, Provider-Verknüpfung, Firestore-Synchronisierung, nutzerbezogener Offline-Cache und wiederherstellbare Konfliktkopien sind im Client implementiert. Ein echter Firebase-Login, Mehrgeräte-Sync und Emulatorabnahme wurden auf diesem Stand noch nicht verifiziert. Anhänge in Cloud Storage sind noch nicht implementiert.**

Geplantes Datenmodell: `users/{uid}/vaults/{vaultId}` (Metadaten), darunter `notes/{noteId}` mit Markdown-Text, Pfad, Revision und Änderungszeit; Anhänge unter `users/{uid}/vaults/{vaultId}/attachments/{attachmentId}`. Konfliktstrategie: bei konkurrierender Basisrevision beide Fassungen als wiederherstellbare Konfliktnotiz speichern, nie still überschreiben.

## Vercel

Vercel → Add New → Project → privates GitHub-Repository importieren. Framework Preset „Vite“, Build Command `npm run build`, Output Directory `dist`. `vercel.json` schreibt Client-Routen wie `/login` auf `index.html` um und setzt PWA-Header. Die `VITE_FIREBASE_*`-Werte als Production/Preview/Development Environment Variables und `VITE_CLOUD_ENABLED=true` setzen. Nutzerverwaltung und Firestore-Synchronisierung sind vorbereitet. Die Firebase-Anbieter sowie die Firestore-Regeln müssen in der Console aktiviert/veröffentlicht sein; Live-Sync wurde noch nicht abgenommen.

## Desktop

Ein Tauri-2-Gerüst für dieselbe Web-App liegt in `src-tauri/`. Nach `npm install` sind die Befehle:

```sh
npm run desktop:dev
npm run desktop:build:mac       # macOS .app und .dmg, auf macOS
npm run desktop:build:windows   # Windows .msi und NSIS .exe, auf Windows
```

Voraussetzung sind `npm install`, Rust/Cargo und die plattformspezifischen Build-Werkzeuge. Der Build erzeugt die macOS-/Windows-Icons aus `public/icon.svg`. Die jeweiligen Installer werden auf macOS bzw. Windows gebaut.

### Wissenschat ohne Release testen

Für den schnellen Test im Browser mit Beispielnotizen auf macOS:

```sh
npm run dev:chat
```

Öffne `http://127.0.0.1:4192` und den Wissenschat. Schreib zum Beispiel „Erstelle den Ordner ‹Privat› und darin die Notizen ‹Wellness› und ‹Training›“ oder „Ergänze die Notiz ‹Willkommen in atelier› um einen Abschnitt“. Enter sendet die Nachricht, Umschalt+Enter erzeugt einen Zeilenumbruch. Mit „Vorschau“ kannst du den Vorschlag ansehen, mit „Übernehmen“ speichern und mit „Verwerfen“ ablehnen. Dieser Modus simuliert KI-Antworten, speichert Änderungen lokal im Browser und sendet keine Anfragen an Firebase oder OpenAI.

Für echte Antworten mit deinem ChatGPT-Abo installiere einmal Rust/Cargo und starte die Desktop-App mit lokalen Notizen:

```sh
VITE_CLOUD_ENABLED=false npm run desktop:dev
```

Die Desktop-Entwicklung nutzt Port 4193. Der normale Browser-Server auf Port 4178 und die Chatvorschau auf Port 4192 können parallel laufen. Verbinde ChatGPT im Wissenschat, falls die Desktop-App danach fragt. Vite übernimmt Änderungen an der Oberfläche direkt. Tauri baut die Desktop-App bei Änderungen am Rust-Code lokal neu. Für beide Schritte brauchst du kein GitHub Release.

### Installer über GitHub Releases

Der Workflow `.github/workflows/desktop-release.yml` baut auf macOS einen DMG-Installer und auf Windows einen NSIS-Setup-EXE-Installer, sobald ein GitHub Release veröffentlicht wird. Er hängt beide Assets an dieses Release. Der Workflow kann außerdem unter **Actions** manuell gestartet werden. Die Login-Seite führt zur Release-Übersicht; solange noch kein Build fertig ist, stehen dort nur die automatisch angelegten Quellarchive. Weil dieses Repository privat ist, müssen Nutzer für den Installer Zugriff auf GitHub und das Repository haben.

Damit die installierte App mit Firebase startet, im Repository unter **Settings → Secrets and variables → Actions → Variables** die sechs `VITE_FIREBASE_*`-Variablen wie in `.env.example` anlegen. Es sind Client-Web-Konfigurationswerte (keine Admin-Schlüssel). Ohne diese Variablen erstellt der Workflow zwar Installer, aber die gebaute App hat keine aktivierte Firebase-Anmeldung.

Für einen bereits veröffentlichten Tag lässt sich unter **Actions → Build desktop installers → Run workflow** der Build manuell starten. Der Tag und die Version in `src-tauri/tauri.conf.json` müssen übereinstimmen; der Workflow prüft das bei automatisch gestarteten Releases. Künftige Veröffentlichungen starten nach dem Veröffentlichen eines GitHub Releases mit dem passenden Versions-Tag.

### Updates in der Desktop-App

Die installierte Desktop-App prüft beim Start die `latest.json` des jüngsten GitHub Releases. Bei einem verfügbaren Update erscheint ein Download-Symbol über dem Profil. Im Profilmenü gibt es außerdem **Nach Updates suchen**. Vor der Installation müssen Änderungen gespeichert sein.

Der Workflow legt die Updatepakete für macOS und Windows und die `latest.json` beim Release ab. Der öffentliche Prüfschlüssel steht in der Tauri-Konfiguration. Der private Schlüssel bleibt im GitHub Actions Secret `TAURI_SIGNING_PRIVATE_KEY`. Die lokale Kopie liegt außerhalb des Repositorys unter `~/.config/atelier/updater/signing.key`. Bewahre sie sicher auf, damit bereits installierte Versionen auch künftige Updates prüfen können.

## Import/Export

Derzeit kann man mehrere Markdown-/Textdateien oder einen Ordner über den Import-Dialog einlesen. Export lädt Markdown-Notizen einzeln herunter. Vollständiger ZIP-Roundtrip inklusive Anhängen und originaler verschachtelter Struktur ist noch offen; die geplante Testmatrix steht in [FUNKTIONSMATRIX.md](FUNKTIONSMATRIX.md).

## Funktionsmatrix und Status

Siehe [FUNKTIONSMATRIX.md](FUNKTIONSMATRIX.md). Community-Plugins erhalten keine Kompatibilitätszusage: Obsidian-spezifische APIs fehlen.

## Referenz- und Lizenzhinweise

- [REA](https://github.com/morluto/rea) ist ein MIT-lizenziertes Reverse-Engineering-Toolkit; lokal war kein `rea`-Befehl verfügbar. Eine sichtbare Prüfung der installierten Obsidian-App (Version 1.15.1) hat Dateibaum, Suche, Tabs, Editier-/Leseansicht und Rückverweis-/Gliederungs-Seitenleisten bestätigt. Eine REA-Analyse wurde nicht ausgeführt.
- Als weitere Referenz dient die öffentlich dokumentierte [Obsidian-Hilfe](https://obsidian.md/help). Der konkrete Umfang weicht in der Matrix aus.
- Der App-Name, das Farbsystem und das eigene SVG-Icon stammen aus diesem Projekt. Obsidian-Marken und -Assets werden nicht übernommen.
- Für `morluto/rea` weist GitHub eine MIT-Lizenz aus. Lizenzdatei: https://github.com/morluto/rea/blob/main/LICENSE
