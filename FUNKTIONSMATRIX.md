# Funktionsmatrix — Atelier

Arbeitsliste nach den öffentlich dokumentierten Kernfunktionen von Obsidian. Status bezieht sich auf den Code in diesem Repository; „UI geprüft“ bedeutet eine sichtbare Prüfung der installierten Obsidian-App, „Automatisiert“ eine lokale Browser- oder Emulatorprüfung. Offene Lücken bleiben Teil der Umsetzung.

Stand: 20.11.2026 · Referenz: [Obsidian Help](https://obsidian.md/help) und sichtbare Oberfläche Obsidian 1.15.1.

| Bereich / Funktion | Stand | Prüfmethode | Offene Kompatibilitätslücken |
|---|---|---|---|
| Eigenständiges Branding und Gestaltung | Fertig | UI-Prüfung Atelier | Kein Obsidian-Branding/Asset übernommen |
| Vaults wechseln und anlegen | Lokal prototypisch | UI manuell | Noch kein Nutzerkonto-/Cloud-Vault; kein Löschen/Umbenennen |
| Datei- und Ordnerbaum | Lokal prototypisch | UI manuell | Verschachtelte Ordnerdarstellung eingeschränkt; kein Umbenennen/Verschieben von Ordnern |
| Markdown bearbeiten, Live-Vorschau, Lesemodus | Lokal prototypisch | Browserlauf: Markdown eingegeben und Vorschau sichtbar | Kein CommonMark/GFM-Vollumfang; Tabellen, Callouts, Tasks und Plugins fehlen |
| Tabs | Lokal prototypisch | Browserlauf: zwei offene Notiz-Tabs | Keine geteilten Ansichten, persistente Tab-Sitzung oder Tab-Gruppen |
| Volltextsuche | Fertig, lokale Daten | Browserlauf: Suche nach „Testwissen“ lieferte Notiz | Kein Operator-/Query-Syntax, Ergebnisvorschau oder Suche über Cloud |
| Befehlspalette | Lokal prototypisch | Browserprüfung | Nur Atelier-Befehle; kein Plugin-Command-Registry |
| Tastenkürzel frei belegen | Implementiert | Codepfad; Browserlauf folgt | Bindings konfigurierbar und gespeichert; Plattform-/Kollisionstests offen |
| Wikilinks | Teilweise | Browserlauf: `[[Wikilinks]]` öffnete Zielnotiz | Nur `[[Titel]]`, Alias-/Heading-/Blockauflösung nicht umgesetzt |
| Import einzelner Markdown-Dateien / Ordner | Teilweise | Datei-Input manuell | Kein ZIP; Anhänge und deren relative Pfade fehlen; Konflikte werden überschrieben |
| Markdown-Export | Teilweise | Download manuell | Einzeldatei oder Downloads; kein wiederherstellbares ZIP mit Ordnern/Anhängen |
| Wikilinks | Teilweise | Live-Vorschau manuell | Nur `[[Titel]]`, Alias-/Heading-/Blockauflösung teilweise/nicht umgesetzt |
| Interne Links bei Umbenennen | Teilweise | Browserlauf: Umbenennen änderte einfachen eingehenden Link | Links mit Alias, Heading und Pfad testen |
| Backlinks | Offen | Matrix | Index fehlt |
| Einbettungen | Offen | Matrix | `![[...]]` fehlt |
| Überschriften-/Block-Links | Offen | Matrix | Heading-Fragmente und Block-IDs fehlen |
| Tags | Teilweise | Vorschau manuell | Inline-Tags noch nicht als navigierbare Facette indiziert |
| YAML-Eigenschaften | Offen | Matrix | Frontmatter-Parser und strukturierter Property-Editor fehlen |
| Anhänge | Offen | Matrix | Cloud Storage/Dateiverwaltung fehlen |
| Graphansicht | Vorschau | UI manuell | Noch keine Linkanalyse/-kanten; Ansicht ist Platzhalter |
| Tägliche Notizen | Offen | Matrix | Datumspfade und Vorlagen fehlen |
| Vorlagen | Offen | Matrix | Variablen und Einfügen fehlen |
| Lesezeichen | Offen | Matrix | Favoriten-/Bookmark-API im lokalen Modell fehlt |
| Canvas | Offen | Matrix | Obsidian-Canvas-JSON-Import/Export nicht implementiert |
| Bases | Offen | Matrix | `.base`-Format, Views und Formeln nicht implementiert |
| Themes, Plugins, Snippets | Offen | separat zu prüfen | Community-Plugin-APIs sind derzeit nicht kompatibel; keine Sandbox-/API-Schicht |
| Firebase Authentication | Offen | Emulator erforderlich | Anmeldung und Sitzungsverwaltung fehlen |
| Firestore-Synchronisierung | Offen | Emulator erforderlich | Merge-Queue, Offline-Änderungen und Konfliktkopien fehlen |
| Cloud Storage | Offen | Emulator erforderlich | Dateiupload/-download und Regeln vorbereitet, Client fehlt |
| Nutzer-/Vault-Sicherheitsregeln | Regeln vorbereitet | Firebase Emulator, noch nicht ausgeführt | Emulator Suite nicht vorhanden/ausgeführt; Regelabdeckung ergänzen |
| PWA | Shell implementiert | Browserlauf unter localhost; Manifest/Service Worker prüfen | Offline-Shell vorhanden; Offline-Notizänderungen und Sync fehlen |
| macOS-/Windows-Desktop | Offen | Geeignete Runner erforderlich | Kein Desktop-Container oder Installer erstellt |

## Geplante Abnahmefälle

1. Import-Testvault mit YAML, Unicode, verschachtelten Ordnern, Wikilinks und Anhängen einlesen und vollständig exportieren.
2. Notiz anlegen, bearbeiten, verlinken, umbenennen, suchen, mit einem zweiten Gerät synchronisieren und als Markdown exportieren.
3. Offline-Änderungen und gleichzeitige Änderungen zweier Geräte; bei Konflikt beide Textstände erhalten.
4. Firebase Emulator: Konto B kann Vault von Konto A weder lesen noch ändern.
5. Installer auf macOS und Windows bauen, installieren und starten; tatsächlich geprüfte Artefakte protokollieren.

## Funktionsprüfungen

Manuelle Browser-Abnahme am 20.11.2026: Notiz anlegen, Markdown bearbeiten, Vorschau, Wikilink öffnen, Zielnotiz umbenennen (eingehender Link aktualisiert), Volltext suchen; alles bestätigt. `npm run check` und `npm run build` erfolgreich. ZIP-Roundtrip, Import/Export mit Testvault, Firebase Emulator, Offline-/Mehrgeräte-Sync und Desktop-Installer wurden nicht geprüft.
