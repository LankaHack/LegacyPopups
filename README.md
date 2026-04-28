# LegacyPopups

## Testbasis

Dieses Repository enthaelt jetzt eine minimale, lokale Testbasis fuer die wichtigsten Kernpfade:

- PHP-Tests fuer `PopupRepository`, `PopupResolver` und `ImportExportService`
- JavaScript-Tests fuer `TriggerEngine` und `FrequencyGate`

Die PHP-Tests verwenden bewusst einen kleinen WordPress-Stub-Bootstrap in `tests/php/bootstrap.php`. Dadurch lassen sich Repository-, Resolver- und Import/Export-Pfade ohne komplette WordPress-Testinstallation pruefen.

## PHP-Tests ausfuehren

Voraussetzung: PHP und Composer sind lokal verfuegbar.

```bash
composer install
composer test:php
```

Alternativ direkt:

```bash
vendor/bin/phpunit -c phpunit.xml.dist
```

## JavaScript-Tests ausfuehren

Voraussetzung: Node.js und npm sind lokal verfuegbar.

```bash
npm install
npm run test:js
```

## Teststruktur

- `tests/php/bootstrap.php`: WordPress-Stubs und Autoloader-Bootstrap fuer PHPUnit
- `tests/php/Domain/PopupRepositoryTest.php`: Persistenz, Query-Filter und Duplizieren
- `tests/php/Domain/ImportExportServiceTest.php`: Exportformat, Draft-Import mit neuer ID, Invalid-Format-Fall
- `tests/php/Frontend/PopupResolverTest.php`: Zielgruppen-Matching fuer Regeln und Gruppen
- `tests/js/runtime.test.js`: TriggerEngine- und FrequencyGate-Verhalten auf Basis der Frontend-Runtime

## Hinweis

Die JavaScript-Tests nutzen eine gezielte Test-Schnittstelle in `assets/frontend/js/runtime.js`, die nur aktiv wird, wenn `window.__LEGACY_POPUPS_TEST__` gesetzt ist. Das Produktionsverhalten der Runtime bleibt dadurch unveraendert.

## Hardening-Notizen

Die aktuellen Hardening-Massnahmen konzentrieren sich auf die engsten Angriffs- und Stabilitaetspfade:

- Builder-, Trigger-, Targeting-, Display- und Frequency-Schemas werden serverseitig normalisiert statt nur rekursiv als Freiform-Arrays uebernommen.
- Builder-Nodes sind auf unterstuetzte Typen und eine feste Maximalanzahl begrenzt, damit Import und Frontend-Payloads nicht unkontrolliert wachsen.
- Rekursive Schema-Sanitization ist tiefenbegrenzt, um pathologische Import- oder REST-Payloads abzufangen.
- Komplexe CSS-Selector-Trigger werden serverseitig verworfen, bevor sie im Frontend teure DOM-Abfragen ausloesen.
- Frontend-Tracking sendet nur noch den Pfad statt der kompletten URL, um unnoetige Query- oder PII-Leaks zu vermeiden.

## Release-Checkliste 1.0

- Alle REST-Endpunkte mit gueltigem Nonce, passendem Capability-Check und negativen Tests fuer 401/403/404 pruefen.
- Import mit kaputten, uebergrossen und zukuenftigen Schema-Payloads gegen Testfaelle und manuelle Stichproben absichern.
- Builder-Schema-Version anheben erst dann, wenn ein expliziter Migrationspfad und Rueckfallverhalten dokumentiert sind.
- Frontend-Runtime auf echten Seiten mit mehreren aktiven Popups, Scroll-Triggern und Selector-Triggern auf Speicher- und Listener-Leaks pruefen.
- Analytics-Endpoint unter Last auf Rate-Limit-Verhalten, Duplikatlast und deaktiviertes Tracking pruefen.
- Preview- und Admin-Ausgaben mit aktivem `WP_DEBUG` und Coding-Standards-Checks auf Escaping-Warnungen kontrollieren.
- Testmatrix mindestens auf aktuellem WordPress, einer aelteren noch unterstuetzten WordPress-Version und aktuellem PHP-Release durchlaufen.
- Export/Import zwischen zwei getrennten Installationen mit unterschiedlichen Popup-Staenden manuell gegenpruefen.
- Vor dem Release die finalen Assets, `readme.txt`, Versionsnummer in `legacy-popups.php` und Changelog konsistent ziehen.
- Git-Status vor dem Tagging ohne `node_modules/`, `vendor/`, Caches oder temporäre Exportdateien sicherstellen.