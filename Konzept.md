# LegacyPopups - Produktkonzept und Entwickler-Manual

## 1. Zielbild

LegacyPopups soll ein professionelles WordPress-Plugin fuer die Erstellung, Ausspielung, Analyse und Wiederverwendung von Popups sein. Das Plugin richtet sich an Agenturen, Shop-Betreiber, Publisher und Marketing-Teams, die ohne HTML-Kenntnisse hochwertige Popups bauen und gezielt ausspielen wollen.

Der Schwerpunkt liegt auf vier Prinzipien:

- visueller Builder statt Code-Eingabe
- flexible Trigger- und Targeting-Logik
- belastbare Performance und Datenschutzfaehigkeit
- moderne, frische und professionelle Admin-GUI

LegacyPopups verwendet bewusst keine Browser-Popup-Fenster wie `window.open()`, sondern rendert Overlays und Layer direkt im DOM der Website. Dadurch wird das Verhalten gaengiger Popup-Blocker weitgehend umgangen, weil technisch keine klassischen Browser-Popups erzeugt werden. Eine absolute Garantie gegen alle Blocker gibt es nicht, aber die technische Basis ist deutlich robuster als klassische Popup-Mechaniken.

## 2. Produktziele

### 2.1 Fachliche Ziele

- Popups ohne HTML- oder CSS-Kenntnisse gestalten koennen
- unterschiedliche Popup-Arten mit einem Builder abbilden
- hochgradig konfigurierbare Ausspielung nach Triggern und Regeln
- Popups einfach aktivieren, deaktivieren, duplizieren und vorschauen
- Anzeigen, Interaktionen, Conversions und Schliessungen statistisch auswerten
- Popups zwischen Websites exportieren und importieren koennen

### 2.2 Technische Ziele

- WordPress-konforme Architektur mit klaren Verantwortlichkeiten
- saubere Trennung zwischen Admin-Builder, Laufzeit-Engine und Tracking
- geringe Frontend-Belastung durch lazy loading und regelbasierte Ausspielung
- API-faehige Struktur fuer spaetere Erweiterungen

### 2.3 UX-Ziele

- Builder wirkt modern, klar, hochwertig und visuell stark
- Fokus auf Drag-and-drop, Live-Vorschau und sofort sichtbare Designaenderungen
- kein technischer Ueberhang fuer Redakteure

## 3. Hauptfunktionen

### 3.1 Popup-Builder

Der Builder ist das Kernprodukt. Er muss visuell, schnell und selbsterklaerend sein.

### Funktionsumfang

- visuelle Layout-Erstellung per Block-/Komponenten-System
- Text, Bild, Button, Formular, Spacer, Icon, Countdown, Badge, Video, HTML-Slot als Elemente
- Design-Einstellungen ohne CSS:
  - Farben
  - Typografie
  - Eckenradius
  - Schatten
  - Rahmen
  - Abstaende
  - Innen- und Aussenabstaende
  - Breite und Hoehe
  - Hintergrundbilder und Overlays
- responsive Darstellung mit Desktop-, Tablet- und Mobile-Vorschau
- Vorlagenbibliothek fuer haeufige Use-Cases:
  - Newsletter-Anmeldung
  - Rabatt-Aktion
  - Exit-Intent-Angebot
  - Hinweisfenster
  - Event-Promo
  - Cookie-/Hinweis-Dialoge im Popup-Stil
- globale Design-Presets
- Popup duplizieren
- Entwurf speichern
- Vorschau im Backend
- Vorschau auf echter Seite ueber Preview-Link

### Builder-Ansatz

Empfohlen ist ein React-basierter Admin-Builder innerhalb von WordPress. Die Daten werden nicht als frei formatierter HTML-Blob gespeichert, sondern als strukturierte JSON-Definition. Dadurch werden Builder, Render-Engine, Export und Statistik robuster.

### 3.2 Trigger-System

Jedes Popup kann eine oder mehrere Trigger-Bedingungen besitzen. Trigger und Zielgruppenregeln werden getrennt modelliert.

### Trigger-Typen

- sofort bei Seitenaufruf
- nach Zeitverzoegerung in Sekunden
- beim Scrollen bis zu einer Seitenhoehe in Prozent
- beim Erreichen eines Elements per CSS-ID oder CSS-Selector
- beim Klick auf ein bestimmtes Element
- Exit-Intent bei Mausbewegung Richtung Browser-Oberkante
- nach Inaktivitaet fuer eine definierte Dauer
- nach Anzahl besuchter Seiten
- beim Versuch, die Seite zu verlassen oder Tab-Fokus zu verlieren

### Erweiterbare Trigger-Architektur

Jeder Trigger wird als eigener Handler implementiert. So koennen spaeter leicht neue Trigger ergaenzt werden, etwa WooCommerce-bezogene Trigger oder URL-Parameter-Trigger.

### 3.3 Targeting und Ausspielungsregeln

Das Plugin soll nicht nur auf Ereignisse reagieren, sondern auch entscheiden, ob ein Popup fuer den aktuellen Besucher relevant ist.

### Zielgruppen- und Regeloptionen

- nach Uhrzeit
- nach Wochentag
- nach Datumsspanne
- nach Geraetetyp:
  - Desktop
  - Tablet
  - Mobile
- nach Sprache bzw. Locale
- nach lokaler Herkunft, z. B. Land, Region oder Sprachraum
- nach URL, URL-Muster, Seitentyp, Post-Type, Kategorie, Tag
- nur fuer Startseite, Beitragsseiten, Produktseiten oder bestimmte IDs
- nur fuer eingeloggte oder ausgeloggte Nutzer
- nur fuer bestimmte Benutzerrollen
- nur fuer Referrer oder Kampagnenparameter
- A/B-Varianten fuer spaetere Erweiterung

### Regel-Logik

- Regelgruppen mit `AND` innerhalb der Gruppe
- mehrere Gruppen mit `OR`
- Prioritaetssteuerung, falls mehrere Popups gleichzeitig gueltig waeren
- globale Unterdrueckungsregeln, um Popup-Kollisionen zu verhindern

### 3.4 Positionierung und Anzeigevarianten

Die Popups muessen frei oder preset-basiert positionierbar sein.

### Positionsmodi

- freie Position ueber X/Y-Offsets
- Bildschirmmitte
- oben links
- oben mittig
- oben rechts
- unten links
- unten mittig
- unten rechts

### Anzeigeoptionen

- mit Overlay
- ohne Overlay
- schliessbar per X-Button
- schliessbar per Klick auf Overlay
- nicht schliessbar bis Aktion erfolgt
- Animationen beim Einblenden und Ausblenden
- Stapelverhalten bei mehreren aktiven Popups

### 3.5 Frequenzsteuerung via Cookie und Session

Fuer jedes Popup sollen Sichtbarkeitsgrenzen definierbar sein.

### Optionen

- nur einmal pro Session
- nur einmal pro Zeitraum, z. B. 1 Tag, 7 Tage, 30 Tage
- maximal X Einblendungen pro Zeitraum
- Reset bei Conversion
- unterschiedliche Regeln fuer Schliessen, Anzeigen und Conversion

### Technische Umsetzung

- lokale Speicherung per Cookie oder `localStorage`
- Session-Steuerung ueber `sessionStorage`
- serverseitige Statistik bleibt davon getrennt

### 3.6 Popup-Lebenszyklus

Jedes Popup besitzt klare Status und Verwaltungsfunktionen.

### Status

- Entwurf
- Aktiv
- Geplant
- Pausiert
- Archiviert

### Verwaltungsfunktionen

- aktivieren
- deaktivieren
- duplizieren
- loeschen
- exportieren
- importieren
- Vorschau oeffnen
- Versionshinweise spaeter erweiterbar

### 3.7 Statistiken und Auswertungen

LegacyPopups soll deutlich mehr bieten als nur Einblendungszaehler.

### Metriken pro Popup

- Impressionen
- eindeutige Impressionen
- Schliessungen
- Klicks auf CTA-Elemente
- Formular-Absendungen
- Conversion-Events
- Conversion-Rate
- Sichtbarkeit nach Geraetetyp
- Sichtbarkeit nach Land/Region, sofern aktiviert und datenschutzrechtlich zulaessig
- Zeitraumvergleich

### Darstellungen

- Dashboard-Uebersicht mit Top-Popups
- Zeitreihen je Popup
- Filter nach Zeitraum
- Export der Statistiken als CSV spaeter moeglich

### Tracking-Strategie

- Frontend sendet Events an REST-Endpunkt
- Events werden aggregiert gespeichert
- optional Rohdaten-Tabelle fuer Premium-/Debug-Modus

### 3.8 Export und Import

Popups sollen zwischen Installationen transportierbar sein.

### Export-Inhalt

- Popup-Metadaten
- Builder-JSON
- Trigger-Konfiguration
- Regelgruppen
- Design-Einstellungen
- Frequenzregeln

### Format

- JSON als primaeres Austauschformat
- optional ZIP mit Assets in einer spaeteren Ausbaustufe

### 3.9 Datenschutz und Compliance

Da Cookies, Geo-Targeting und Tracking involviert sein koennen, muss Datenschutz von Beginn an sauber beruecksichtigt werden.

### Anforderungen

- Tracking optional deaktivierbar
- Statistik-Cookies dokumentierbar
- Geo-Targeting nur aktiv, wenn Datenquelle datenschutzkonform konfiguriert ist
- Loesch- und Aufbewahrungsregeln fuer Tracking-Daten
- REST-Endpunkte mit Nonce-Absicherung und Rate-Limits

## 4. Admin-GUI-Konzept

Die GUI soll modern, frisch und visuell hochwertig sein. Kein klassisches WordPress-Einstellungsformular, sondern ein editorisches Produktgefuehl.

### Design-Richtung

- helle, klare Oberflaeche mit starken Kontrasten
- warme neutrale Grundflaechen statt sterilem Grau
- markante Akzentfarbe fuer Aktionen, z. B. petrol, koralle oder electric blue
- grosszuegige Abstaende und weiche Panels
- klare Typohierarchie
- Live-Vorschau stets sichtbar

### Hauptbereiche

- Dashboard
- Popup-Liste
- Builder
- Trigger- und Regel-Editor
- Statistikbereich
- Import/Export
- globale Einstellungen

### Builder-Layout

- linke Seitenleiste: Elemente und Vorlagen
- mittlerer Bereich: visuelle Canvas mit Popup-Vorschau
- rechte Seitenleiste: Eigenschaften des selektierten Elements bzw. Popup-Containers
- oberer Balken: Speichern, Vorschau, Aktivieren, Status, Undo/Redo

### UX-Prinzipien

- jede Aenderung sofort sichtbar
- moeglichst keine modalen Einstellungsmonster
- Komplexitaet ueber ausklappbare Expertenoptionen steuern
- mobile und Desktop-Vorschau mit einem Klick

## 5. Technische Architektur

### 5.1 Architekturuebersicht

Empfohlen wird eine modulare Plugin-Architektur mit diesen Schichten:

- Plugin-Bootstrap
- Admin-App
- Domain-Logik fuer Popups, Trigger, Regeln und Analytics
- Frontend-Runtime fuer Rendering und Event-Handling
- REST-API fuer Builder, Preview, Tracking, Import/Export
- Persistenzschicht fuer Custom Post Type und eigene Tabellen

### 5.2 Datenmodell

### Custom Post Type

`legacypopup`

Verwendung:

- Titel
- Status
- Basis-Metadaten
- schnelle WordPress-Integration fuer Listenansichten und Berechtigungen

### Post Meta oder strukturierte Meta-Felder

- `_lp_builder_schema`
- `_lp_trigger_schema`
- `_lp_targeting_schema`
- `_lp_display_schema`
- `_lp_frequency_schema`
- `_lp_popup_status`
- `_lp_schedule_from`
- `_lp_schedule_to`

### Eigene Tabellen

`wp_legacypopups_events`

- `id`
- `popup_id`
- `event_type`
- `session_hash`
- `visitor_hash`
- `url`
- `device_type`
- `country_code`
- `created_at`

`wp_legacypopups_event_daily`

- `id`
- `popup_id`
- `event_date`
- `impressions`
- `unique_impressions`
- `closes`
- `clicks`
- `conversions`

Die zweite Tabelle dient als Aggregationsebene fuer schnelle Reports.

### 5.3 Empfohlene Plugin-Struktur

```text
legacy-popups/
|-- legacy-popups.php
|-- uninstall.php
|-- readme.txt
|-- assets/
|   |-- admin/
|   |-- frontend/
|-- includes/
|   |-- Core/
|   |-- Admin/
|   |-- Frontend/
|   |-- Domain/
|   |-- Infrastructure/
|   |-- Rest/
|-- templates/
|-- languages/
|-- tests/
```

### 5.4 Laufzeitfluss im Frontend

1. WordPress laedt minimale Frontend-Basisdaten fuer die aktuelle Seite.
2. Runtime prueft Zielgruppen- und Frequenzregeln lokal.
3. Nur relevante Trigger werden initialisiert.
4. Trigger feuert Event.
5. Popup wird per Renderer in den DOM eingebettet.
6. Tracking-Events werden asynchron an REST-Endpunkt gesendet.

### 5.5 Popup-Blocker-Resistenz

Technische Leitlinien:

- keine Browser-Popup-Fenster verwenden
- Popups als regulare DOM-Elemente rendern
- Skripte nur dann laden, wenn aktive Popups fuer die aktuelle Anfrage relevant sind
- keine aggressiven oder verdachtserregenden Script-Muster verwenden
- semantisch sauberes Markup und kontrollierte Event-Listener nutzen

## 6. Entwickler-Manual

Dieses Kapitel beschreibt die empfohlene interne Struktur und die wichtigsten Funktionen fuer die Umsetzung.

### 6.1 Kernmodule

### Modul `Core`

Verantwortlich fuer Bootstrap, Hook-Registrierung, Aktivierung und Deaktivierung.

Empfohlene Klassen:

- `Plugin`
- `Activator`
- `Deactivator`
- `Container`
- `Assets`

Wichtige Aufgaben:

- Konstanten definieren
- Services registrieren
- Admin- und Frontend-Hooks initialisieren
- REST-Routen booten

### Modul `Domain`

Enthaelt die Geschaeftslogik.

Empfohlene Klassen:

- `PopupRepository`
- `PopupEntity`
- `PopupStatusService`
- `TriggerDefinition`
- `TargetingRule`
- `FrequencyPolicy`
- `AnalyticsService`
- `ExportService`
- `ImportService`

### Modul `Admin`

Verantwortlich fuer die WordPress-Admin-Oberflaeche und den Builder.

Empfohlene Klassen/Funktionen:

- `AdminMenu::register()`
- `AdminAssets::enqueue()`
- `PopupListPage::render()`
- `BuilderPage::render()`
- `SettingsPage::render()`
- `PreviewController::get_preview_url()`

### Modul `Frontend`

Verantwortlich fuer Ausspielung, Trigger und Rendering im Browser.

Empfohlene Komponenten:

- `FrontendBootstrap`
- `PopupResolver`
- `TriggerEngine`
- `Renderer`
- `FrequencyGate`
- `TrackingClient`

### Modul `Rest`

Verantwortlich fuer REST-Endpunkte.

Empfohlene Controller:

- `PopupRestController`
- `PreviewRestController`
- `AnalyticsRestController`
- `ImportExportRestController`

### 6.2 Wichtige Funktionen und Verantwortlichkeiten

### `Plugin::boot()`

Initialisiert alle Module und registriert Hooks.

### `PopupRepository::find_active_for_request(RequestContext $context)`

Liefert alle fuer die aktuelle Anfrage potenziell relevanten Popups.

### `PopupResolver::resolve(RequestContext $context)`

Prueft Status, Planung, Targeting und Prioritaet. Gibt die Popups zurueck, die im Frontend ueberhaupt betrachtet werden duerfen.

### `TriggerEngine::register(array $popup_payloads)`

Initialisiert nur die Trigger, die fuer die aktuellen Popups benoetigt werden.

### `FrequencyGate::can_show(PopupConfig $popup, VisitorState $state)`

Prueft Session-, Cookie- und Local-Storage-Regeln.

### `Renderer::mount(PopupPayload $payload)`

Erzeugt Overlay, Container, Content-Komponenten und Animationen im DOM.

### `TrackingClient::track(string $event_type, array $payload)`

Sendet Impression-, Klick-, Close- und Conversion-Events an die API.

### `AnalyticsService::record_event(EventData $event)`

Validiert und persistiert Events serverseitig.

### `ExportService::export_popup(int $popup_id)`

Serialisiert alle popup-relevanten Daten in ein uebertragbares Format.

### `ImportService::import_popup(array $payload)`

Validiert das Importformat und legt ein neues Popup an.

### 6.3 REST-Endpunkte

Empfohlene Endpunkte:

- `GET /legacypopups/v1/popups/<id>`
- `POST /legacypopups/v1/popups`
- `PUT /legacypopups/v1/popups/<id>`
- `POST /legacypopups/v1/popups/<id>/duplicate`
- `GET /legacypopups/v1/popups/<id>/preview`
- `POST /legacypopups/v1/analytics/event`
- `GET /legacypopups/v1/analytics/summary/<id>`
- `POST /legacypopups/v1/export/<id>`
- `POST /legacypopups/v1/import`

### 6.4 Builder-Datenformat

Beispielhafte Struktur:

```json
{
  "version": 1,
  "layout": {
    "width": 540,
    "position": "center",
    "overlay": true
  },
  "nodes": [
    {
      "id": "hero-title",
      "type": "text",
      "props": {
        "content": "Jetzt 15 % sichern",
        "fontSize": 34,
        "fontWeight": 700,
        "align": "center"
      }
    },
    {
      "id": "cta-button",
      "type": "button",
      "props": {
        "label": "Rabatt aktivieren",
        "url": "/angebot",
        "variant": "solid"
      }
    }
  ]
}
```

Vorteile:

- stabil exportierbar
- migrationsfaehig
- validierbar
- unabhängig vom konkreten HTML-Output

### 6.5 Frontend-JavaScript-Module

Empfohlene Runtime-Module:

- `bootstrap.js`
- `resolver.js`
- `trigger-time-delay.js`
- `trigger-scroll-percent.js`
- `trigger-selector-hit.js`
- `trigger-exit-intent.js`
- `renderer.js`
- `storage.js`
- `tracking.js`

### 6.6 WordPress-Hooks

Empfohlene Hooks:

- `init`
- `admin_menu`
- `admin_enqueue_scripts`
- `wp_enqueue_scripts`
- `rest_api_init`
- `save_post_legacypopup`
- `before_delete_post`

Eigene Filter/Aktionen fuer Erweiterbarkeit:

- `legacypopups_popup_payload`
- `legacypopups_resolved_popups`
- `legacypopups_should_track_event`
- `legacypopups_trigger_types`
- `legacypopups_targeting_rules`

### 6.7 Sicherheitsanforderungen

- alle Admin-Aktionen mit Capability-Pruefung
- Nonces fuer REST und Admin-Aktionen
- saubere Sanitization und Escaping
- Builder-JSON serverseitig validieren
- Rate-Limiting fuer Analytics-Endpoint
- Importdaten strikt validieren

### 6.8 Performance-Leitlinien

- nur aktive und relevante Popups an den Client liefern
- Builder-Assets nur im Admin laden
- Frontend-Runtime modular und klein halten
- Statistik aggregieren statt alles live auszuwerten
- Geo-Targeting optional und cache-vertraeglich konzipieren

### 6.9 Testing-Strategie

- PHP-Unit-Tests fuer Repository, Resolver, Import/Export, Analytics-Service
- JavaScript-Unit-Tests fuer TriggerEngine, FrequencyGate, Renderer-Utilities
- End-to-End-Tests fuer Builder-Speicherung und Popup-Ausspielung
- Snapshot-Tests fuer Builder-Schema-Migrationen

## 7. Empfohlene Umsetzungsphasen

### Phase 1 - Fundament

- Plugin-Bootstrap
- Custom Post Type
- Admin-Menue
- Basisdatenmodell
- REST-Grundstruktur

### Phase 2 - Builder MVP

- React-Admin-App
- Canvas
- Basis-Komponenten
- Speichern und Laden von Popup-JSON
- Preview

### Phase 3 - Trigger und Frontend-Engine

- Seitenaufruf
- Zeitverzoegerung
- Scroll-Prozent
- CSS-Selector-/ID-Trigger
- Exit-Intent

### Phase 4 - Regeln und Frequenz

- Device-Targeting
- Zeitfenster
- URL-Regeln
- Cookie-/Session-Steuerung

### Phase 5 - Statistik

- Event-Erfassung
- Aggregation
- Dashboard-Widgets
- Popup-Reportseiten

### Phase 6 - Import/Export und Polishing

- JSON-Export/Import
- Template-Bibliothek
- GUI-Finishing
- Tests und Hardening

## 8. Prompt-Roadmap fuer die schrittweise Umsetzung

Die folgenden Prompts sind so aufgebaut, dass das Plugin iterativ und kontrolliert entwickelt werden kann. Zu jedem Prompt ist das bevorzugte Modell angegeben.

### Prompt 1 - Plugin-Fundament aufsetzen

**Empfohlenes Modell:** GPT-5.4

```text
Erstelle das Grundgeruest fuer das WordPress-Plugin "LegacyPopups" in diesem Repository. Lege eine saubere, modulare Plugin-Struktur an mit Bootstrap-Datei, Aktivierungs- und Deaktivierungslogik, Namespaces, Includes-Ordnern, readme.txt und uninstall.php. Registriere ein Admin-Menue "LegacyPopups" und einen Custom Post Type fuer Popups. Achte auf WordPress-Standards, saubere OOP-Struktur und Erweiterbarkeit.
```

### Prompt 2 - Datenmodell und Repository-Schicht

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups das Datenmodell fuer Popups. Nutze den bestehenden Custom Post Type und fuehre strukturierte Meta-Felder fuer Builder, Trigger, Targeting, Display und Frequency ein. Erstelle Repository- und Entity-Klassen fuer Laden, Speichern, Aktualisieren, Duplizieren und Statuswechsel. Halte die Logik sauber getrennt von der UI.
```

### Prompt 3 - REST-API-Grundgeruest

**Empfohlenes Modell:** GPT-5.4

```text
Erstelle fuer LegacyPopups eine REST-API-Grundstruktur mit Namespaces, Controller-Klassen und Registrierung ueber rest_api_init. Implementiere Endpunkte zum Laden, Speichern und Duplizieren von Popups. Absichere alle Endpunkte mit Capability-Pruefungen, Nonces und valider Request-Validierung.
```

### Prompt 4 - Moderne Admin-GUI als App-Shell

**Empfohlenes Modell:** Claude Sonnet 4.5

```text
Baue fuer LegacyPopups eine moderne, frische WordPress-Admin-GUI als React-basierte App-Shell. Das Design soll hochwertig wirken: klare Typografie, starke visuelle Hierarchie, warme helle Flaechen, markante Akzentfarbe und grosszuegige Panels. Implementiere zunaechst nur die Shell mit Navigation fuer Dashboard, Popup-Liste, Builder, Statistik und Einstellungen. Erzeuge eine designstarke, produktreife UI statt eines Standard-WordPress-Formulars.
```

### Prompt 5 - Popup-Liste und Statusverwaltung

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere in der LegacyPopups-Admin-App eine Popup-Liste mit Suchfeld, Status-Badges, Aktivieren/Deaktivieren, Duplizieren, Loeschen und Vorschau. Die Liste soll mit der vorhandenen REST-API verbunden sein. Achte auf saubere Zustandsverwaltung und klare Trennung zwischen UI und Datenzugriff.
```

### Prompt 6 - Builder-Canvas und Layout-Grundlagen

**Empfohlenes Modell:** Claude Sonnet 4.5

```text
Implementiere fuer LegacyPopups den visuellen Popup-Builder mit dreispaltigem Layout: linke Leiste fuer Elemente, mittige Canvas mit Live-Vorschau, rechte Leiste fuer Eigenschaften. Unterstuetze zunaechst Popup-Container, Text, Bild, Button und Spacer. Das UI soll modern, editorisch und visuell stark wirken.
```

### Prompt 7 - Builder-State und JSON-Schema

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer den LegacyPopups-Builder ein robustes JSON-basiertes Schema mit Versionierung sowie eine State-Architektur fuer Hinzufuegen, Entfernen, Auswaehlen und Aktualisieren von Nodes. Speichern und Laden sollen ueber die bestehende REST-API erfolgen. Achte auf migrationsfaehige Datenstrukturen.
```

### Prompt 8 - Responsive Design-Controls

**Empfohlenes Modell:** Claude Sonnet 4.5

```text
Erweitere den LegacyPopups-Builder um Design-Controls fuer Farben, Typografie, Abstaende, Schatten, Eckenradius, Hintergrund und responsive Vorschau fuer Desktop, Tablet und Mobile. Die Bedienung soll visuell konsistent und hochwertig sein und ohne HTML- oder CSS-Wissen funktionieren.
```

### Prompt 9 - Vorschau-Mechanik

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups eine Vorschau-Funktion, mit der ein Popup im Backend und auf einer echten Frontend-Vorschauseite geladen werden kann. Nutze sichere Preview-Token oder Nonces. Die Vorschau soll unveroeffentlichte Entwuerfe korrekt rendern, ohne regulare Besucher zu beeinflussen.
```

### Prompt 10 - Frontend-Runtime und DOM-Renderer

**Empfohlenes Modell:** GPT-5.4

```text
Baue fuer LegacyPopups die Frontend-Runtime, die aktive Popups als DOM-Overlay rendert. Verwende keine Browser-Popup-Fenster, sondern reguliere In-Page-Elemente. Implementiere Renderer, Overlay, Close-Mechanik, Positionierung und einfache Ein-/Ausblendanimationen. Achte auf gute Performance und geringe Script-Groesse.
```

### Prompt 11 - Trigger: Seitenaufruf und Zeitverzoegerung

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups die ersten Trigger in der Frontend-Runtime: sofort bei Seitenaufruf und nach Zeitverzoegerung. Fuehre dafuer eine TriggerEngine mit erweiterbarer Architektur ein, damit spaeter weitere Trigger einfach ergaenzt werden koennen.
```

### Prompt 12 - Trigger: Scroll-Prozent, CSS-ID und Exit-Intent

**Empfohlenes Modell:** GPT-5.4

```text
Erweitere die LegacyPopups-TriggerEngine um Scroll-Prozent, CSS-ID/CSS-Selector-Erreichung und Exit-Intent. Implementiere die Trigger modular als einzelne Handler. Stelle sicher, dass Trigger nur initialisiert werden, wenn sie fuer mindestens ein aktives Popup benoetigt werden.
```

### Prompt 13 - Targeting-Regeln

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups ein regelbasiertes Targeting-System mit AND/OR-Gruppen. Unterstuetze zunaechst Uhrzeit, Wochentag, Geraetetyp, URL-Muster, eingeloggter Status und einfache Sprach-/Locale-Regeln. Erstelle dafuer eine Resolver-Schicht, die vor der Trigger-Initialisierung entscheidet, welche Popups fuer den aktuellen Request relevant sind.
```

### Prompt 14 - Cookie-, LocalStorage- und Session-Frequenzregeln

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups eine FrequencyGate-Komponente, die Popups nur einmal pro Session, einmal pro Zeitraum oder maximal X-mal in einem Zeitraum anzeigen kann. Nutze sessionStorage, localStorage und optional Cookies sinnvoll. Die Logik fuer Impression, Close und Conversion soll getrennt konfigurierbar sein.
```

### Prompt 15 - Statistik-Tracking im Frontend und Backend

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups ein Event-Tracking fuer Impressionen, Schliessungen, Klicks und Conversions. Baue dafuer REST-Endpunkte, serverseitige Validierung, eine Event-Tabelle und eine Aggregationsstrategie fuer Tageswerte. Achte auf Datenschutz, Nonces, Rate-Limits und Performanz.
```

### Prompt 16 - Statistik-Dashboard

**Empfohlenes Modell:** Claude Sonnet 4.5

```text
Baue in der LegacyPopups-Admin-App ein modernes Statistik-Dashboard mit Uebersichtskarten, Zeitreihen, Popup-Rankings und Zeitfiltern. Das UI soll klar, hochwertig und datenstark wirken. Nutze die vorhandenen Analytics-Endpunkte und stelle die wichtigsten KPIs pro Popup gut lesbar dar.
```

### Prompt 17 - Import und Export

**Empfohlenes Modell:** GPT-5.4

```text
Implementiere fuer LegacyPopups JSON-basierten Export und Import von Popups inklusive Builder-Schema, Triggern, Targeting, Display-Einstellungen und Frequency-Regeln. Validiere Importdaten streng und erzeuge beim Import neue Popup-IDs statt direkte Ueberschreibung.
```

### Prompt 18 - Vorlagenbibliothek

**Empfohlenes Modell:** Claude Sonnet 4.5

```text
Erweitere den LegacyPopups-Builder um eine visuell starke Vorlagenbibliothek mit modernen Presets fuer Newsletter, Rabatt, Exit-Intent, Event-Promo und Hinweis-Popups. Die Template-Auswahl soll inspirierend, hochwertig und schnell bedienbar sein.
```

### Prompt 19 - Qualitaetssicherung und Tests

**Empfohlenes Modell:** GPT-5.4-Codex

```text
Erstelle fuer LegacyPopups eine erste Testbasis. Implementiere PHP-Tests fuer Repository, Resolver und Import/Export sowie JavaScript-Tests fuer TriggerEngine und FrequencyGate. Wenn das Projekt noch keine Testumgebung besitzt, richte eine minimal sinnvolle Teststruktur ein und dokumentiere die Ausfuehrung.
```

### Prompt 20 - Hardening und Release-Vorbereitung

**Empfohlenes Modell:** GPT-5.4

```text
Fuehre fuer LegacyPopups ein technisches Hardening durch. Pruefe Sicherheitsaspekte, Sanitization, Escaping, Capability-Checks, REST-Absicherung, Performance der Frontend-Runtime und Upgrade-Sicherheit des Builder-Schemas. Erstelle ausserdem eine Release-Checkliste fuer Version 1.0.
```

## 9. Modell-Empfehlung pro Aufgabentyp

- `GPT-5.4` fuer Architektur, Backend, WordPress-Integration, API-Design und saubere Refactorings
- `Claude Sonnet 4.5` fuer UI-Konzept, Design-System, Admin-Layouts und gestalterisch starke Frontend-Oberflaechen
- `GPT-5.4-Codex` fuer testlastige Aufgaben, strukturierte Implementierungen und technische QA-Prompts

## 10. Empfohlener Start

Fuer eine robuste Umsetzung sollte mit Prompt 1 begonnen werden. Danach ist die Reihenfolge 2, 3, 4, 6, 7, 9, 10 sinnvoll. Erst wenn Builder, Datenmodell und Runtime stehen, sollten komplexere Trigger, Targeting, Statistik und Import/Export folgen.