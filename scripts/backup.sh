#!/usr/bin/env bash
# Datenbank-Sicherung für den Betrieb, siehe docs/backup.md.
# Dump -> gzip -> age-Verschlüsselung -> lokal behalten -> auf den Backup-Server hochladen.
# Der Klartext-Dump wird nie auf die Platte geschrieben.
# Scheitert ein Lauf, geht eine Mail an NOTIFY_EMAIL (über das SMTP der App).
#
#   scripts/backup.sh                 sichern
#   scripts/backup.sh --test-notify   nur eine Testmail schicken
set -Eeuo pipefail

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
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"

# Liest einen Wert aus .env.production, ohne die Datei als Shell auszuführen
# (MAIL_FROM enthält Leerzeichen und spitze Klammern).
env_get() {
  sed -n "s/^$1=//p" .env.production | tail -n 1 | sed -e "s/^['\"]//" -e "s/['\"]\$//"
}

# Schickt stdin als Textmail an NOTIFY_EMAIL, über dasselbe SMTP wie die App.
# Die SMTP-Zugangsdaten gehen über eine curl-Konfiguration, nicht über die Prozessliste.
send_mail() {
  [ -n "$NOTIFY_EMAIL" ] || return 0
  local host port from addr scheme=smtp
  host="$(env_get SMTP_HOST)"
  port="$(env_get SMTP_PORT)"
  from="$(env_get MAIL_FROM)"
  addr="$(printf '%s' "$from" | sed -n 's/.*<\([^>]*\)>.*/\1/p')"
  [ -n "$addr" ] || addr="$from"
  if [ "$(env_get SMTP_SECURE)" = true ]; then scheme=smtps; fi
  {
    printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\n' \
      "$from" "$NOTIFY_EMAIL" "$1" "$(date -R)"
    printf 'MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n'
    sed 's/$/\r/'
  } | curl --silent --show-error --max-time 30 --ssl-reqd \
    --url "$scheme://$host:${port:-587}" \
    --mail-from "$addr" --mail-rcpt "$NOTIFY_EMAIL" \
    --config <(printf 'user = "%s:%s"\n' "$(env_get SMTP_USER)" "$(env_get SMTP_PASSWORD)") \
    --upload-file -
}

if [ "${1:-}" = "--test-notify" ]; then
  : "${NOTIFY_EMAIL:?NOTIFY_EMAIL fehlt in $CONFIG}"
  echo "Testmail vom Backup auf $(hostname). Kommt sie an, erreichen dich auch Fehlermeldungen." \
    | send_mail "Backup-Test von $(hostname)"
  echo "Testmail an $NOTIFY_EMAIL gesendet."
  exit 0
fi

TMP=""
FAILED_AT=""
ERRLOG="$(mktemp)"
# Fehlerausgaben zusätzlich mitschneiden, damit die Mail den Grund nennt.
exec 2> >(tee -a "$ERRLOG" >&2)
trap 'FAILED_AT="Zeile $LINENO: $BASH_COMMAND"' ERR

report_failure() {
  if [ -n "$HEALTHCHECK_URL" ]; then
    curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL/fail" >/dev/null || true
  fi
  {
    echo "Die Datenbanksicherung auf $(hostname) ist fehlgeschlagen (Exit-Code $1)."
    if [ -n "$FAILED_AT" ]; then echo "Abgebrochen bei $FAILED_AT"; fi
    echo
    echo "Letzte Fehlermeldungen:"
    tail -n 20 "$ERRLOG" 2>/dev/null || true
    echo
    echo "Log auf dem Server: ~/habit-backup.log. Hilfe: docs/backup.md im Repo."
  } | send_mail "Backup fehlgeschlagen auf $(hostname)"
}

on_exit() {
  local status=$?
  trap - ERR
  if [ -n "$TMP" ]; then rm -f "$TMP"; fi
  if [ "$status" -ne 0 ]; then
    report_failure "$status" || echo "Fehlermail konnte nicht gesendet werden." >&2
  fi
  rm -f "$ERRLOG"
  exit "$status"
}
trap on_exit EXIT

COMPOSE=(docker compose -f compose.prod.yaml --env-file .env.production)
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="$BACKUP_DIR/habit-$STAMP.sql.gz.age"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Erst in eine Temp-Datei, damit nie eine halbe Sicherung unter dem endgültigen Namen liegt.
TMP="$(mktemp "$BACKUP_DIR/.habit-XXXXXX.part")"

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
TMP=""
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

# Lebenszeichen für einen Überwachungsdienst: Bleibt es aus, meldet der sich,
# auch wenn das Skript gar nicht erst startet.
if [ -n "$HEALTHCHECK_URL" ]; then
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" >/dev/null || echo "Healthcheck-Ping fehlgeschlagen." >&2
fi
