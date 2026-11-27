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

Die APK liegt danach unter `frontend/android/app/build/outputs/apk/debug/app-debug.apk`. Die JVM-Tests des Android-Codes (Fokus-Sperre, Cache der Fokus-Klänge, Zurück-Taste) laufen mit `cd android && ./gradlew.bat test`.

## Zurück

Capacitor hat ohne das npm-Plugin `@capacitor/app` keine eigene Zurück-Taste, jede Zurück-Geste schloss die App. Das eigene Plugin `BackButton` (`frontend/android/.../back/BackButtonPlugin.java`, `frontend/src/native/back-button-plugin.ts`) nimmt jede Zurück-Taste und Zurück-Geste (auch die vorausschauende ab Android 13) und gibt sie an die Seite. Die Seite (`composables/useBackButton.ts`) macht genau einen Schritt, in dieser Reihenfolge:

1. Ist etwas offen (ein Dialog oder Editor, das Befehlsmenü, ein „…“-Menü, das Blatt „Mehr“), schließt das oberste, genauso wie sein ✕ oder Escape. Ein Dialog, der gerade speichert, bleibt offen. Alles, was sich öffnet, steht dafür in `composables/useOverlayStack.ts`; `ModalDialog`, `ActionMenu` und `AppNavigation` melden sich dort an.
2. Sonst, wenn man in der App von einer Ansicht hierher kam: einen Schritt zurück (`router.back()`). Was nur die Adresse ersetzt (`?tag=`, `?ab=`), ist kein eigener Schritt.
3. Sonst, außerhalb von Heute: nach Heute (ersetzt die Adresse).
4. Sonst (Heute, nichts offen): Android macht sein eigenes Zurück, die App geht in den Hintergrund.

Das Plugin liest die `id` der Antwort mit `optLong`, nicht mit Capacitors `getLong`: Eine kleine Zahl kommt als Integer an, `getLong` gäbe dafür seinen Standardwert zurück, die Antwort ginge verloren und die App schlösse nach 0,8 s trotzdem.

Antwortet die Seite nicht binnen 0,8 s (hängt oder lädt neu), macht Android sein eigenes Zurück; die Logik dafür (`BackPress`) hat JVM-Tests. Eine offene Tastatur schließt Android selbst mit dem ersten Zurück. Als installierte Web-App schließt die Zurück-Geste Dialoge von selbst (`<dialog>`) und Menüs und „Mehr“ über `CloseWatcher`, wo der Browser es kann (Chrome); Ansichten gehen dort über die Browser-Historie zurück.

Am Handy prüfen:

1. App frisch starten (aus den letzten Apps wischen), Heute: Zurück → App geht in den Hintergrund.
2. Heute › Kalender › Questlog, dann Zurück, Zurück: Questlog → Kalender → Heute; noch einmal Zurück → App geht.
3. „Mehr“ öffnen: Zurück schließt nur das Blatt. „Mehr“ › Einstellungen, Zurück → zurück, wo man war.
4. In Heute „…“ an einer Quest: Zurück schließt nur das Menü. „…“ › Bearbeiten (Editor offen): Zurück schließt den Editor, die Ansicht bleibt.
5. Im Editor ein Feld antippen (Tastatur offen): erstes Zurück schließt die Tastatur, zweites den Editor.
6. „Mehr“ › Suchen (Befehlsmenü): Zurück schließt es. Ein Dialog über einem Dialog (z. B. Löschen-Rückfrage aus dem Editor): Zurück schließt nur den oberen.
7. Fokus-Modus aus Heute öffnen, Zurück → Heute.
8. Schritt 3 ist am Handy selten zu sehen (die App startet auf Heute); er greift, wenn die Seite auf einer anderen Ansicht neu lädt, und ist mit Unit-Tests abgedeckt.
9. Mit der Wisch-Geste vom Rand dasselbe wie mit der Taste.

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
