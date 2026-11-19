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

## Migrationen

Das Backend führt offene Migrationen beim Start in einer Transaktion aus. Schlägt eine fehl, startet es nicht, und die Datenbank bleibt auf dem alten Stand.

## Aktualisieren

Nach jedem Merge in `main` mit grünem CI deployt GitHub selbst, siehe [deploy.md](deploy.md). Von Hand, etwa wenn GitHub nicht erreichbar ist, im Repo-Ordner:

```bash
git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build --wait
```

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
