# Automatisches Deployment

Ist CI für einen Push auf `main` grün, startet [deploy.yml](../.github/workflows/deploy.yml). Der Workflow meldet sich per SSH auf dem Server an und schickt nur `deploy <commit>`. Auf dem Server führt [scripts/deploy.sh](../scripts/deploy.sh) dann genau diesen Commit aus:

1. Eine Sperre nehmen (`flock`), damit nur ein Deployment gleichzeitig läuft; ein zweites wartet bis zu 15 Minuten und bricht dann ab.
2. `git fetch`, prüfen, dass der Commit auf `origin/main` liegt und noch nicht läuft.
3. `git merge --ff-only` auf diesen Commit, nicht auf einen neueren, dessen CI noch läuft.
4. `docker compose … up -d --build --wait --remove-orphans`, danach eine Anfrage an `http://127.0.0.1:${APP_PORT}/` (`APP_PORT` aus `.env.production`, Standard 8080). Klappt beides, räumt `docker image prune -f` alte Images weg.
5. Startet der neue Stand nicht, setzt das Skript den Checkout auf den vorherigen Commit zurück und baut den wieder.

Ein Lauf dauert so lange wie ein Neubau, etwa drei Minuten; die App ist dabei kurz nicht erreichbar. Ein gescheitertes Deployment ist ein roter Lauf unter Actions, und GitHub schickt dazu eine Mail. Von Hand anstoßen lässt es sich unter Actions → Deploy → „Run workflow“.

## Sicherheit

Der Workflow nutzt einen eigenen Schlüssel, der in `~/.ssh/authorized_keys` mit `restrict` und einem erzwungenen Befehl steht. Wer den Schlüssel hat, kann damit nur `scripts/deploy.sh` auslösen und nur einen Commit, der schon auf `main` liegt: keine Shell, keine Weiterleitungen, keine anderen Befehle.

Der Benutzer `jonas` ist in der Gruppe `docker` und damit faktisch Administrator. Wer in `main` mergen darf, kann also beliebigen Code auf dem Server laufen lassen. Das war vorher schon so, weil jeder Merge beim nächsten Update gebaut wurde; jetzt passiert es nur sofort. Schreibrechte auf das Repo deshalb sparsam vergeben.

## Einrichten

Auf dem Server einen eigenen Schlüssel erzeugen:

```bash
ssh-keygen -t ed25519 -f ~/github-deploy -N "" -C "github-deploy habit-tracker"
```

Den öffentlichen Teil mit Einschränkung eintragen (eine Zeile):

```bash
echo "restrict,command=\"$HOME/habit-tracker/scripts/deploy.sh\" $(cat ~/github-deploy.pub)" >> ~/.ssh/authorized_keys
```

In GitHub unter Settings → Secrets and variables → Actions drei Repository-Secrets anlegen:

| Secret | Inhalt |
|---|---|
| `DEPLOY_SSH_KEY` | Inhalt von `~/github-deploy` (der private Schlüssel, alle Zeilen) |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan -t ed25519 <host>` |
| `DEPLOY_HOST` | Adresse des Servers |

Der Fingerabdruck in `DEPLOY_KNOWN_HOSTS` muss zu dem passen, den du beim ersten eigenen SSH-Login bestätigt hast (`ssh-keygen -lf` auf die Ausgabe zeigt ihn); nur die Zeile mit `ssh-ed25519 AAAA…` gehört ins Secret.

Beim privaten Schlüssel genau von `-----BEGIN OPENSSH PRIVATE KEY-----` bis `-----END OPENSSH PRIVATE KEY-----` kopieren. Meldet der Workflow „kein lesbarer privater Schlüssel“, fehlt meist eine dieser Zeilen oder ein Stück dazwischen. `\r` und Leerzeichen am Zeilenende räumt der Workflow selbst weg. Bevor du den Schlüssel löschst, kannst du ihn auf dem Server prüfen: `ssh-keygen -y -f ~/github-deploy` muss den öffentlichen Schlüssel ausgeben.

Danach den privaten Schlüssel vom Server löschen, er wird dort nicht gebraucht:

```bash
shred -u ~/github-deploy ~/github-deploy.pub
```

## Testen

Ohne GitHub, auf dem Server:

```bash
~/habit-tracker/scripts/deploy.sh "$(git -C ~/habit-tracker rev-parse origin/main)"
```

Über GitHub: Actions → Deploy → „Run workflow“ auf `main`.

## Grenzen

- Die Rückkehr zum vorherigen Stand setzt nur den Code zurück, nicht die Datenbank. Eine Migration, die erfolgreich lief, bleibt angewendet; scheitert sie, startet das Backend gar nicht erst und die Datenbank bleibt unverändert (siehe [betrieb.md](betrieb.md)).
- Port 22 bleibt für alle Adressen offen, weil GitHub-Runner wechselnde Adressen haben.
- Wird das Repo privat, braucht der Server zum `git fetch` einen Deploy-Key mit Lesezugriff, und der Checkout muss auf die SSH-Adresse umgestellt werden.
