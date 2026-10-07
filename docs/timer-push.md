# Timer-Push auf Android testen

Timer-Ende kann jetzt auch bei geschlossener PWA oder gesperrtem Bildschirm gemeldet werden. **Web Push ist kein präziser Android-Wecker**: Netzwerk, Doze, Chrome, Android-Benachrichtigungseinstellungen und der Push-Anbieter können die Zustellung verzögern oder verhindern. Wenige Sekunden sind ein Testziel, keine Zusicherung.

## Verhalten

- Ein Timer pro Nutzer wie bisher. Todos und konkrete Habit-Ausführungen werden unterstützt.
- Meldungen an alle **angemeldeten Geräte/Browser mit ausdrücklich aktiviertem Push**. Andere Nutzer erhalten keine Meldung.
- Nachricht immer neutral: **„Dein Timer ist abgelaufen“**, dazu „Öffne die App, um fortzufahren.“ Keine Aufgaben-/Habit-Titel, E-Mails oder Nutzerinformationen im Payload.
- Antippen öffnet die App oder fokussiert ein bereits offenes App-Fenster, ohne dessen Formular zu verwerfen. Es markiert nichts als erledigt.
- Opt-in ist pro Origin und Browserprofil. Keine automatische Berechtigungsanfrage bei Login/Seitenaufruf.
- Nach Logout wird die Session samt Gerätezuordnung und ausstehenden Lieferungen serverseitig entfernt. Die Browser-Erlaubnis und lokale Opt-in-Einstellung bleiben bestehen. Bei erneutem Login wird ein weiterhin aktiviertes Gerät ohne erneuten Prompt zugeordnet.
- „Push deaktivieren“ speichert zuerst das lokale Opt-out und entfernt danach die Serverzuordnung sowie das Browser-Abonnement. Es bleibt auch nach Login deaktiviert. Bei Netzausfall bleibt das Opt-out gespeichert; „Erneut prüfen“/nächster Login versucht die Serverbereinigung erneut.
- Browser-Erlaubnis bleibt durch Deaktivieren bestehen. Nur der Nutzer kann sie in den Website-/Browser-Einstellungen widerrufen. Ein widerrufener Zustand wird nicht automatisch erneut angefragt.

**Bereits unterwegs befindliche Meldungen lassen sich nicht zuverlässig zurückholen.** Der Worker prüft lokale Einstellung, Abonnement-ID, Session und Timer vor Anzeige erneut. Er zeigt bei fehlender Bestätigung keine App-Meldung. Chrome kann bei einem empfangenen Push ohne sichtbare App-Meldung dennoch eine eigene generische Systemmeldung erzeugen. Auch deshalb kann vollständige Unterdrückung bereits übergebener Pushes nicht versprochen werden. Inhalte bleiben neutral.

## Voraussetzungen

Die gebaute PWA und der HTTPS-Tunnel funktionieren bereits. Weiterhin gilt [PWA-/Tunnel-Anleitung](pwa-and-tunnel.md): Frontend/Gateway, Backend, PostgreSQL und PC-Internet müssen laufen. **Keine Datenbank-Löschung nötig.** Im Entwicklungsmodus entstehen die neuen Tabellen/nullable Timer-Spalte über das bisherige TypeORM-Synchronize. Für Produktion werden explizite Migrationen benötigt; dieses PR liefert kein automatisches Produktionsschema-Upgrade.

Initial unterstützt: Chrome/Chromium mit FCM und Firefox mit Mozilla Push. Andere Provider, etwa Safari/Apple oder Windows-WNS, sind bewusst nicht freigegeben. Der Server akzeptiert keine beliebigen Push-Ziel-URLs, internen Hosts oder Proxy-Ziele.

## 1. Einmalig Schlüssel erzeugen

Im Repository, Backend-Unterordner:

```powershell
cd backend
npm ci
npm run push:keys
```

Das erzeugt lokal ein neues VAPID-Schlüsselpaar und zeigt zwei `.env`-Zeilen. **Die echte private Zeile weder committen noch in Chat, PR, Screenshot oder Logs teilen.** Die Werte nur in `backend/.env` übernehmen:

```dotenv
# Hier lokal die erzeugten Werte einsetzen. Keine echten Werte ins Repository.
VAPID_PUBLIC_KEY=DEIN_LOKAL_ERZEUGTER_PUBLIC_KEY
VAPID_PRIVATE_KEY=DEIN_LOKAL_ERZEUGTER_PRIVATE_KEY
PUSH_WORKER_ENABLED=true
```

Nicht bei jedem Start neu erzeugen. Browser-Abonnements sind an den öffentlichen Schlüssel gebunden. Eine bewusst vorgenommene Schlüsselrotation erfordert erneute Abonnement-Erstellung; vorhandene Browser-Erlaubnis kann erhalten bleiben.

`VAPID_SUBJECT` ist optional und nutzt standardmäßig den **HTTPS**-`FRONTEND_URL`. Falls du später wieder einen HTTP-Localhost als Frontend konfigurierst und die Schlüssel behalten möchtest, setze in `.env` einen HTTPS-Kontakt-URI ausdrücklich. Eine E-Mail-Adresse ist dafür nicht nötig. Kein persönlicher Kontaktwert ist im Repository vorgegeben. Ungültige/halb ausgefüllte Schlüssel oder ungültige Subject-Konfiguration werden beim Backend-Start mit einer neutralen Fehlermeldung abgelehnt, ohne Schlüsselwerte zu loggen.

## 2. Prozesse neu starten

- Backend stoppen und mit der aktuellen HTTPS-Tunnel-Adresse als `FRONTEND_URL` neu starten, wie in der Tunnel-Anleitung. Schlüssel werden beim Start gelesen.
- Im Frontend neue Abhängigkeiten installieren, mit `VITE_API_BASE_URL=/api` bauen und den Gateway starten.
- Die bestehende `TUNNEL_ORIGIN`-Konfiguration beibehalten. Nur bei geändertem Tunnel-Origin beide Origin-Variablen anpassen.
- Auf dem Handy neue App-Version laden. Die Aktivierung aktualisiert bei Bedarf den Push-fähigen Worker; bei Problemen alle App-/Website-Fenster schließen und erneut öffnen. Die App/API werden weiterhin nicht offline gecacht.

Ohne VAPID-Schlüssel funktioniert die normale App weiterhin. In „Benachrichtigungen“ steht dann, dass der Server noch nicht eingerichtet ist.

## 3. Push ausdrücklich aktivieren

1. In Chrome/PWA anmelden.
2. Navigation **„Benachrichtigungen“** öffnen.
3. **„Push aktivieren“** anklicken und die Browser-/Android-Anfrage erlauben.
4. Status **„Auf diesem Gerät aktiviert“** prüfen.
5. Optional auf dem PC ebenfalls aktivieren: beide Geräte sollen dann eine neutrale Meldung erhalten.

Wenn der Browser blockiert ist, zeigt die App einen Hinweis auf Website-Einstellungen. In Android auch prüfen, ob Benachrichtigungen für Chrome/die installierte Web-App systemweit erlaubt sind und nicht durch Nicht-stören unterdrückt werden. Eine erteilte Website-Erlaubnis garantiert keine sichtbare Systemmeldung.

## 4. Manueller Testplan

Für einen schnellen Test einen Todo-Timer mit einer Minute starten. Die App bleibt servergestützt; nicht erst am Handy öffnen/pollen, damit der Server das Ende erkennt.

- **Sperrbildschirm:** Direkt nach Start das Handy sperren. Zeitpunkt der geplanten und sichtbaren Meldung vergleichen. Erst entsperren, nachdem du auf die Meldung gewartet hast.
- **Geschlossene PWA:** Wiederholen, nachdem du das App-Fenster geschlossen hast. Chrome/Android nicht „Stopp erzwingen“; das kann Push vollständig verhindern.
- **PC + Handy:** Beide anmelden und Push aktivieren. Timer am PC starten, Handy sperren. Beide aktivierten Geräte sollten genau eine sichtbare Timer-Meldung erhalten.
- **Pause/Resume:** Vor Ablauf pausieren: keine Endmeldung. Später fortsetzen: neue Deadline gilt.
- **Dauer ändern/Wechsel/Stop:** Bei pausiertem Timer Dauer ändern oder Timer wechseln/stoppen: keine Meldung zur alten Deadline.
- **Ziel erledigen/überspringen/pausieren/löschen:** Kein Versand für ein bereits ungültiges Todo/Habit-Ziel; bereits übergebene Nachrichten siehe Einschränkung oben.
- **Logout:** Auf einem Gerät abmelden, Timer auf dem anderen starten: das ausgeloggte Gerät bekommt keine neu versandte Meldung. Danach wieder anmelden: optiertes Gerät wird automatisch neu zugeordnet.
- **Explizites Opt-out:** Push deaktivieren, aus-/einloggen und neu laden: deaktiviert bleibt deaktiviert. Das andere aktivierte Gerät bleibt unabhängig davon aktiv.
- **Kontowechsel:** Erst abmelden, dann mit anderem Konto anmelden. Keine private Nachricht des vorherigen Kontos. Push-Einstellung bleibt eine Geräteeinstellung; die aktive Zuordnung gehört jetzt zum angemeldeten Konto.
- **Serverausfall:** PC/Backend unterbrechen: keine Garantie auf Meldung. Nach längerer Unterbrechung wird keine veraltete Timer-Meldung nachgeholt.

Eine einzelne pünktliche Meldung beweist keine zuverlässige Maximalverzögerung. Mehrfach testen, auch nach längerer Android-Inaktivität. Wenn diese Lösung die gewünschte Zeitnähe nicht erreicht, bleibt ein nativer Android-Alarm der passende nächste Vergleich.

## Versand und Grenzen

- Ein Hintergrundlauf ungefähr jede Sekunde, ohne dauerhaft offene App und ohne Redis/externe bezahlte Queue.
- PostgreSQL-Fan-out/Delivery-Records plus derselbe Nutzer-Schreiblock wie bei Timer-Transitions. Prüfung von aktuellem Timer, Ziel, Deadline und gültiger Geräte-Session vor Versand.
- Pro Gerät persistierter Versandstatus, höchstens drei Versuche bei temporärem Fehler (Backoff 2/4 Sekunden). Provider-404/410 entfernt ungültige Abonnements; andere dauerhafte 4xx werden nicht endlos wiederholt.
- Begrenzte Netzwerkanfrage (2 Sekunden), hohe Dringlichkeit, TTL höchstens 30 Sekunden. Serverseitiges Versandfenster endet 30 Sekunden nach Timer-Ende; der App-Worker prüft Ablauf nochmals vor Anzeige. Damit werden bewusst eher verspätete Meldungen ausgelassen, statt minutenalte Meldungen nachzuholen. **Das ist keine garantierte Android-Zustellfrist**; Geräteuhr, Browser- und Systemverhalten liegen außerhalb der App.
- Maximal 20 Registrierungen pro Konto; abgelaufene Session-Bindings werden beim erneuten Registrieren bereinigt. Gerät meint hier Browserprofil/Origin, nicht zwingend ein physisches Gerät.
- Neustart kann noch gültige ausstehende Arbeit fortsetzen. Ein Absturz zwischen Provider-Annahme und DB-Commit kann Doppelzustellung nicht vollständig ausschließen. Ein gemeinsamer Notification-Tag mit `renotify=false` fasst Duplikate möglichst zusammen; **keine Exactly-once-Zusage**.
- Für wenige Geräte gedacht: Versand ist bewusst begrenzt und hält während der kurzen Anfrage den Nutzerlock, um Stop/Logout-Races einzugrenzen. Hochlast/mehrere Worker sind konsistent getestet, aber eine große Produktionsinstallation braucht weitere Last-/Betriebsprüfung.
- Quick-Tunnel-Adresswechsel bedeutet einen neuen Origin: neue Erlaubnis/Opt-in und ggf. PWA-Installation. Vor dem Beenden einer alten Tunnel-Adresse dort möglichst Push deaktivieren/abmelden. Alte Sessions eines aufgegebenen Origins laufen sonst erst später ab; Private-Titel werden trotzdem nie gesendet.

## Gespeicherte Daten

Server: Browser-Endpoint und Verschlüsselungsschlüssel (nicht VAPID-Private-Key), Hash des Endpoints, Session-Bindung, IDs und begrenzter Delivery-Status. Endpoints/Browser-Auth-Schlüssel sind private Fähigkeiten: keine API-Listen oder Klartext-Logs davon. Nur die öffentliche VAPID-Seite wird ans Frontend gegeben.

Browser: in IndexedDB lediglich `enabled` und eine undurchsichtige Abonnement-ID. Keine Konto-/Todo-/Habit-Inhalte oder Session-Token, kein Offline-API-Cache und keine Aktion-Warteschlange. Ein Atomic-Bind verhindert, dass verspätete automatische Login-Zuordnung ein explizites Opt-out wieder aktiviert.

## Automatisierte Tests

Backend-E2E verwenden isolierte PostgreSQL-Daten und einen simulierten Push-Transport. Browser-E2E verwenden echte App, Anmeldung, Proxy, Service Worker und IndexedDB; Erlaubnis und Provider-Abonnement werden simuliert. Node-Worker-Tests prüfen neutrale Ausgabe, fehlende/abgelaufene Bestätigung, Opt-out und sichere Click-Ziele. Keine CI-Nachrichten an echte Geräte, keine echten Push-Schlüssel oder Anbieter-Aufrufe in CI. **Echte FCM-/Android-Zustellung ist der manuelle Test oben**, nicht durch CI ersetzt.
