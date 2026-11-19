#!/usr/bin/env bash
# Datenbank-Sicherung für den Betrieb, siehe docs/backup.md.
# Dump -> gzip -> age-Verschlüsselung -> lokal behalten -> auf den Backup-Server hochladen.
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

# Backup-Server: hochladen ohne zu löschen, dann eigene Aufbewahrung.
# Kein "mirror --delete": Auf einem frisch aufgesetzten Server mit leerem
# Ordner würde der erste Lauf sonst alle älteren Sicherungen dort löschen.
KEEP_MIN="${KEEP_MIN:-7}"
case "${FTP_TLS:-force}" in
  force) TLS_SETTINGS='set ftp:ssl-force true
set ftp:ssl-protect-data true' ;;
  allow)
    echo "Warnung: FTP_TLS=allow, das Passwort kann unverschlüsselt übertragen werden." >&2
    TLS_SETTINGS='set ftp:ssl-allow true' ;;
  *) echo "FTP_TLS muss force oder allow sein." >&2; exit 1 ;;
esac

# Führt lftp-Befehle von stdin aus. Zugangsdaten gehen über stdin, damit sie
# nicht in der Prozessliste stehen.
remote() {
  { printf '%s\n' "$TLS_SETTINGS" \
      'set net:max-retries 3' 'set net:timeout 30' \
      "open -u $FTP_USER,$FTP_PASS $FTP_HOST"
    cat
  } | lftp -f /dev/stdin
}

remote <<EOF
mkdir -p -f $REMOTE_DIR
mirror -R --only-missing --exclude-glob '.*' --verbose=0 $BACKUP_DIR $REMOTE_DIR
quit
EOF
echo "Auf $FTP_HOST hochgeladen."

# Aufbewahrung dort nach dem Datum im Dateinamen, nicht nach der Uhr des
# Servers. Die neuesten KEEP_MIN Sicherungen bleiben in jedem Fall liegen.
CUTOFF="$(date -d "-$KEEP_DAYS days" +%Y-%m-%d)"
mapfile -t REMOTE_FILES < <(
  printf 'cls -1 %s/\nquit\n' "$REMOTE_DIR" | remote \
    | sed 's#.*/##' | grep -E '^habit-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}\.sql\.gz\.age$' | sort
)
OLD=()
COUNT="${#REMOTE_FILES[@]}"
for ((i = 0; i < COUNT - KEEP_MIN; i++)); do
  name="${REMOTE_FILES[$i]}"
  day="${name:6:10}"
  [[ "$day" < "$CUTOFF" ]] && OLD+=("$name")
done
if [ "${#OLD[@]}" -gt 0 ]; then
  { printf 'cd %s\n' "$REMOTE_DIR"; printf 'rm %s\n' "${OLD[@]}"; echo quit; } | remote
  echo "Auf $FTP_HOST ${#OLD[@]} alte Sicherung(en) entfernt."
fi
