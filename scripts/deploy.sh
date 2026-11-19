#!/usr/bin/env bash
# Deployment auf dem Server, siehe docs/deploy.md.
# Läuft als erzwungener Befehl des Deploy-Schlüssels: GitHub schickt "deploy <commit>",
# nichts anderes wird ausgeführt. Von Hand: scripts/deploy.sh <commit>
#
# Holt genau den übergebenen Commit (muss auf origin/main liegen), baut neu und
# wartet auf gesunde Container. Scheitert das, geht es auf den vorherigen Stand zurück.
set -Eeuo pipefail

main() {
  cd "$(dirname "$0")/.."

  # Bei Aufruf über SSH steht der Wunsch in SSH_ORIGINAL_COMMAND, sonst in $1.
  local request="${SSH_ORIGINAL_COMMAND:-deploy ${1:-}}"
  local sha
  if [[ "$request" =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
    sha="${BASH_REMATCH[1]}"
  else
    echo "Erwartet: deploy <40-stelliger Commit-Hash>" >&2
    exit 2
  fi

  # Immer nur ein Deployment gleichzeitig.
  exec 9>"${TMPDIR:-/tmp}/habit-deploy.lock"
  flock -w 900 9 || { echo "Ein anderes Deployment läuft noch." >&2; exit 1; }

  local compose=(docker compose -f compose.prod.yaml --env-file .env.production)

  git fetch --quiet origin main
  if ! git merge-base --is-ancestor "$sha" origin/main 2>/dev/null; then
    echo "$sha liegt nicht auf origin/main, abgebrochen." >&2
    exit 1
  fi
  if git merge-base --is-ancestor "$sha" HEAD; then
    echo "$sha (oder neuer) läuft bereits, nichts zu tun."
    exit 0
  fi

  local prev
  prev="$(git rev-parse HEAD)"
  echo "Deploy ${sha:0:7} (vorher ${prev:0:7})"

  if ! git merge --quiet --ff-only "$sha"; then
    echo "Kein Fast-Forward möglich: lokale Änderungen im Checkout? Abgebrochen." >&2
    exit 1
  fi

  if "${compose[@]}" up -d --build --wait --remove-orphans && curl -fsS -o /dev/null -m 10 http://127.0.0.1:8080/; then
    docker image prune -f >/dev/null
    echo "Läuft: $(git log -1 --format='%h %s')"
    return 0
  fi

  echo "Neuer Stand startet nicht, zurück auf ${prev:0:7}." >&2
  git reset --quiet --hard "$prev"
  if "${compose[@]}" up -d --build --wait --remove-orphans; then
    echo "Vorheriger Stand ${prev:0:7} läuft wieder." >&2
  else
    echo "Auch der vorherige Stand startet nicht. Bitte von Hand prüfen." >&2
  fi
  exit 1
}

# main in einem Stück einlesen, bevor etwas läuft: git ersetzt diese Datei
# während des Deployments, und bash liest Skripte sonst zeilenweise nach.
main "$@"
exit
