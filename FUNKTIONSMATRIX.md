# Funktionsmatrix — atelier

Arbeitsliste nach den öffentlich dokumentierten Kernfunktionen von Obsidian. Status bezieht sich auf den Code in diesem Repository; „UI geprüft“ bedeutet eine sichtbare Prüfung der installierten Obsidian-App, „Automatisiert“ eine lokale Browser- oder Emulatorprüfung. Offene Lücken bleiben Teil der Umsetzung.

Stand: 20.11.2026 · Referenz: [Obsidian Help](https://obsidian.md/help) und sichtbare Oberfläche Obsidian 1.15.1.

| Bereich / Funktion | Stand | Prüfmethode | Offene Kompatibilitätslücken |
|---|---|---|---|
| Eigenständiges Branding und Gestaltung | App, Login, SVG-Favicon, PWA- und Desktop-Icons verwenden dieselbe atelier-Marke | SVG/PNG visuell verglichen; `npm run desktop:icons` erzeugte macOS- und Windows-Icon-Dateien | Betriebssystem-Icons nicht auf installierten Desktop-Builds geprüft |
| Separate Login-Seite und Auth-Route | React-Route `/login`; Login-Logo verwendet dieselbe atelier-Marke wie die Startseite | Browser: `/` ohne Sitzung leitet zu `/login`; Login-Ansicht und Markenfarben/Logoabmessungen geprüft | Erfolgreiche Kontoanmeldung und Rückleitung mit echtem Firebase-Konto noch nicht geprüft |
| UI-Komponenten | React + Radix UI, shadcn-inspiriertes Designsystem | Browser: Login, Datei-Menü, Profil-Menü und Arbeitsbereich gerendert | Keine shadcn CLI-generierten Komponenten; eigener CSS-/Token-Layer auf Radix |
| Seitenleistenbreite | Ziehbarer Trenner zwischen Dateibaum und Arbeitsfläche; Breite lokal gespeichert; Tastatursteuerung mit Pfeiltasten | Browser: 256 → 356 px gezogen, nach Neuladen 356 px wiederhergestellt | Auf schmalen Mobilansichten ausgeblendet; dort bleibt die Sidebar als Overlay |
| Vaults wechseln, anlegen, umbenennen und löschen | Eigene Radix/shadcn-inspirierte Auswahl; Vaultname wird in Metadaten gespeichert; Löschung entfernt im angemeldeten Zustand auch Firestore-Notizen und Vault-Dokument | Browser: nativen Select ausgeschlossen; Vault angelegt, umbenannt, ausgewählt und nach Bestätigung gelöscht | Firestore-Löschung mit echtem angemeldetem Konto noch nicht live geprüft; letzter Vault ist absichtlich vor Löschung geschützt |
| Datei- und Ordnerbaum | Verschachtelt, einklappbar, in der Sidebar scrollbar; Ordner per Drag-and-drop verschieben und Geschwisterordner sortieren | Browser: Folder-Drag von `Ideen` nach `Notizen/Ideen`, zurück auf Hauptebene sowie Sortierung vor `Ideen` geprüft; lange Dateiliste scrollte innerhalb der Sidebar | Cloud- und Import-/Export-Roundtrip offen |
| Notiz- und Ordneraktionen | Rechtsklick und Drei-Punkte-Menü; Notizen öffnen, umbenennen, verschieben, exportieren, löschen; Ordner umbenennen, verschieben, mit Notizen/Unterordnern befüllen und samt Inhalt löschen | Browser: Beide Menüzugänge geöffnet; Ordner umbenannt, Unterordner/Notiz angelegt und Ordner mit Inhalt gelöscht | Löschen eines Ordners entfernt alle enthaltenen Notizen/Unterordner nach Bestätigung; Ordneraktionen sind noch nicht separat in Emulator/Cloud geprüft |
| Notizen per Drag-and-drop verschieben und sortieren | Implementiert; Reihenfolge wird als `order` im lokalen Modell und Firestore gespeichert | Browser: Notiz in Ordner verschoben; anschließend vor eine Geschwister-Notiz gezogen; Reihenfolge änderte sich sichtbar | Offline-Sync-/Mehrgeräteabgleich für `order` noch nicht empirisch geprüft |
| Notiz aus Dateibaum in Editor ziehen | Implementiert; nach dem Drag bleibt die aktive Notiz im Bearbeitungsmodus | Browser: Notiz in Editor gezogen; `[[Wikilinks]]` wurde eingefügt und der aktive Titel blieb gleich | Drop-Position im Text wird am aktuellen Cursor eingefügt; Cursorposition im Browser manuell geprüft |
| Titel automatisch speichern beim Verlassen | Implementiert: Blur, Wechsel aus Dokument und Öffnen einer anderen Notiz committen den Titel | Browser: Titel geändert, Graph geöffnet; Baumtitel aktualisierte sich und Editor schloss | Firebase-Roundtrip des Titels noch nicht live geprüft |
| Umbenennen per Enter/Doppelklick | Implementiert | Browser: Enter öffnet Inline-Umbenennung; Doppelklick ist als zusätzlicher Trigger eingebaut | Rename-Kollision wird abgefangen; weitere Tastaturprüfung offen |
| Profilmenü am Avatar | Profil (Vor-/Nachname editierbar), Einstellungen und Abmelden | Codeprüfung; Login-/Profil-UI manuell | Namen stammen aus Firebase Auth `displayName` (Google oder editierbares Profil); erfolgreicher Live-Speichervorgang nicht geprüft |
| Markdown bearbeiten, Live-Vorschau, Lesemodus | React: Dokumentwechsel übernimmt den aktuellen Modus; Lesebereich scrollbar; Klick im Dokument bearbeitet | Browser: Wechsel zwischen zwei Notizen im Lesemodus blieb Lesen; lange Vorschau ließ sich scrollen | Kein CommonMark/GFM-Vollumfang; Tabellen, Callouts und Plugins fehlen |
| Aufgabenlisten / Checkboxen | `- [ ]` und `- [x]` erscheinen im Lesemodus als Checkboxen; Anklicken ändert den Markdown-Status und speichert | Browser: zwei Tasks angezeigt; Checkbox umgeschaltet; Lesemodus blieb aktiv | Unterstützung für abweichende Task-Markierungen/Listen-Nesting nicht geprüft |
| Tabs | Lokal prototypisch | Browserlauf: zwei offene Notiz-Tabs | Keine geteilten Ansichten, persistente Tab-Sitzung oder Tab-Gruppen |
| Volltextsuche | Fertig, lokale Daten | Browserlauf: Suche nach „Testwissen“ lieferte Notiz | Kein Operator-/Query-Syntax, Ergebnisvorschau oder Suche über Cloud |
| Befehlspalette | Lokal prototypisch | Browserprüfung | Nur atelier-Befehle; kein Plugin-Command-Registry |
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
| Firebase Authentication | Google + E-Mail/Passwort; Verknüpfen weiterer Anmeldemethoden im Profil ergänzt | Code-/Buildprüfung; Anmeldung und Provider-Link mit echtem Firebase-Konto noch nicht manuell verifiziert | Beide Methoden müssen auf derselben Firebase-UID verknüpft sein; getrennte vorhandene UID-Konten werden nicht automatisch zusammengeführt |
| Firestore-Synchronisierung | Implementiert: Vault-/Notiz-Listener, Cloud-Schreibvorgänge, nutzerbezogener Cache und Konfliktnotizen | Code-/Buildprüfung; Firebase Emulator und echtes Zweitgerät noch nicht verfügbar/verifiziert | Live-Regeln, echte Offline-Warteschlange und Zwei-Geräte-Race müssen empirisch abgenommen werden |
| Cloud Storage | Offen | Emulator erforderlich | Dateiupload/-download und Regeln vorbereitet, Client fehlt |
| Nutzer-/Vault-Sicherheitsregeln | Regeln + Emulator-Test vorbereitet | `npm run test:rules` gestartet, Emulatorstart scheiterte | Java-Binärdatei ist auf diesem Mac nur ein JRE-Hinweis ohne Runtime; außerdem blockiert DNS den Firebase-CLI-Remote-Aufruf. Firestore/Storage-Regeln noch nicht empirisch bestätigt |
| PWA | Installierbare Metadaten + Offline-Shell | Browser: standalone-Manifest, 192/512-Icons (HTTP 200), aktiver Service Worker | PWA nicht in Betriebssystem installiert; Offline-Notizänderungen und Sync fehlen |
| macOS-/Windows-Desktop | Tauri-2-Gerüst + Icon-Generierung | Buildversuch steht aus | macOS: Rust/Cargo fehlen; Windows-Runner fehlt. Keine Installer gebaut/installiert/getestet |

## Geplante Abnahmefälle

1. Import-Testvault mit YAML, Unicode, verschachtelten Ordnern, Wikilinks und Anhängen einlesen und vollständig exportieren.
2. Notiz anlegen, bearbeiten, verlinken, umbenennen, suchen, mit einem zweiten Gerät synchronisieren und als Markdown exportieren.
3. Offline-Änderungen und gleichzeitige Änderungen zweier Geräte; bei Konflikt beide Textstände erhalten.
4. Firebase Emulator: Konto B kann Vault von Konto A weder lesen noch ändern.
5. Installer auf macOS und Windows bauen, installieren und starten; tatsächlich geprüfte Artefakte protokollieren.

## Funktionsprüfungen

Manuelle Browser-Abnahme am 20.11.2026: Notiz anlegen, Markdown bearbeiten, Vorschau, Wikilink öffnen, Zielnotiz umbenennen (eingehender Link aktualisiert), Volltext suchen; alles bestätigt. Nach UI-Korrektur zusätzlich: Google-/E-Mail-Login-Ansicht, Sidebar-Aktionslayout, Ordnerdialog/-einklappen sowie Klick Vorschau → Bearbeiten und Klick außerhalb → Vorschau geprüft. Root-Drag-Test: Notiz aus dem Ordner auf „Hauptebene /“ gezogen; Pfad wechselte zu `Wikilinks.md`. Profilformular renderte Vor- und Nachnamefelder; tatsächliche Kontospeicherung nicht ausgeführt. Ein einzelner Dateibaum-Klick fokussiert jetzt direkt den Editor; Erstellungszeile bleibt sichtbar, Editorrahmen entfernt. Bei abgemeldetem lokalen Modus erscheint „Anmelden“; „Abmelden“ gibt es in einer Firebase-Sitzung. Weitere Änderungen: nutzerbezogene Firestore-Listener und Transaktions-Konfliktkopien implementiert, Namen im Profil editierbar, Dateibaum-Drag-Ziel Hauptebene ergänzt, Editor-Schrift auf Proportionalschrift gestellt, Startseitenname grün hervorgehoben, Marken-Favicon erneuert. Firebase-SDK-Module laden im Browser. `npm run check` und `npm run build` erfolgreich. Manifest, beide PNG-Icons und aktiver Service Worker geprüft. `npm run test:rules` wurde versucht, aber Emulatorstart scheiterte: Java meldet, dass keine Java-Runtime vorhanden ist, und der Firebase CLI Remote-Aufruf scheitert an DNS. ZIP-Roundtrip, Import/Export mit Testvault, erfolgreiche Firebase Emulator-Prüfung, tatsächliche Anmeldung, Offline-/Mehrgeräte-Sync und Desktop-Installer wurden nicht geprüft.

Zusatzprüfung React-UI am 20.11.2026: `/login` rendert die React-Login-Seite, unangemeldeter `/` leitet dorthin. Rechtsklick zeigte Dateiaktionen und Zielordner; Ziehen einer Notiz in einen Ordner änderte den Pfad. Ziehen einer Notiz in eine geöffnete Vorschau fügte einen Wikilink ein und wechselte in den Bearbeitungsmodus. Enter startet Inline-Umbenennung. Profilmenü, Einstellungen und Ordner-Pfeil-Ausrichtung wurden geprüft. `npm run check` und `npm run build` erfolgreich; echter Firebase-Login/Firestore-Roundtrip bleibt ungeprüft.

Zusatzprüfung am 20.11.2026: Titelbearbeitung und Link-Drag in einem isolierten Browserkontext geprüft. Nach Titeländerung und Klick auf Graph wurde der neue Titel sofort im Dateibaum angezeigt. Beim Ziehen einer zweiten Notiz in den Editor wurde `[[Wikilinks]]` am Cursor eingefügt, die aktive Notiz blieb geöffnet und im Editiermodus. Zwei Notizen wurden in denselben Ordner gezogen und ihre Reihenfolge per Drag-and-drop verändert. `npm run check`, `npm run build` und `git diff --check` erfolgreich; echter Firestore-Sync für Titel/Reihenfolge weiterhin offen.

Dateiaktionen am 20.11.2026: Rechtsklick und Drei-Punkte-Menü bei Datei und Ordner geprüft. Ordnerumbenennung aktualisierte den Baum und behielt das enthaltene Dokument; Unterordner und eine Notiz konnten direkt im Ordner angelegt werden. Löschen eines Ordners mit Unterordnern und Notizen zeigte eine Bestätigung und entfernte den gesamten Teilbaum.

Moduswechsel am 20.11.2026: Zwei Notizen nacheinander aus dem Lesemodus geöffnet; der Modus blieb Lesen. Nach Klick in den Inhalt wechselte die App in den Bearbeitungsmodus, und der nächste Dokumentwechsel blieb im Bearbeiten-Modus.

Sidebar-Breite am 20.11.2026: Trennsteg im Browser gezogen; Dateibaum wuchs von 256 auf 356 px. Nach Neuladen blieb die neue Breite erhalten.

Ordnerreihenfolge am 20.11.2026: `Notizen` an den oberen Rand von `Ideen` gezogen; die Geschwisterreihenfolge im Dateibaum wechselte sichtbar zu `Notizen`, `Ideen`.

Lesebereich am 20.11.2026: Eine lange Testnotiz erzeugte einen scrollbaren Lesebereich (749 px Viewport, 4.548 px Inhalt); Scrollen auf 500 px geprüft. Offene und erledigte Tasks erschienen als Checkboxen; Umschalten aktualisierte die Markdown-Task-Zeile und ließ den Lesemodus aktiv.

Sidebar/Login am 20.11.2026: 30 Testnotizen erzeugten eine Dateiliste mit 1.057 px Inhalt in 711 px Höhe; Scrollen innerhalb der Liste geprüft. Das Anmelde-Logo wurde mit derselben `brand-mark`-Komponente wie das App-Logo geprüft (grün, weißes „a“, apricotfarbener Punkt).
