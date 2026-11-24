#!/usr/bin/env bash
# Copies the processed focus sounds (sounds/*.ogg) to the server, into the
# folder compose.prod.yaml mounts read-only into the backend. The backend
# picks new files up on the next request; no restart needed.
#
#   scripts/sounds/upload.sh            host from $SOUNDS_SSH (default below)
#
# Uses your own SSH login (key-only on the server). Never put these files in
# git: ElevenLabs' terms forbid publishing them on their own.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
host="${SOUNDS_SSH:-jonas@plan.evolving-thoughts.com}"
dir="${SOUNDS_REMOTE_DIR:-habit-sounds}"

shopt -s nullglob
files=("$root"/sounds/*.ogg)
[ "${#files[@]}" -gt 0 ] || { echo "Keine Dateien in sounds/ (erst process.sh)." >&2; exit 1; }

ssh "$host" "mkdir -p '$dir' && chmod 755 '$dir'"
scp -q "${files[@]}" "$host:$dir/"
ssh "$host" "chmod 644 '$dir'/*.ogg && ls -l '$dir'"
