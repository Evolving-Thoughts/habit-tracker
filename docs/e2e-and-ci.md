# Browser-E2E und CI

> Status: Browser-Tests sind implementiert und lokal geprüft. Das Hochladen von
> `.github/workflows/ci.yml` wurde vom GitHub-Token mit 403 verweigert. Der unten
> beschriebene Actions-Workflow ist vorbereitet, aber noch nicht im Repository aktiv.
> Dafür muss der Token Workflows-Schreibrechte erhalten oder die Datei lokal
> durch einen berechtigten Nutzer committed werden.

Dieser Block sichert den bestehenden Habit-Tracker ab. Er ergänzt weder Timer noch
Authentifizierung und ändert keine Produkt-API oder Datenbank-Entities.

## Testebenen

- Backend-Jest-Tests: isolierte Regeln, Services und Controller.
- Backend-Supertest-E2E: Nest mit echtem PostgreSQL (`habit_tracker_test`).
- Frontend-Vitest: Komponenten und Zustandsübergänge.
- Playwright: echte Vue-Oberfläche → echtes Nest-Backend → echtes PostgreSQL,
  ohne API-Mocks. API-Aufrufe werden nur zum Anlegen großer Listen und zur
  unabhängigen Prüfung der gespeicherten Ergebnisse verwendet.

Playwright führt die Abläufe in Desktop-Chromium und mobilem Chromium (Pixel-7-
Emulation) aus. Das ersetzt keinen Test auf einem echten Android-Gerät.

## Lokal starten (PowerShell, ab Repository-Wurzel)

Voraussetzungen: Node **24.20.0** (siehe `.node-version`), npm und Docker Compose.
Die Node-Version erfüllt auch die Anforderungen der vorhandenen Frontend-Abhängigkeiten.

```powershell
# Abhängigkeiten aus den Lockfiles installieren und Backend bauen.
cd backend
npm ci
npm run build
cd ../frontend
npm ci
npx playwright install chromium
cd ..

# Eigene Wegwerf-Datenbank. NICHT mit compose.yaml kombinieren.
docker compose -f compose.e2e.yaml -p habit-tracker-e2e up -d --wait

cd frontend
npm run typecheck:e2e
npm run test:e2e
# Optional: interaktive Ausführung oder letzten Bericht ansehen.
npm run test:e2e:ui
npm run test:e2e:report
cd ..

# Ausschließlich den Test-Container beenden.
docker compose -f compose.e2e.yaml -p habit-tracker-e2e down
```

Playwright startet und beendet Backend und Vite selbst. Normale Entwicklungsserver
auf 3000/5173 können parallel laufen. Die Testports **4310/4173 müssen frei sein**:
vorhandene Server werden absichtlich nicht wiederverwendet. Nach Backend-Änderungen
vor dem nächsten Browser-Test erneut `npm run build` im Backend ausführen.

Unter Linux benötigt der Playwright-Browser außerdem Systembibliotheken;
`npx playwright install --with-deps chromium` installiert sie (wie in CI).

## Datenisolation und Schutz

- Browser-DB: ausschließlich **habit_tracker_browser_e2e**, standardmäßig auf
  `127.0.0.1:55432`; nicht die Entwicklungs-DB und nicht die Backend-E2E-DB.
- Das separate Compose-Projekt nutzt einen eigenen Container mit flüchtigem
  Datenverzeichnis. Seine Beispiel-Zugangsdaten sind ausschließlich lokale Testwerte.
- Der Server-Launcher prüft Testmodus, Kennzeichnung, DB-Namen, Loopback-Host und
  Testports, **bevor** Nest eine Verbindung öffnet oder sein Schema synchronisiert.
- Das Reset-Skript prüft dieselben Werte und zusätzlich `current_database()`.
  Es leert alle vier FK-verknüpften Tabellen gemeinsam, ohne `CASCADE` und ohne
  einen HTTP-Reset-Endpunkt in der Anwendung.
- Jede Testausführung einschließlich Retry beginnt/endet mit sauberen Daten.
  Ein Worker verarbeitet Tests und beide Projekte nacheinander. Kein paralleler
  zweiter Playwright-Lauf gegen dieselbe DB; die belegten Serverports verhindern
  normalerweise schon dessen Start.
- Keine echte DB absichtlich in `habit_tracker_browser_e2e` umbenennen. Auch ein
  Namensschutz ersetzt nicht die eigene Wegwerf-Instanz und lokale Testzugänge.

Falls du eine **andere lokale Testinstanz** verwendest, werden nur diese expliziten
Verbindungswerte übernommen; die Ziel-DB und App-URLs bleiben fest:

```powershell
$env:E2E_DB_PORT = "55433"
$env:E2E_DB_USER = "mein_testuser"
$env:E2E_DB_PASSWORD = "mein_testpasswort"
```

Die Schutzprüfungen laufen auch unabhängig von PostgreSQL:

```powershell
node --test backend/test/browser-e2e/environment.test.cjs
```

## Abgedeckte Browserabläufe

- Todo-Dump: Erstellen, nach Reload lesen, Titel bearbeiten, erledigen/wieder
  öffnen, Löschbestätigung abbrechen und anschließend löschen.
- Heute: geplantes Todo erstellen, Dauer ändern, erledigen/wieder öffnen, löschen.
- Ein Todo aus dem Dump für heute planen und in Heute wiederfinden.
- Ungültige Todo-Erstellung: Formular bleibt offen, keine Daten werden geschrieben;
  Escape stellt den Fokus auf `+` zurück.
- Habit in Heute erstellen, erledigen/wieder öffnen und überspringen/wieder öffnen;
  Status unabhängig über die echte Historien-API prüfen.
- Feste Wochentage und Wochenziel über Formulare anlegen und nach Reload prüfen.
- Einen zukünftigen Typwechsel planen, aktuelle Regel unverändert lassen,
  pausieren/reaktivieren und löschen.
- Zukünftiges Habit vor seinem Start bearbeiten, ohne es in Heute anzuzeigen.
- Lange Listen in allen drei Ansichten: fester zentrierter SVG-Plus-Button, sofort sichtbarer nativer Dialog,
  Titelfokus, Tastaturnavigation ohne Fokus auf Hintergrund-Steuerelemente,
  Escape sowie Scroll-/Fokus-Rückkehr. Browser-Chrome kann im nativen Tab-Zyklus
  kurzzeitig Fokus erhalten; das ist kein Fokus auf die inerte Hintergrundseite.

Kalenderdaten für die Tests kommen aus der laufenden API; zukünftige Termine
werden relativ dazu berechnet. Die Tests frieren nicht nur die Browseruhr ein,
was sie von der Backenduhr entkoppeln würde. Tageswechsel-/DST-Geschäftsregeln
bleiben zusätzlich durch die bestehenden Backend-Tests abgedeckt.

## GitHub Actions

`.github/workflows/ci.yml` läuft bei Pull Requests und Pushes auf `main`:

1. **Backend tests and build**: `npm ci`, Schutzprüfungen, Jest, Build, Supertest
   mit eigener PostgreSQL-Serviceinstanz.
2. **Frontend tests and build**: `npm ci`, Vitest, E2E-Typecheck, vue-tsc/Vite.
3. **Browser E2E**: eigene PostgreSQL-Serviceinstanz, Backend-Build, Playwright-
   Chromium installieren und beide Browserprojekte ausführen.

Die Jobs teilen keine Datenbank und brauchen keine Repository-Secrets.
Es wird `pull_request`, nicht `pull_request_target`, verwendet; Berechtigung ist
nur `contents: read`. Neuere Läufe desselben PRs ersetzen ältere.

Der HTML-Bericht wird als `playwright-results` sieben Tage gespeichert. Bei
fehlgeschlagenen Tests enthält das Artefakt außerdem Screenshots, Video und Trace.
CI erlaubt einen Retry; ein Retry beginnt erneut mit leerer DB. Ein Test, der erst beim Retry besteht, bleibt durch `failOnFlakyTests` in CI rot;
den Trace prüfen, statt instabile Tests als erfolgreich zu akzeptieren.

GitHub kann den ersten Lauf abhängig von den Actions-/Organisationsrichtlinien
zur Freigabe anhalten. Branch-Protection wird nicht automatisch verändert:
Nach einem grünen Lauf kannst du die drei Jobnamen als erforderliche Checks
für `main` konfigurieren.

## Grenzen dieses Blocks

Keine Authentifizierung/Nutzertrennung, kein Timer, keine PWA/Push-Meldungen.
Firefox/WebKit, echte Mobilgeräte und Deployment sind nicht Teil dieses ersten
Sicherheitsnetzes. Die vorhandene pg/TypeORM-Deprecation-Warnung kann in den
Backend-E2E-Tests weiterhin auftreten; sie wird hier nicht unterdrückt.
