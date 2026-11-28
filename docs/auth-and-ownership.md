# Anmeldung und Nutzertrennung

Dieser Entwicklungsblock ergänzt E-Mail/Passwort, Verifizierung, Passwort-Reset und Nutzertrennung. Keine externen Login-Anbieter und keine Übernahme alter Testdaten. Stoppuhr und Push-Meldungen kamen in späteren Blöcken dazu (siehe [Timer-Push](timer-push.md)).

## Lokal starten (PowerShell)

Die bisherigen Testdaten haben keinen Besitzer. Für diesen Entwicklungsstand ist ein einmaliger Neuaufbau vorgesehen, kein Backfill. **Der folgende Befehl löscht das PostgreSQL-Volume dieses Compose-Projekts einschließlich aller darin angelegten Datenbanken. Nur ausführen, wenn diese Daten wirklich weg dürfen.** Keine automatische Löschung beim App-Start.

```powershell
# Projektverzeichnis; Backend vorher stoppen
# OPTIONALER, DESTRUKTIVER Schritt für die bisherige Testdatenbank:
docker compose down --volumes

# .env im Projektverzeichnis unverändert aus der bisherigen Einrichtung nutzen.
# backend/.env um die SMTP-Werte aus backend/.env.example ergänzen.
docker compose up -d --wait

# Falls Backend-E2E lokal ebenfalls getestet werden sollen:
# Nutzername an POSTGRES_USER anpassen, falls er nicht habit_tracker lautet.
docker compose exec postgres createdb -U habit_tracker habit_tracker_test

cd backend
npm ci
npm run build
npm run start:dev
```

In einem zweiten Terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Frontend unter `http://localhost:5173`, Backend unter `http://localhost:3000`. Beide müssen denselben Hostnamen verwenden: nicht `localhost` und `127.0.0.1` mischen. `FRONTEND_URL` ist der exakte Frontend-Origin ohne abschließenden Slash. `VITE_API_BASE_URL` ist standardmäßig `/api` (gleicher Origin); Vite proxyt im Development zu `127.0.0.1:3000`. Alternativ kann die Frontend-`.env` die direkte Adresse setzen: `VITE_API_BASE_URL=http://localhost:3000`.

Mailpit: `http://localhost:8025`. Es fängt SMTP-E-Mails ab, verschickt aber keine echten E-Mails ins Internet. SMTP lokal: `127.0.0.1:1025`, ohne Benutzer/Passwort.

## Manuell prüfen

1. Konto mit E-Mail und Passwort (12–128 Zeichen) erstellen.
2. Vor Verifizierung ist Login gesperrt.
3. E-Mail in Mailpit öffnen, Bestätigungslink anklicken und explizit bestätigen. Link gilt 24 Stunden und ist einmalig. Danach anmelden.
4. Todo und Habit erstellen, neu laden, abmelden und als zweiter Nutzer anmelden: keine fremden Daten sichtbar.
5. Passwort vergessen anfordern, Reset-Link aus Mailpit öffnen, zweimal neues Passwort eingeben. Reset gilt 30 Minuten, ist einmalig und beendet alle alten Sessions, auch auf anderen Geräten.
6. E-Mail erneut anfordern: bisheriger gleichartiger Link wird ungültig. Ein Reset bestätigt keine unbestätigte E-Mail.
7. Abmelden beendet nur die aktuelle Geräte-Session. Sessions laufen maximal 30 Tage.

Links tragen Token im URL-Fragment, nicht im Querystring. Die App entfernt sie aus der sichtbaren URL und verbraucht sie erst nach einer ausdrücklichen Bestätigung, nicht durch einen GET oder E-Mail-Linkscanner.

## API

Öffentliche POST-Endpunkte (immer JSON und exakter `Origin`):

- `/auth/register` → 202, generische Registrierungsantwort
- `/auth/login` → 200, Nutzer und HttpOnly-Cookie; 401 bei falschen Zugangsdaten, 401 mit `code: "EMAIL_UNVERIFIED"`, wenn das Passwort stimmt, die E-Mail aber noch nicht bestätigt ist (nur dann bietet die Anmeldung "Bestätigung erneut senden" an)
- `/auth/verify-email` → 204
- `/auth/resend-verification` → 202
- `/auth/forgot-password` → 202
- `/auth/reset-password` → 204
- `/auth/logout` → 204, idempotent

Die Anmeldung zeigt nie den Text des Servers: `frontend/src/api/auth-errors.ts` übersetzt Status und Code jedes Auth-Aufrufs (400, 401, 403, 409, 429, 5xx, keine Verbindung) in einen Alltagssatz mit dem, was man tun kann.

`GET /auth/me` erfordert eine gültige, verifizierte Session. Alle Domain-Endpunkte sind standardmäßig geschützt. `GET /` bleibt ein datenfreier Health-/Hello-Endpunkt.

POST/PATCH/DELETE benötigen `Origin: http://localhost:5173` und `Content-Type: application/json`; in Postman diese Header ergänzen und Cookies nach Login behalten. Auch eine DELETE-Anfrage ohne Body benötigt den Header. CORS erlaubt nur den konfigurierten Frontend-Origin und Cookies.

## Sicherheitsentscheidungen

- Scrypt (N=32768, r=8, p=3) mit zufälligem Salt; keine Klartextpasswörter und keine Passwörter im Antwortobjekt.
- Session-/Link-Token: 32 zufällige Bytes; in PostgreSQL nur SHA-256-Hashes. Keine Tokens in Anwendungslogs.
- HttpOnly, SameSite=Strict; in Produktion Secure und `__Host-`-Cookie ohne Domain. Exakter Origin und JSON schützen auch den Login vor CSRF.
- Nutzer-ID stammt ausschließlich aus der Session. Erforderliche Besitzer-Fremdschlüssel für Todos/Habits; Zeitpläne/Ausführungen werden über das Habit autorisiert. Fremde IDs liefern 404.
- Jede Änderung an den Daten eines Nutzers läuft in `UserUnitOfWork.run` und sperrt zuerst seine Nutzerzeile, so laufen Änderungen verschiedener Geräte nacheinander. Lesende Abfragen, die oft kommen (Stoppuhr, Heute, Fokus-Sperre, Monats-Challenges, Lösch-Vorschau), laufen mit `UserUnitOfWork.read` ohne diese Sperre in einem schreibgeschützten `REPEATABLE READ`-Schnappschuss. Findet so eine Abfrage etwas zu speichern (eine abgelaufene Ausführung, eine vergessene Stoppuhr, eine abgelaufene Fokus-Sperre), entscheidet sie unter der Sperre neu und speichert erst dort. Heute, Plan und die Daily-Liste geben ihr ganzes Lesen an `HabitSchedulingService.answerAsOfNow`: Alles kommt aus dem Schnappschuss, der entschieden hat, mit genau einem `now`; muss etwas gespeichert werden, liest die Antwort in derselben Transaktion unter der Sperre, mit einem `now` von nach der Sperre. Auch `GET /todos/hierarchy` liest in einem Schnappschuss (`UserUnitOfWork.read`).
- Verifizierung/Reset/Resend/Login serialisieren auf dem Nutzer; Tokenverbrauch und Session-Widerruf sind atomar. Ein Login mit dem alten Passwort kann nicht parallel zum Reset eine neue Session erzeugen.
- PostgreSQL-basierte Limits pro Client-IP und normalisierter E-Mail (15-Minuten-Fenster): 30 Requests je Auth-Aktion/IP für Registrierung, Login, Verifizierung, Resend, Forgot und Reset; zusätzlich Login 10 je E-Mail, Registrierung/Resend/Forgot 3 je E-Mail. Verifizierung und Reset haben nur das IP-Limit, Logout hat kein Limit. Das überlebt Neustarts. Proxy-Header werden nur für die Zahl vertrauenswürdiger Hops in `TRUST_PROXY_HOPS` ausgewertet; Standard `0` = keinem Proxy vertrauen, dann zählt die Socket-IP.
- Forgot/Resend antworten gleich bei unbekannter Adresse oder SMTP-Ausfall. Bei fehlgeschlagenem Versand wird die Transaktion zurückgerollt; bisherige Links bleiben gültig. Nach Wiederherstellung von SMTP erneut anfordern. Versand ist synchron, keine persistente Outbox und keine automatische Zustellwiederholung. Gleichartige Antworten sind keine Garantie konstanter Antwortzeiten.

## Tests und CI

Backend-E2E verwenden eine isolierte Testdatenbank und einen Test-Mailer für Link-/Sicherheitsfälle. Die alten Domain-Tests verwenden echte Sessions, keinen deaktivierten Auth-Guard. Browser-E2E verwenden echten SMTP-Versand nach Mailpit, Verifizierung und Login; private Ansichten werden nicht gemockt.

```powershell
# Projektverzeichnis, separate Browser-Testdienste
docker compose -f compose.e2e.yaml up -d --wait
cd backend
npm ci
npm run build
cd ../frontend
npm ci
npx playwright install chromium
npm run typecheck:e2e
npm run test:e2e
# Nachher im Projektverzeichnis:
docker compose -f compose.e2e.yaml down
```

Browser-Test-Mailbox: `http://localhost:18025` (SMTP `11025`), nicht die Entwicklungs-Mailbox. Jeder Test setzt ausschließlich die isolierte Browser-Testdatenbank inklusive Auth-Tabellen zurück. Alle Testkonten/Passwörter sind künstliche Fixtures. Reports/Traces können diese Testdaten enthalten; echte Konten nie in diese Suite geben.

## Vor öffentlicher Bereitstellung

Dieser PR ist ein lokal getesteter Entwicklungsstand, kein vollständiger Produktions-Rollout. Das Schema entsteht inzwischen ausschließlich aus versionierten Migrationen (`backend/src/database/migrations/`, beim Start ausgeführt; kein `synchronize`). Vor Deployment: HTTPS mit same-site Frontend/API (am einfachsten gemeinsamer Origin mit Reverse Proxy), tatsächlicher SMTP-Anbieter und gültiger Absender, Zustellbarkeit/SPF/DKIM sowie Betrieb/Monitoring und Aufräumen abgelaufener Auth-Datensätze. Proxy-IP-Vertrauen nur explizit für die konkrete Infrastruktur konfigurieren (`TRUST_PROXY_HOPS`). Mailpit-Ports bleiben lokal gebunden und dürfen nicht öffentlich freigegeben werden.
