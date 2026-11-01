# Betrieb mit Docker Compose

Der Betrieb hängt an keinem bestimmten Rechner: Ein Umzug braucht nur Docker, diese Dateien, `.env.production` und eine Sicherung der Datenbank.

## Erster Start

```bash
cp .env.production.example .env.production
```

In `.env.production` mindestens `POSTGRES_PASSWORD`, `FRONTEND_URL` und die SMTP-Werte eintragen. Die Datei bleibt außerhalb von Git.

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --build --wait
```

Die App antwortet danach auf `http://127.0.0.1:8080`. Anmeldungen brauchen HTTPS, weil Sitzungs-Cookies in Produktion als `Secure` gesetzt werden. Von außen ist sie erst über den Tunnel erreichbar.

## Was erreichbar ist

Nur der Dienst `web` hat einen Port, und nur auf `127.0.0.1`. Datenbank und Backend sind ausschließlich im Compose-Netz. Mailpit gibt es hier nicht.

## Migrationen

Das Backend führt offene Migrationen beim Start in einer Transaktion aus. Schlägt eine fehl, startet es nicht, und die Datenbank bleibt auf dem alten Stand.

## Aktualisieren

```bash
git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build --wait
```

## Diagnose

```bash
docker compose -f compose.prod.yaml --env-file .env.production ps
```

```bash
docker compose -f compose.prod.yaml --env-file .env.production logs --tail 100 backend
```

## Wiederanlauf

Alle Dienste haben `restart: unless-stopped`. Geprüft: Ein abgestürztes Backend startet von selbst neu, und nach `down` und `up` sind die Daten noch da. Das Backend meldet seinen Zustand über den Docker-Healthcheck.

Damit das auch nach einem Neustart des Rechners gilt, muss Docker selbst automatisch starten. Unter Windows heißt das in Docker Desktop „Start Docker Desktop when you sign in“ plus eine automatische Anmeldung, auf einem Linux-Server `systemctl enable docker`.

## Verbleibende Risiken

- Ein Neustart des ganzen Rechners ist noch nicht auf dem endgültigen Server geprüft.
- Eine Anmeldung und der Mailversand im Compose-Betrieb brauchen HTTPS und echtes SMTP und sind erst mit dem Tunnel prüfbar.
- Ohne Backup-Ziel gibt es noch keine Sicherung außerhalb des Docker-Volumes.
