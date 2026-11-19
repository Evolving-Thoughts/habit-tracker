#!/usr/bin/env bash
# Datenbank-Sicherung für den Betrieb, siehe docs/backup.md.
# Dump -> gzip -> age-Verschlüsselung -> lokal behalten -> auf den Backup-Server spiegeln.
# Der Klartext-Dump wird nie auf die Platte geschrieben.
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG="${BACKUP_CONFIG:-$HOME/.config/habit-backup.env}"
if [ ! -r "$CONFIG" ]; then
  echo "Konfiguration fehlt: $CONFIG" >&2
  exit 1
fi
# shellcheck disable=SC1090
. "$CONFIG"
: "${AGE_RECIPIENT:?AGE_RECIPIENT fehlt in $CONFIG}"
: "${FTP_HOST:?FTP_HOST fehlt in $CONFIG}"
: "${FTP_USER:?FTP_USER fehlt in $CONFIG}"
: "${FTP_PASS:?FTP_PASS fehlt in $CONFIG}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE_DIR="${REMOTE_DIR:-habit-tracker}"

COMPOSE=(docker compose -f compose.prod.yaml --env-file .env.production)
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="$BACKUP_DIR/habit-$STAMP.sql.gz.age"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Erst in eine Temp-Datei, damit nie eine halbe Sicherung unter dem endgültigen Namen liegt.
TMP="$(mktemp "$BACKUP_DIR/.habit-XXXXXX.part")"
trap 'rm -f "$TMP"' EXIT

"${COMPOSE[@]}" exec -T postgres \
  sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 \
  | age -r "$AGE_RECIPIENT" >"$TMP"

# Ein leerer oder winziger Dump heißt, dass etwas schiefging.
if [ "$(stat -c %s "$TMP")" -lt 1024 ]; then
  echo "Dump ist verdächtig klein, abgebrochen." >&2
  exit 1
fi
mv "$TMP" "$TARGET"
trap - EXIT
echo "Sicherung geschrieben: $TARGET ($(stat -c %s "$TARGET") Bytes)"

find "$BACKUP_DIR" -maxdepth 1 -name 'habit-*.sql.gz.age' -mtime +"$KEEP_DAYS" -delete

# Spiegelt den lokalen Ordner (mit seiner Aufbewahrung) auf den Backup-Server.
# Zugangsdaten gehen über stdin, damit sie nicht in der Prozessliste stehen.
lftp -f /dev/stdin <<EOF
set ftp:ssl-allow yes
set net:max-retries 3
set net:timeout 30
open -u $FTP_USER,$FTP_PASS $FTP_HOST
mkdir -p $REMOTE_DIR
mirror -R --delete --only-missing --exclude-glob '.*' --verbose=0 $BACKUP_DIR $REMOTE_DIR
quit
EOF
echo "Auf $FTP_HOST gespiegelt."
