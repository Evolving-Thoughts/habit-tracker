# Test-APK fürs Handy

Die APK ist ein Fenster auf einen Server: Sie lädt die Web-App von dort, und die Sitzung gilt wie im Browser. Es gibt zwei Varianten:

- **Live** (Standard): öffnet `https://plan.evolving-thoughts.com`, nur über HTTPS, ohne Klartext-Verkehr. Funktioniert überall mit Internet, auch Push.
- **WLAN-Dev**: öffnet den Dev-Server auf dem PC über `http://…` (`CAP_SERVER_URL`). Nur dann ist Klartext erlaubt. Änderungen am Frontend sind ohne neue APK sofort sichtbar.

`capacitor.config.ts` nimmt `CAP_SERVER_URL`, sonst die Live-Adresse; `cleartext` gilt nur für eine `http://`-Adresse.

Die Fokus-Sperre (siehe `focus-block.md`) und die Wiedergabe der Fokus-Klänge gehören zur APK selbst: Nach Änderungen am Android-Code (`frontend/android`) braucht es eine neue APK, in beiden Varianten.

## Live-APK bauen

```bash
JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" CAP_SERVER_URL=https://plan.evolving-thoughts.com npx cap sync android
```

```bash
cd android && JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleDebug
```

`CAP_SERVER_URL` darf hier auch fehlen; die Live-Adresse ist der Standard. Fehlt `android/local.properties`, braucht Gradle den Ort des Android-SDK, meist `sdk.dir=C\:\\Users\\<Name>\\AppData\\Local\\Android\\Sdk`.

## WLAN-Dev-APK

Handy und PC müssen im selben WLAN sein, und Backend und `dev:lan` müssen laufen.

Server starten:

```bash
npm run dev:lan
```

Windows fragt beim ersten Start nach der Firewall. „Private Netzwerke“ erlauben; ist das WLAN als öffentlich eingestuft, kommt das Handy nicht durch.

Das Backend nimmt schreibende Anfragen (auch den Login) nur an, wenn der `Origin` genau `FRONTEND_URL` entspricht. Über `dev:lan` lautet der Origin `http://<PC-Adresse>:5174`, also in `backend/.env` `FRONTEND_URL` auf genau diese Adresse setzen (ohne `/` am Ende) und das Backend neu starten. Sonst schlägt die Anmeldung mit „Ungültiger Request-Ursprung“ fehl. Für die normale Entwicklung danach wieder `http://localhost:5173` eintragen.

Neue APK bauen, nötig bei geänderter PC-Adresse (`ipconfig`):

```bash
CAP_SERVER_URL=http://192.168.178.22:5174 JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" npx cap sync android
```

```bash
cd android && CAP_SERVER_URL=http://192.168.178.22:5174 JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew.bat assembleDebug
```

Grenzen: Push geht ohne HTTPS nicht, und unterwegs ohne dieses WLAN lädt die App nicht.

## Ergebnis

Die APK liegt danach unter `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Die JVM-Tests des Android-Codes (Fokus-Sperre, Cache der Fokus-Klänge) laufen mit `cd android && ./gradlew.bat test`.

## Fokus-Sperre am Handy einrichten

1. APK installieren, anmelden.
2. Einstellungen › Fokus-Sperre: „Beim Fokus sperren“ einschalten, Soll-Schwelle wählen, Sperrliste füllen („App hinzufügen“ zeigt die installierten Apps; Websites tippen, etwa `youtube.com`).
3. Unter „Auf diesem Gerät“: „Bedienungshilfen öffnen“ → dort „Fokus-Sperre“ einschalten (Android warnt allgemein vor Bedienungshilfen; diese liest nur den Paketnamen der App vorne). Ist der Schalter ausgegraut („Eingeschränkte Einstellung“, ab Android 13 bei nicht aus dem Play Store installierten Apps): Einstellungen › Apps › Habit Tracker › Menü ⋮ › „Eingeschränkte Einstellungen zulassen“, dann noch einmal. Dann „VPN erlauben“ und im Dialog von Android zustimmen.
4. Eine Quest mit Soll ab der Schwelle (oder „Fokus-Sperre: Immer“) im Fokus-Modus starten, eine gesperrte App öffnen: Der Sperrbildschirm erscheint. Eine gesperrte Website im Browser lädt nicht.
5. Prüfen: Soft endet mit der Stoppuhr; Hardcore zeigt die Restzeit und lässt sich nicht aufheben; „Zurück zur Quest“ öffnet den Fokus-Modus.

Steht „Privates DNS“ in den Android-Einstellungen auf einem festen Anbieter, umgeht der Browser den Website-Filter; für den Test auf „Automatisch“ oder „Aus“ stellen.

## Fokus-Klänge am Handy testen

Die App lädt jeden Klang einmal vom Server in ihren Cache und spielt ihn in einem Mediendienst, also auch bei ausgeschaltetem Bildschirm. Eine neue Version des Klangs lädt sie neu.

1. Neue APK installieren, anmelden, eine Quest im Fokus-Modus öffnen und dort einen Klang wählen.
2. Stoppuhr starten: Der Klang läuft in Schleife, und es erscheint eine Medien-Benachrichtigung „Fokus-Klang“ mit dem Titel des Klangs.
3. Bildschirm ausschalten und eine Minute warten: Der Klang läuft weiter, ohne Lücke an der Schleifenstelle.
4. In der Benachrichtigung (oder in den Mediensteuerungen der Schnelleinstellungen) auf Pause tippen: Der Klang endet, die Benachrichtigung verschwindet, und der Klang-Knopf in der App zeigt „aus“.
5. Klang wieder einschalten, dann die Stoppuhr in der App pausieren: Der Klang endet.
6. Mit Kopfhörern starten und sie abziehen (oder Bluetooth trennen): Der Klang pausiert, statt aus dem Lautsprecher weiterzuspielen; der Knopf zeigt „aus“.
7. Die Lautstärke in der App ändern: Der Klang wird sofort leiser oder lauter.
8. Den Ton am Ende eines Solls abwarten: Er spielt einmal, der Klang läuft daneben weiter.
9. Die App aus den letzten Apps wischen: Der Klang endet mit ihr.
10. App wieder öffnen und in Heute eine Quest abhaken: Der „Erledigt“-Ton spielt. Unter Einstellungen › Töne den Schalter ausschalten und ein Daily abhaken: kein Ton.

Ab Android 13 dürfen Medien-Benachrichtigungen auch ohne die Erlaubnis für Benachrichtigungen erscheinen; die Wiedergabe hängt nicht davon ab.
