# Android-PWA über einen kostenlosen HTTPS-Tunnel testen

Dieser Schritt liefert eine installierbare **Online-PWA**, noch **keine Push-Meldungen** und keinen Android-Wecker. Der bestehende servergestützte Timer berechnet nach Rückkehr seine verbleibende Zeit; bei gesperrtem Handy wird JavaScript nicht zuverlässig ausgeführt. Eine Endbenachrichtigung ist ein separater nächster Schritt.

Das Repository bleibt privat. Es wird kein Hosting-Konto, keine Domain und keine Router-Portfreigabe benötigt. Cloudflare Quick Tunnel gibt dir eine temporäre, **öffentlich erreichbare** HTTPS-Adresse. Sie ist kein Passwortschutz: Anmeldung und exakter Origin schützen die API. Nur mit Testdaten verwenden, den Tunnel danach stoppen. Das ist eine Entwicklungs-Testlösung, kein produktives Deployment.

## Architektur

```text
Android / Chrome
  -> https://zufall.trycloudflare.com
  -> cloudflared auf deinem Windows-PC
  -> 127.0.0.1:4173 (gebautes Vue-Frontend)
       /api/* -> 127.0.0.1:3000 (NestJS, Pfad /api wird entfernt)
                    -> lokale PostgreSQL-Datenbank
```

Kein öffentliches Vite/HMR, kein offener Universal-Proxy, kein Zugriff auf PostgreSQL, Mailpit, Quelldateien oder `.env` über den Gateway. NestJS und der Gateway binden standardmäßig nur an `127.0.0.1`. Für einen späteren Containerbetrieb muss `HOST=0.0.0.0` bewusst konfiguriert werden.

## Voraussetzungen

- Der neue PR ist lokal ausgecheckt; Node-Version aus `.node-version` nutzen. Vor `npm ci` alte Frontend-/Vite-Prozesse stoppen, damit Windows keine Dateien in `node_modules` sperrt.
- PostgreSQL und Mailpit laufen wie bisher: im Projektverzeichnis `docker compose up -d --wait`. Die Compose-Portbindung für PostgreSQL ist jetzt ebenfalls auf `127.0.0.1` beschränkt. Compose kann dafür den Container neu erstellen; das vorhandene Datenvolume bleibt erhalten. Kein `down --volumes` ausführen.
- Bestehende `backend/.env` mit korrekten DB-/SMTP-Werten verwenden. **Keine DB-Löschung erforderlich.**
- `cloudflared` ist installiert. PowerShell nach der Installation neu öffnen und prüfen:

```powershell
cloudflared --version
```

Die folgenden drei Terminals bleiben während des Tests geöffnet. Alle Pfade beziehen sich auf dein Repository.

## 1. Frontend bauen und lokalen Gateway starten (Terminal A)

```powershell
cd C:\path\to\habit-tracker\frontend
npm ci
# Prozess-Variable überschreibt eine eventuell vorhandene direkte API-Adresse in .env.
$env:VITE_API_BASE_URL = "/api"
npm run build
# Falls eine alte Tunnel-Adresse noch in diesem Terminal gesetzt ist:
Remove-Item Env:TUNNEL_ORIGIN -ErrorAction SilentlyContinue
npm run serve:tunnel
```

Die App-Dateien liegen jetzt auf `http://127.0.0.1:4173`. Ohne laufendes Backend zeigt die App eine Verbindungsfehlermeldung; das ist in diesem Schritt erwartet. Ohne `TUNNEL_ORIGIN` akzeptiert der Gateway zunächst nur lokale Hostnamen.

## 2. HTTPS-Tunnel starten (Terminal B)

```powershell
cloudflared tunnel --url http://127.0.0.1:4173
```

Im Terminal erscheint eine Adresse wie `https://zufall.trycloudflare.com`. **Diese echte Adresse kopieren**, nicht die Beispieladresse verwenden. Den Tunnel ab jetzt laufen lassen.

Falls die Verbindung mit QUIC in deinem Netzwerk scheitert, kannst du nach Stoppen mit `Ctrl+C` alternativ versuchen:

```powershell
cloudflared tunnel --protocol http2 --url http://127.0.0.1:4173
```

Falls im Windows-Nutzerverzeichnis bereits eine cloudflared-Konfiguration existiert und Quick Tunnel nicht startet, diese nicht blind überschreiben: zuerst prüfen, ob sie für einen anderen Tunnel gebraucht wird.

## 3. Exakten öffentlichen Origin im Gateway erlauben (Terminal A)

Nur den Gateway mit `Ctrl+C` stoppen, **nicht** den Tunnel. Dann:

```powershell
$env:TUNNEL_ORIGIN = "https://DEINE-ECHTE-ADRESSE.trycloudflare.com"
npm run serve:tunnel
```

Kein abschließender `/`, kein Pfad. Der Gateway erlaubt diese Adresse zusätzlich zu seinem lokalen Host. Falls du die öffentliche Adresse vorher geöffnet hast und 403 siehst, jetzt neu laden.

## 4. Backend mit derselben Adresse starten (Terminal C)

Ein bisher laufendes Backend zuerst stoppen, damit nicht zwei Prozesse denselben Port belegen.

```powershell
cd C:\path\to\habit-tracker\backend
npm ci
$env:FRONTEND_URL = "https://DEINE-ECHTE-ADRESSE.trycloudflare.com"
$env:HOST = "127.0.0.1"
# NODE_ENV=development behalten; nicht nur für den Tunnel production setzen.
npm run start:dev
```

`FRONTEND_URL` und `TUNNEL_ORIGIN` müssen identisch sein. Prozess-Variablen überschreiben die `.env` nur in diesen Terminals; echte Zugangsdaten werden nicht committed. Bei anderer Backend-Portwahl muss `TUNNEL_API_PORT` im Gateway-Terminal denselben Port haben.

HTTPS im `FRONTEND_URL` aktiviert jetzt **Secure + HttpOnly + SameSite=Strict** für Login- und Logout-Cookies, auch im Entwicklungsmodus. Der Gateway erhält den Browser-Origin unverändert; CSRF-/JSON-Prüfungen werden **nicht** deaktiviert. Fremde Forwarding-Header werden nicht vertraut. Hinter diesem kleinen Test-Gateway teilen sich Auth-Requests den lokalen Socket-IP-Limiter; für viele Nutzer braucht ein späteres Deployment eine separat abgesicherte Proxy-/Rate-Limit-Konfiguration.

## 5. Auf Android testen und installieren

1. Die HTTPS-Adresse in **Chrome**, nicht einem Messenger-In-App-Browser, öffnen. Mobile Daten funktionieren ebenfalls; Handy und PC müssen nicht im selben WLAN sein.
2. Vorhandenes verifiziertes Konto nutzen oder registrieren. Neue Verifizierungs-/Reset-E-Mails landen weiterhin **nur in lokalem Mailpit** (`http://localhost:8025` auf dem PC), nicht im echten Postfach. Auf dem PC den Bestätigungslink öffnen und bestätigen; danach auf dem Handy anmelden. Mailpit selbst nicht öffentlich freigeben.
3. Chrome-Menü öffnen und **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“** wählen. Die Bezeichnung hängt von Chrome/Android ab; ein automatisches Installations-Popup wird nicht erzwungen.
4. App vom Startbildschirm öffnen: eigenständiges Fenster statt normalem Browser-Tab.
5. Todo/Habit erstellen, bearbeiten, neu starten und anmelden/abmelden prüfen. Optional zweites Konto zur Datentrennung testen.
6. Timer starten, Handy einige Zeit sperren, entsperren und App öffnen: verbleibende Zeit wird neu berechnet/synchronisiert. **Noch keine Benachrichtigung bei Timer-Ende erwarten.**

Browser-Tests prüfen Manifest/Icons, Service-Worker-Steuerung, reale Anmeldung/CRUD über `/api`, Cache-Schutz und Desktop/Pixel-7-Emulation. Installation ins echte Android-System und Verhalten unter echter Displaysperre bitte zusätzlich manuell testen; Emulation ersetzt das nicht.

## Online-only und Sicherheit

- Der Service Worker nutzt ausschließlich das Netzwerk. **Kein Cache Storage, kein IndexedDB-Datenspeicher, keine Offline-API-Queue, kein Precache.**
- Private API-Antworten tragen `Cache-Control: no-store`; der Worker fordert `/api` ohne HTTP-Cache an. Abmelden kann daher keine alten Antworten aus einem PWA-Cache zurückbringen.
- Nur öffentliche, versionierte JS-/CSS-Assets dürfen im normalen HTTP-Cache liegen. HTML, Manifest und Worker werden nicht HTTP-gecacht.
- Bei Netzausfall kann eine bereits offene Oberfläche zuletzt geladene Daten im Arbeitsspeicher zeigen; neue Requests/Speichern benötigen die Verbindung. Ein Offline-Neustart der App wird nicht unterstützt.
- Für Aktualisierungen Frontend neu bauen, Gateway neu starten und offene PWA-/Browser-Fenster schließen und neu öffnen. Es gibt kein erzwungenes Reload, das offene Formulare verliert.

## Tunnel beenden / zur lokalen Entwicklung zurückkehren

`Ctrl+C` im cloudflared-Terminal beendet den öffentlichen Zugriff. PC, Gateway, Backend, DB und Internet müssen während des Tests laufen. Nach einem neuen Quick-Tunnel-Start kann sich die Adresse ändern. Dann beide Origin-Variablen anpassen, Backend/Gateway neu starten und bei Bedarf die PWA für die neue Adresse neu installieren. Alte Mail-Links und Push-Abonnements eines späteren Blocks gelten nicht automatisch für den neuen Origin.

Für normale lokale Entwicklung am besten neue PowerShell-Terminals öffnen (dann sind die Tunnel-Prozessvariablen weg):

```powershell
# Backend: FRONTEND_URL in backend/.env wieder http://localhost:5173,
# falls du entgegen der Anleitung die Datei statt einer Prozessvariable geändert hast.
cd backend
npm run start:dev
# Separates Terminal im Repository:
cd frontend
npm run dev
```

Das Frontend nutzt standardmäßig `/api`; Vite proxyt im lokalen Development zu `127.0.0.1:3000`. Eine bisherige explizite `VITE_API_BASE_URL=http://localhost:3000` bleibt weiterhin möglich. Öffentlich aber ausschließlich den gebauten Gateway tunneln, nicht den Vite-Server.

## Kosten / Grenzen

Für diesen Quick-Tunnel-Test wird kein kostenpflichtiger Tarif eingerichtet. Der Tunnel ist temporär, ohne zugesicherte Verfügbarkeit und nicht für Dauerhosting gedacht. Dauerbetrieb auf VPS oder Raspberry Pi, stabile Domain, Backups, Produktionsmigrationen, echter SMTP-Versand und Push sind separate Schritte.
