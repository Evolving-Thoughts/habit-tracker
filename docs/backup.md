# Datenbank-Sicherung

[scripts/backup.sh](../scripts/backup.sh) sichert die Datenbank jede Nacht. Der Dump wird komprimiert und mit `age` verschlüsselt, bevor er auf die Platte kommt. Lokal löscht das Skript Sicherungen erst, wenn sie mehr als `KEEP_DAYS` ganze Tage alt sind (`find -mtime +$KEEP_DAYS`); mit dem Standard 14 bleiben sie also bis zu etwa 15 Tage liegen. Jede neue Sicherung wird auf den 1blu-Backup-Server (`backup.1blu.de`) hochgeladen, über FTP mit erzwungenem TLS, damit auch das Passwort nicht im Klartext übertragen wird.

Dort wird nichts gespiegelt und nichts nach dem lokalen Ordner gelöscht: Auf einem frisch aufgesetzten Server mit leerem Ordner würde ein Spiegeln sonst alle älteren Sicherungen auf dem Backup-Server entfernen, also genau im Ernstfall. Stattdessen räumt das Skript dort nach dem Datum im Dateinamen auf: Sicherungen, deren Datum im Dateinamen mehr als 14 Tage vor heute liegt, gehen (der Stichtag selbst bleibt, also ebenfalls rund 15 Tage); die neuesten sieben bleiben in jedem Fall liegen.

Der private Schlüssel zum Entschlüsseln liegt nur im Passwortmanager, nicht auf dem Server. Wer den Server übernimmt, kann die Sicherungen also nicht lesen. Wer den Schlüssel verliert, kann sie auch selbst nicht mehr lesen.

## Einrichten

Auf dem Server:

```bash
sudo apt install -y age lftp
```

Schlüsselpaar erzeugen:

```bash
age-keygen -o /tmp/habit-backup-key.txt
```

Die Ausgabe nennt den öffentlichen Schlüssel (`age1…`). Den gesamten Inhalt von `/tmp/habit-backup-key.txt` in den Passwortmanager legen, dann die Datei vom Server löschen:

```bash
cat /tmp/habit-backup-key.txt
shred -u /tmp/habit-backup-key.txt
```

Zugang zum Backup-Server: Im 1blu-Kundencenter unter „FTP Backup“ ein Passwort setzen (nur Buchstaben und Zahlen, sonst muss es für lftp maskiert werden). Dann die Konfiguration anlegen:

```bash
mkdir -p ~/.config
nano ~/.config/habit-backup.env
chmod 600 ~/.config/habit-backup.env
```

Inhalt:

```
AGE_RECIPIENT=age1…
FTP_HOST=backup.1blu.de
FTP_USER=bu123456
FTP_PASS='…'
NOTIFY_EMAIL=du@example.org
```

`FTP_USER` ist der Benutzername aus dem Kundencenter (`bu…`); er gehört nicht in dieses öffentliche Repo. Das Passwort in einfache Anführungszeichen setzen, weil die Datei als Shell gelesen wird und 1blu Sonderzeichen wie `%` verlangt.

Optional: `BACKUP_DIR` (Standard `~/backups`), `KEEP_DAYS` (Standard 14; lokal bleiben Dateien bis zu `KEEP_DAYS`+1 Tage, auf dem Backup-Server alle mit einem Datum ab heute minus `KEEP_DAYS`), `KEEP_MIN` (Standard 7, so viele Sicherungen bleiben auf dem Backup-Server immer liegen), `REMOTE_DIR` (Standard `habit-tracker`), `FTP_TLS` (Standard `force`; siehe Testlauf), `HEALTHCHECK_URL` (siehe Benachrichtigung).

## Benachrichtigung

Scheitert ein Lauf, schickt das Skript eine Mail an `NOTIFY_EMAIL` mit dem Grund und den letzten Fehlermeldungen. Es nutzt dafür dasselbe SMTP wie die App (`SMTP_*` und `MAIL_FROM` aus `.env.production`), braucht also kein eigenes Geheimnis. Ohne `NOTIFY_EMAIL` bleibt es still.

Einmal ausprobieren:

```bash
~/habit-tracker/scripts/backup.sh --test-notify
```

Eine Fehlermail kann nur kommen, wenn das Skript läuft. Ist der Server aus oder der Cron-Eintrag kaputt, merkt das niemand. Dafür gibt es Dienste wie [healthchecks.io](https://healthchecks.io), die sich melden, wenn ein erwartetes Lebenszeichen ausbleibt: dort einen Check mit Zeitraum 1 Tag und etwas Spielraum anlegen und dessen Ping-URL als `HEALTHCHECK_URL` eintragen. Das Skript pingt sie nach jedem erfolgreichen Lauf und meldet Fehler an `<url>/fail`.

## Testlauf

```bash
~/habit-tracker/scripts/backup.sh
```

Es muss eine Datei in `~/backups` entstehen und „Auf backup.1blu.de hochgeladen“ erscheinen.

`backup.1blu.de` spricht FTP über TLS (geprüft am 19.11.2026). Meldet der Lauf `530 Login authentication failed`, stimmen Benutzer oder Passwort nicht: Das Passwort gehört in den Block „FTP Backup“ im Kundencenter, nicht in den Block „Eigenes ISO-Image“, und gilt erst, wenn dort „Fertig“ steht.

Bricht der Lauf dagegen beim Verbinden mit einem TLS-Fehler ab, kann das ein Zertifikatsproblem sein (lftp prüft das Zertifikat) oder bedeuten, dass der Server kein TLS mehr anbietet. Dann ist die Sicherung zwar weiter verschlüsselt, aber das Passwort ginge im Klartext über die Leitung, und wer es mitliest, könnte die Sicherungen löschen. Erst bei 1blu nach FTPS oder SFTP fragen; nur wenn es keins gibt, `FTP_TLS=allow` in die Konfiguration setzen, dann schreibt jeder Lauf eine Warnung ins Log.

Ob die Datei auf dem Backup-Server liegt, zeigt (Benutzername einsetzen):

```bash
lftp -e "set ftp:ssl-force true; cls -l habit-tracker; quit" -u bu123456 backup.1blu.de
```

## Jede Nacht

```bash
crontab -e
```

```
0 3 * * * /home/jonas/habit-tracker/scripts/backup.sh >> /home/jonas/habit-backup.log 2>&1
```

Das Log liegt bewusst außerhalb von `~/backups`, damit es nicht mit hochgeladen wird. Bei einem Fehler kommt eine Mail (siehe Benachrichtigung); die Einzelheiten stehen in `tail ~/habit-backup.log`.

## Wiederherstellen

Die Datei vom Backup-Server oder aus `~/backups` nehmen und den privaten Schlüssel in eine Datei `key.txt` legen (danach wieder löschen). Dann:

```bash
age -d -i key.txt habit-2026-11-19_030001.sql.gz.age | gunzip \
  | docker compose -f compose.prod.yaml --env-file .env.production exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Der Dump enthält `DROP … IF EXISTS`, spielt also über die bestehenden Tabellen. Er beginnt mit `\restrict`; das versteht nur ein `psql` ab den aktuellen Versionen, deshalb immer das `psql` im Postgres-Container nehmen wie oben.

### Wiederherstellung testen

Ohne die laufende App anzufassen, in eine eigene Datenbank im selben Container (im Ordner `~/habit-tracker`, Schlüssel in `~/key.txt`):

```bash
C="docker compose -f compose.prod.yaml --env-file .env.production"
$C exec -T postgres sh -c 'createdb -U "$POSTGRES_USER" restore_test'
age -d -i ~/key.txt ~/backups/<datei>.sql.gz.age | gunzip \
  | $C exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d restore_test'
$C exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d restore_test -c "select count(*) from users"'
$C exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" restore_test'
shred -u ~/key.txt
```

Bricht `psql` nicht ab und stimmt die Zahl der Konten, ist die Sicherung brauchbar. Zuletzt am 19.11.2026 durchgespielt: alle 22 Tabellen und die Konten kamen zurück. Das lohnt sich nach größeren Änderungen am Schema und sonst etwa jedes Vierteljahr.

## Verbleibende Risiken

- Der Backup-Server gehört demselben Anbieter wie der Server. Ein Ausfall bei 1blu trifft beide. Wer das nicht will, ergänzt später ein zweites Ziel.
- Ohne `HEALTHCHECK_URL` fällt ein ausbleibender Lauf (Server aus, Cron kaputt) nicht auf; nur gescheiterte Läufe melden sich per Mail.
- Fällt das SMTP der App aus, kommt auch die Fehlermail nicht an.
