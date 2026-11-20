# Atelier — persönliche Markdown-Wissenswerkstatt

Eine eigenständig gestaltete, browserbasierte Notiz-App. Der erste Abschnitt speichert Vaults und Markdown-Notizen lokal im Browser. Firebase, sichere Regeln, ZIP-Roundtrip, Desktop-Installer und kollaborationssichere Synchronisierung sind noch Arbeitsstände, keine fertigen Funktionen.

## Lokal starten

Voraussetzungen: Python 3.10+ oder ein anderer statischer HTTP-Server. Im Projektordner:

```sh
python3 -m http.server 4173
```

Dann `http://localhost:4173` öffnen. Die PWA benötigt localhost oder HTTPS. Daten verbleiben zunächst in `localStorage` des Browsers und werden durch Löschen der Website-Daten entfernt. Noch keine sensiblen Produktivnotizen eintragen.

## Firebase

Das Client-Konfigurationsmuster liegt in `.env.example`; daraus eine lokale `.env` machen und die Web-App-Werte aus Firebase Console → Projekteinstellungen → Allgemein eintragen. Diese Web-SDK-Werte sind keine Admin-Zugangsdaten. Firebase Admin SDK-Schlüssel, Service-Account-JSON, Tokens und echte Testdaten gehören niemals ins Repository.

Firestore-/Storage-Regeln liegen in `firebase/`. Sie sperren den Zugriff auf `users/{uid}/vaults/{vaultId}` für angemeldete Nutzer auf genau die eigene UID. Sie müssen im Firebase Emulator und Projekt geprüft werden, bevor Cloud-Zugriff aktiviert wird. Der Client verwendet diese Regeln noch nicht, weil Authentifizierung und Cloud-Synchronisierung noch nicht implementiert sind.

Geplantes Datenmodell: `users/{uid}/vaults/{vaultId}` (Metadaten), darunter `notes/{noteId}` mit Markdown-Text, Pfad, Revision und Änderungszeit; Anhänge unter `users/{uid}/vaults/{vaultId}/attachments/{attachmentId}`. Konfliktstrategie: bei konkurrierender Basisrevision beide Fassungen als wiederherstellbare Konfliktnotiz speichern, nie still überschreiben.

## Vercel

Vercel → Add New → Project → privates GitHub-Repository importieren. Framework „Other“, Build Command `npm run build`, Output Directory `dist`. `vercel.json` setzt PWA-Header. Für Firebase-Clientintegration anschließend die `VITE_FIREBASE_*`-Werte als Production/Preview/Development Environment Variables setzen und den Cloud-Flag erst nach implementierter Authentifizierung aktivieren. Derzeit gibt es noch keine produktive Firebase-Integration.

## Desktop

macOS- und Windows-Installer sind noch nicht eingerichtet. Geplant ist ein Tauri-Container für dieselbe Web-App. Für macOS wird ein passender macOS-Runner benötigt, für Windows ein Windows-Runner. Es wurden keine Installer gebaut oder getestet; daher gibt es keine geprüften Download-Artefakte. Build-Befehle werden ergänzt, sobald die Tauri-Konfiguration Teil des nächsten Abschnitts ist.

## Import/Export

Derzeit kann man mehrere Markdown-/Textdateien oder einen Ordner über den Import-Dialog einlesen. Export lädt Markdown-Notizen einzeln herunter. Vollständiger ZIP-Roundtrip inklusive Anhängen und originaler verschachtelter Struktur ist noch offen; die geplante Testmatrix steht in [FUNKTIONSMATRIX.md](FUNKTIONSMATRIX.md).

## Funktionsmatrix und Status

Siehe [FUNKTIONSMATRIX.md](FUNKTIONSMATRIX.md). Community-Plugins erhalten keine Kompatibilitätszusage: Obsidian-spezifische APIs fehlen.

## Referenz- und Lizenzhinweise

- [REA](https://github.com/morluto/rea) ist ein MIT-lizenziertes Reverse-Engineering-Toolkit; lokal war kein `rea`-Befehl verfügbar. Eine sichtbare Prüfung der installierten Obsidian-App (Version 1.15.1) hat Dateibaum, Suche, Tabs, Editier-/Leseansicht und Rückverweis-/Gliederungs-Seitenleisten bestätigt. Eine REA-Analyse wurde nicht ausgeführt.
- Als weitere Referenz dient die öffentlich dokumentierte [Obsidian-Hilfe](https://obsidian.md/help). Der konkrete Umfang weicht in der Matrix aus.
- Der App-Name, das Farbsystem und das eigene SVG-Icon stammen aus diesem Projekt. Obsidian-Marken und -Assets werden nicht übernommen.
- Für `morluto/rea` weist GitHub eine MIT-Lizenz aus. Lizenzdatei: https://github.com/morluto/rea/blob/main/LICENSE
