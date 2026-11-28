# Live-Updates zwischen Geräten

Eine Änderung auf einem Gerät erscheint sofort in jeder anderen offenen App derselben Person, etwa eine Quest, die du am PC anlegst, während Heute auf dem Handy offen ist. Neu navigieren musst du dafür nicht.

## Weg

- `GET /live` (Backend `src/live/`) ist ein Server-Sent-Events-Strom hinter der Sitzung wie jede andere Route. Ohne Sitzung antwortet er mit 401.
- Nach jedem erfolgreichen Schreibzugriff einer angemeldeten Person (alles außer GET/HEAD/OPTIONS) sendet der Server an ihre offenen Ströme `event: changed`. Das übernimmt `LiveInterceptor` als globaler Interceptor. Ein fehlgeschlagener Schreibzugriff hat nichts geändert und meldet deshalb auch nichts.
- Die Meldung nennt nur den Ursprung (`data: {"origin": "<X-Client-Id>"}`), nie den Inhalt der Änderung. Die Apps lesen danach mit ihrer eigenen Sitzung neu, was sie zeigen.
- Auch der Kalender-Abgleich im Hintergrund (alle 5 Minuten) meldet sich nach jeder Person. So erscheint ein neuer Google-Termin ohne Neuladen.
- Alle 10 Sekunden schickt der Server einen Herzschlag (`: ping`). Das liegt unter den 60 s, die nginx standardmäßig wartet, und unter den 15 s des lokalen Tunnels (`scripts/tunnel-server.mjs`). `retry: 5000` lässt den Browser nach einem Abbruch von selbst neu verbinden.

## Frontend

- Jede Anfrage sendet `X-Client-Id` (`CLIENT_ID` in `api/http.ts`, eine Zufallskennung pro geöffneter App).
- `composables/live-sync.ts` (`startLiveSync`, gestartet in `TimerProvider.vue`, also nur angemeldet) öffnet `EventSource('/api/live')`.
  - Ein „changed“ von einer anderen App ruft `notifyDataChanged()` auf, denselben Kanal wie nach einem eigenen Schreibzugriff. Stoppuhr und offene Ansichten laden neu, eine im Hintergrund gehaltene (Heute hinter einem Tab) beim nächsten Zeigen.
  - Mehrere Meldungen innerhalb von 250 ms ergeben ein einziges Neuladen.
  - Ist die App verborgen, schließt sie die Verbindung. Beim Zurückkehren und nach jedem Wiederverbinden lädt sie einmal nach, weil sie in der Zwischenzeit nichts gehört hat.
- Ansichten laden nicht neu, solange ein Dialog offen ist oder ein eigener Schreibzugriff läuft (`useViewSession`, über `refreshOnChange` in `useLoader`). Eine Änderung, die in dieser Zeit eintrifft, merkt sich die Ansicht und lädt einmal nach, sobald sie wieder frei ist; so steht etwa ein im Editor geänderter Titel nach "Speichern" sofort in jeder Liste, auch auf einem anderen Tag in Heute. Lädt die Ansicht ohnehin selbst neu (nach ihrem eigenen Schreiben), entfällt das Nachladen. Komponenten einer Ansicht schreiben in deren Sitzung (`useParentSession`, von `useViewSession` bereitgestellt): Der Tageskalender und sein Dialog „Abschnitt korrigieren“/„Zeit nachtragen“ laden nach dem Speichern die Ansicht genau einmal neu, und solange der Dialog offen ist, hält er ihr Neuladen an.

## Betrieb

`frontend/nginx.conf` hat für `/api/live` einen eigenen Block: `proxy_buffering off` und ein langes `proxy_read_timeout`. `proxy_pass_header X-Accel-Buffering` reicht das `X-Accel-Buffering: no` des Backends weiter. Caddy davor (`betrieb.md`) gibt `text/event-stream` von sich aus sofort weiter und braucht keine Änderung. Der Strom läuft auf demselben Origin wie die App, CORS spielt also keine Rolle. Das gilt auch in der Android-App, die die Seite vom Server lädt.
