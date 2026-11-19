# Datenbank-Sicherung

[scripts/backup.sh](../scripts/backup.sh) sichert die Datenbank jede Nacht. Der Dump wird komprimiert und mit `age` verschlüsselt, bevor er auf die Platte kommt. Lokal bleiben die letzten 14 Tage, derselbe Ordner wird auf den 1blu-Backup-Server gespiegelt (`ftp://backup.1blu.de`). Die Kopie dort ist verschlüsselt, auch wenn FTP die Verbindung selbst nicht schützt.

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
FTP_USER=bu378196
FTP_PASS=…
```

Optional: `BACKUP_DIR` (Standard `~/backups`), `KEEP_DAYS` (Standard 14), `REMOTE_DIR` (Standard `habit-tracker`).

## Testlauf

```bash
~/habit-tracker/scripts/backup.sh
```

Es muss eine Datei in `~/backups` entstehen und „Auf backup.1blu.de gespiegelt“ erscheinen. Ob sie auf dem Backup-Server liegt, zeigt:

```bash
lftp -u bu378196 backup.1blu.de -e "cls -l habit-tracker; quit"
```

## Jede Nacht

```bash
crontab -e
```

```
0 3 * * * /home/jonas/habit-tracker/scripts/backup.sh >> /home/jonas/habit-backup.log 2>&1
```

Das Log liegt bewusst außerhalb von `~/backups`, damit es nicht mit gespiegelt wird. Es meldet sich niemand, wenn ein Lauf scheitert. Wirf deshalb gelegentlich einen Blick auf `tail ~/habit-backup.log` und auf das Datum der neuesten Datei.

## Wiederherstellen

Die Datei vom Backup-Server oder aus `~/backups` nehmen und den privaten Schlüssel in eine Datei `key.txt` legen (danach wieder löschen). Dann:

```bash
age -d -i key.txt habit-2026-11-19_030001.sql.gz.age | gunzip \
  | docker compose -f compose.prod.yaml --env-file .env.production exec -T postgres \
    sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Der Dump enthält `DROP … IF EXISTS`, spielt also über die bestehenden Tabellen. Probiere die Wiederherstellung einmal an einer Kopie durch, bevor du sie im Ernstfall brauchst.

## Verbleibende Risiken

- Der Backup-Server gehört demselben Anbieter wie der Server. Ein Ausfall bei 1blu trifft beide. Wer das nicht will, ergänzt später ein zweites Ziel.
- Ein gescheiterter Lauf erzeugt keine Benachrichtigung.
