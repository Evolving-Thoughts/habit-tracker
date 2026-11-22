# Test-APK fürs Handy

Die APK ist nur ein Fenster auf den Dev-Server auf dem PC. Handy und PC müssen im selben WLAN sein, und Backend und `dev:lan` müssen laufen. Änderungen am Frontend sind ohne neue APK sofort sichtbar.

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

Die APK liegt danach unter `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.

Grenzen: Push geht ohne HTTPS nicht, und unterwegs ohne dieses WLAN lädt die App nicht.
