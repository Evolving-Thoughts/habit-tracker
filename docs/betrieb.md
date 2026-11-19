# Betrieb

Die App läuft mit Docker Compose. Der Betrieb hängt an keinem bestimmten Rechner: Ein Umzug braucht nur Docker, dieses Repo, `.env.production`, einen Reverse-Proxy mit HTTPS und eine Sicherung der Datenbank.

## Aufbau

```
Browser ─HTTPS─> Caddy (Host, Port 443) ─> nginx im Container web (127.0.0.1:8080) ─> backend ─> postgres
```

- **Caddy** auf dem Host holt und erneuert das Zertifikat selbst und leitet an `127.0.0.1:8080` weiter. Weitere Projekte bekommen dort eigene Subdomains.
- **nginx** im Container `web` liefert das Frontend aus und leitet `/api/` an das Backend. HTTP/2 ist dort bewusst nicht aktiv.
- Nur `web` hat einen Port, und nur auf `127.0.0.1`. Backend und Datenbank sind ausschließlich im Compose-Netz.
- Mails gehen über einen SMTP-Dienst mit TLS (derzeit Resend, Sende-Domain `send.evolving-thoughts.com`).

Derzeit läuft das auf einem 1blu-VPS (KVM, Ubuntu 24.04) unter `https://plan.evolving-thoughts.com`; der DNS-Eintrag liegt bei Porkbun.

## Server vorbereiten

Auf einem frischen Ubuntu-Server, als normaler Benutzer mit `sudo`:

- Anmeldung nur per SSH-Schlüssel: `PasswordAuthentication no` und `PermitRootLogin no` in einer Datei, die vor `50-cloud-init.conf` gelesen wird, etwa `/etc/ssh/sshd_config.d/00-hardening.conf`. Bei sshd gilt der erste Wert; `sudo sshd -T | grep -i passwordauth` zeigt, was wirklich gilt.
- Firewall: `ufw allow OpenSSH`, `ufw allow 80`, `ufw allow 443`, `ufw enable`.
- Docker über `curl -fsSL https://get.docker.com | sudo sh`, den Benutzer in die Gruppe `docker` aufnehmen. Das Skript richtet Docker so ein, dass es beim Booten startet.
- Caddy über `sudo apt install caddy`.
- Eine Fernkonsole des Anbieters (bei 1blu VNC) nach der Einrichtung wieder abschalten.

## Erster Start

```bash
git clone https://github.com/Evolving-Thoughts/habit-tracker.git
cd habit-tracker
cp .env.production.example .env.production
chmod 600 .env.production
```

In `.env.production` mindestens eintragen:

- `POSTGRES_PASSWORD` (etwa `openssl rand -hex 24`)
- `FRONTEND_URL`: die exakte HTTPS-Adresse ohne Schrägstrich am Ende. Das Backend lehnt schreibende Anfragen ab, deren `Origin` nicht genau so lautet („Ungültiger Request-Ursprung“).
- `TRUST_PROXY_HOPS=2`: Caddy und nginx stehen vor dem Backend. Mit 1 hielte das Backend die Adresse von Caddy für die des Browsers, und die Login-Begrenzung würde für alle Nutzer gemeinsam zählen.
- die `SMTP_*`-Werte und `MAIL_FROM`

Die Datei bleibt außerhalb von Git und liegt im Repo-Ordner, nicht im Home-Verzeichnis: Compose liest sie relativ zum aktuellen Ordner.

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --build --wait
```

Dann Caddy auf die App zeigen lassen, in `/etc/caddy/Caddyfile`:

```
plan.evolving-thoughts.com {
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

Das Zertifikat kommt beim ersten Aufruf, wenn der DNS-Eintrag schon auf den Server zeigt und Port 80 und 443 offen sind. Anmeldungen funktionieren nur über HTTPS, weil die Sitzungs-Cookies in Produktion `Secure` sind.

Danach die Sicherung nach [backup.md](backup.md) und das automatische Deployment nach [deploy.md](deploy.md) einrichten.

## Optionale Dienste

Beide laufen ohne Neubau: Werte in `.env.production` setzen, dann das Backend neu anlegen (siehe Aktualisieren). Die Befehle gehören in den Repo-Ordner und schreiben Geheimnisse direkt in die Datei, ohne sie anzuzeigen.

### Timer-Push

Die VAPID-Schlüssel einmal im laufenden Backend erzeugen:

```bash
sed -i '/^VAPID_PUBLIC_KEY=/d;/^VAPID_PRIVATE_KEY=/d' .env.production
docker compose -f compose.prod.yaml --env-file .env.production exec -T backend node -e "const k=require('web-push').generateVAPIDKeys();console.log('VAPID_PUBLIC_KEY='+k.publicKey);console.log('VAPID_PRIVATE_KEY='+k.privateKey)" >> .env.production
grep -c -E '^VAPID_(PUBLIC|PRIVATE)_KEY=.+' .env.production   # muss 2 ergeben
```

`VAPID_SUBJECT` darf leer bleiben, dann gilt `FRONTEND_URL`. Neue Schlüssel machen alle bestehenden Push-Anmeldungen ungültig, also nicht bei jedem Umzug neu erzeugen, sondern die Zeilen mitnehmen. Ein ungültiges Paar lässt das Backend gar nicht erst starten. Bedienung und Grenzen: [timer-push.md](timer-push.md).

### Google Kalender

Jede App bekommt ein eigenes Projekt in der Google Cloud Console, weil Zustimmungsbildschirm, Berechtigungen und Veröffentlichungsstatus pro Projekt gelten. Für diese App heißt es `plan-evolving-thoughts`; das Projekt für die lokale Entwicklung bleibt getrennt.

Im Projekt: Google Calendar API aktivieren, in der Google Auth Platform unter Branding App-Name, Support-Adresse und die autorisierte Domain `evolving-thoughts.com` eintragen, Zielgruppe „Extern“, unter Data access diese Berechtigungen (dieselben wie in `backend/src/calendar/google-calendar.client.ts`):

```
https://www.googleapis.com/auth/calendar.app.created
https://www.googleapis.com/auth/calendar.events.readonly
https://www.googleapis.com/auth/calendar.calendarlist.readonly
```

Dann einen Client vom Typ Webanwendung mit genau dieser Weiterleitungs-URI anlegen:

```
https://plan.evolving-thoughts.com/api/calendar/google/callback
```

Die Client ID ist öffentlich, der Client secret nicht. Auf dem Server:

```bash
sed -i '/^GOOGLE_/d' .env.production
printf 'GOOGLE_REDIRECT_URI=%s\nGOOGLE_TOKEN_KEY=%s\n' "https://plan.evolving-thoughts.com/api/calendar/google/callback" "$(openssl rand -base64 32)" >> .env.production
nano .env.production   # GOOGLE_CLIENT_ID=… und GOOGLE_CLIENT_SECRET=… ergänzen
grep -c -E '^GOOGLE_(CLIENT_ID|CLIENT_SECRET|REDIRECT_URI|TOKEN_KEY)=.+' .env.production   # muss 4 ergeben
```

`GOOGLE_TOKEN_KEY` verschlüsselt die gespeicherten Google-Zugriffe und muss genau 32 Byte haben (`… | base64 -d | wc -c`). Ändert er sich, müssen alle ihren Kalender neu verbinden.

Die Google-App steht im Status „Testing“: Nur unter Audience eingetragene Testnutzer können ihren Kalender verbinden, und jede Verbindung läuft 7 Tage nach dem Verbinden ab. Veröffentlichen („Publish app“) verlangt einen Link zu einer Datenschutzerklärung unter Branding; danach einmal neu verbinden, Client und Serverwerte bleiben gleich. Nutzer sehen dann einmalig den Hinweis, dass Google die App nicht geprüft hat.

## Migrationen

Das Backend führt offene Migrationen beim Start in einer Transaktion aus. Schlägt eine fehl, startet es nicht, und die Datenbank bleibt auf dem alten Stand.

## Aktualisieren

Nach jedem Merge in `main` mit grünem CI deployt GitHub selbst, siehe [deploy.md](deploy.md). Von Hand, etwa wenn GitHub nicht erreichbar ist, im Repo-Ordner:

```bash
git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build --wait
```

Updates von Paketen, Basis-Images und Actions schlägt Dependabot jede Woche gebündelt als PR vor ([dependabot.yml](../.github/dependabot.yml)). Mit grünem CI gemergt, landen sie wie jeder andere Merge auf dem Server. `npm audit --omit=dev` in `backend` und `frontend` zeigt, ob etwas, das ausgeliefert wird, eine bekannte Lücke hat.

Eine geänderte `.env.production` übernimmt ein Container erst, wenn er neu angelegt wird:

```bash
docker compose -f compose.prod.yaml --env-file .env.production up -d --force-recreate backend
```

## Diagnose

```bash
docker compose -f compose.prod.yaml --env-file .env.production ps
docker compose -f compose.prod.yaml --env-file .env.production logs --tail 100 backend
docker compose -f compose.prod.yaml --env-file .env.production exec backend printenv FRONTEND_URL
sudo journalctl -u caddy -n 50 --no-pager
```

## Wiederanlauf

Alle Dienste haben `restart: unless-stopped`. Geprüft am 19.11.2026 auf dem 1blu-Server: Nach `sudo reboot` kommen Caddy, Docker und alle Container von selbst wieder hoch, und die Daten sind noch da.

## Verbleibende Risiken

- Die Datenbank wird nachts gesichert und auf einen Backup-Server hochgeladen, siehe [backup.md](backup.md). Die Wiederherstellung wurde am 19.11.2026 an einer eigenen Test-Datenbank durchgespielt. Ein gescheiterter Lauf schickt eine Mail; ein ausbleibender fällt nur mit einem Überwachungsdienst auf.
- Backup-Server und Server gehören demselben Anbieter.
- Ein Deployment baut auf dem Server neu; die App ist dabei kurz nicht erreichbar.
- Die Google-Kalender-Verbindung muss im Status „Testing“ jede Woche neu hergestellt werden.
- `.env.production` liegt nur auf dem Server. Datenbankpasswort, SMTP-Schlüssel und Google-Client stehen zusätzlich im Passwortmanager; VAPID-Schlüssel und `GOOGLE_TOKEN_KEY` nicht, gehen sie verloren, müssen Push und Kalender neu eingerichtet werden.
