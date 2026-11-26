# Spracheingabe

Quests, Notizen, Reflexion, Das Beste des Tages und die Antworten im Wochenrückblick lassen sich diktieren. Ein Mikrofon-Knopf neben dem Feld startet das Diktat; beim Anlegen einer Quest liest die App aus dem Text auch Tag, Uhrzeit und Dauer („Zahnarzt morgen um 13 Uhr, 30 Minuten“) sowie Kampagne und Kategorie („Kapitel 4 gliedern, Kampagne Buch schreiben, Kategorie Schreiben“).

Die Erkennung läuft **nur auf dem Gerät**. Keine Aufnahme geht an den eigenen Server oder an einen fremden Dienst.

Code:

- `composables/useDictation.ts`: Reihenfolge, Zustände, Abbruch.
- `composables/dictation/`: ein Modul pro Weg. `engine.ts` beschreibt die gemeinsame Form; dazu `native-engine.ts` (Android) und `whisper-engine.ts` (Browser) mit `whisper-client.ts`, `whisper.worker.ts`, `whisper-model.ts`, `audio.ts` und `silence.ts`.
- `composables/useVoiceInputSettings.ts`: Schalter pro Gerät.
- `components/MicButton.vue`: der Knopf.
- `utils/quest-parse.ts`: Tag und Dauer aus dem Text, mit `utils/quest-parse-names.ts` auch Kampagne und Kategorie; `components/QuestParseChips.vue` zeigt das Erkannte.
- `composables/useQuestParseContext.ts`: die offenen Kampagnen und die Kategorien für das Schnell-Anlegen, einmal geladen für alle Felder.
- `api/new-places.api.ts`: legt eine genannte, noch fehlende Kampagne oder Kategorie vor der Quest an (`createCampaign` nutzt auch „Gehört zu“).
- `utils/insert-text.ts`: Diktat an der Schreibmarke in ein Textfeld.
- `components/VoiceInputSettings.vue`: der Abschnitt in den Einstellungen.
- `native/speech-plugin.ts` und in Android `frontend/android/app/src/main/java/local/habittracker/app/speech/` (`SpeechPlugin.java`, `SpeechAvailability.java`, `SpeechErrors.java`).

## Wo die Mikrofone sind

| Ort | Knopf | Was mit dem Text passiert |
|---|---|---|
| Schnell-Anlegen (`QuickAddQuest.vue`: Heute, Questlog, Tage im Plan) | kurz, im Feld rechts | kommt ins Feld, hinter schon Getipptes mit Leerzeichen; Tag, Dauer, Kampagne und Kategorie werden erkannt (unten) |
| Neue Quest (`CreateTodoForm.vue`) | kurz, im Titelfeld rechts | kommt in den Titel; Erkanntes füllt Tag, Dauer, „Gehört zu“ und Kategorie |
| Notizen (`RichTextEditor.vue`) | lang, in der Werkzeugleiste | als reiner Text an der Schreibmarke (Tiptap `insertContent` mit einem Textknoten, kein HTML) |
| Das Beste des Tages (`DayBestField.vue`) | lang, oben rechts im Feld | an der Schreibmarke; was über 280 Zeichen ginge, fällt weg, und still steht „Gekürzt auf 280 Zeichen.“ |
| Reflexion (`DayReflection.vue`) | lang, oben rechts im Feld | an der Schreibmarke; „Speichern“ erscheint wie beim Tippen |
| Wochenrückblick (`ReviewAnswers.vue`) | lang, je Antwort oben rechts | an der Schreibmarke; das automatische Speichern greift wie beim Tippen |

- **Im Feld:** Ein Feld mit Mikrofon steckt in `.mic-field` (`style.css`), der Knopf hat `placement="field"` und deckt an der rechten Kante die volle Tap-Fläche; seine sichtbare Fläche liegt 2px innen, damit der Feldrahmen frei bleibt. Nur solange das Mikrofon da ist, hält der Text rechts Abstand. Der Platzhalter des Schnell-Anlegens (`utils/fit-text.ts`) misst ohne diesen Abstand und nimmt so die kurze Form, wo der Platz nicht reicht.
- **Langes Drücken auf Plus** (`CreateButton.vue`): Nach 500 ms, mit Finger oder Maus, öffnet sich „Neue Quest“ (auch aus den Dailies), und das Diktat des Titels läuft schon (`dictate` an `CreateItemDialog` und `CreateTodoForm`). Ein kurzes Brummen (`vibrate(10)`) bestätigt. Wer früher loslässt oder sich mehr als 10 px bewegt, tippt normal. Enter und Leertaste tippen immer. Den Hinweis „Lange drücken zum Diktieren“ trägt der Knopf als `aria-description`, aber nur, wenn ein Mikrofon da ist; ohne Mikrofon gibt es kein langes Drücken.

## Regeln

- **Ein Tipp startet, ein Tipp beendet.** Escape verwirft das Diktat, auch in einem Dialog, ohne ihn zu schließen. Es läuft immer nur ein Diktat; ein neues bricht ein laufendes ab.
- **Kurz und lang** regeln nur das Ende, nicht den Weg. Kurze Texte (Titel, eine Zeile) enden nach etwa 2 Sekunden Pause von selbst, oder nach 8 Sekunden, wenn gar nichts kam. Lange Texte (Notizen, Reflexion, Wochenrückblick) laufen, bis jemand stoppt. Im Browser endet jede Aufnahme spätestens nach 3 Minuten. In Android entscheidet die Erkennung des Geräts über die Pause.
- **Der Zustand ist immer sichtbar,** als Symbol und Wort, nie nur als Farbe:
  - Mikrofon: bereit
  - Quadrat mit „Hört zu …“: zum Beenden tippen
  - „Wird erkannt …“: der Browser rechnet den Text aus
  - „Lade Sprachmodell … 42 %“: das Modell lädt

  Der Wechsel wird über eine `status`-Region angesagt. Fehler kommen über `role="alert"` in einer kleinen Sprechblase unter dem Knopf. Frage und Hinweis bekommen den Fokus, damit die Tastatur gleich antworten kann.
- **Fehler sagen, was zu tun ist.** Ohne Mikrofon-Freigabe: „Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Geräts.“ Für „nichts verstanden“, „kein Mikrofon“ und „Modell lädt nicht“ gibt es jeweils einen eigenen Satz.
- **Kein Weg, kein Knopf.** Kann das Gerät gar nicht lokal erkennen, oder ist die Spracheingabe auf diesem Gerät ausgeschaltet, zeigt die App kein Mikrofon.

## Wege der Erkennung

Zwei Wege, in fester Reihenfolge. `useDictation` fragt sie der Reihe nach, bis einer kann.

| Weg | Wo | Wie |
|---|---|---|
| nativ | Android-App | Plugin `Speech` mit `SpeechRecognizer` auf dem Gerät, Deutsch, Text schon beim Sprechen |
| Whisper | Browser (Chrome, Edge, Firefox, Safari) | Whisper über transformers.js in einem Web Worker; Text nach dem Ende der Aufnahme |

- In der Android-App gibt es nur den nativen Weg, Whisper im WebView nicht.
- Die Web Speech API der Browser nutzt die App bewusst nicht: Chrome und Edge schicken die Aufnahme dabei an Google bzw. Microsoft.
- **Ein neuer Weg** ist ein weiteres Modul in `composables/dictation/` mit der Form aus `engine.ts`, eingetragen in `ENGINES` und `ENGINE_ORDER` in `useDictation.ts`. Die Form umfasst `supported`, `detect()` und `start(mode, handlers)`, optional `setup`, `pendingDownload()`, `prepare()` und `ready()`.

### Android

Der Reihe nach, ohne Umweg über das Netz:

- **Ab Android 12 (API 31):** Androids eigene Erkennung auf dem Gerät (`SpeechRecognizer.createOnDeviceSpeechRecognizer`), wenn `isOnDeviceRecognitionAvailable` sie meldet.
  - Ab Android 13 (API 33) fragt die App mit `checkRecognitionSupport`, ob Deutsch installiert ist oder gerade lädt.
  - Unter Android 12 zeigt sich ein fehlendes Modell erst beim Zuhören, als Fehler „Sprache nicht verfügbar“.
  - Fehlt die Erkennung auf dem Gerät ganz, gilt das wie ein fehlendes Sprachpaket. Die App weicht nicht auf den Online-Dienst aus.
- **Unter Android 12** gibt es keine solche Erkennung. Die App nimmt den Standard-Dienst (meist die Google-App) mit `EXTRA_PREFER_OFFLINE`. Das ist eine **Bitte**: Ist das deutsche Offline-Paket nicht installiert, kann der Dienst trotzdem das Netz benutzen, und die App kann das nicht verhindern oder prüfen.
- `available()` liefert `{ available, onDevice, reason }`. `reason` ist `offline-model-missing`, `offline-model-downloading` oder `unavailable` (gar keine Erkennung, dann kein Mikrofon). Die Regeln stehen in `SpeechAvailability.java`, ein JVM-Test prüft sie.
- **Ohne deutsches Offline-Paket** bleibt das Mikrofon da. Ein Tipp öffnet dann statt des Zuhörens einen Hinweis:
  - Text: „Zum Diktieren braucht dieses Gerät das deutsche Offline-Sprachpaket. Dann bleibt die Aufnahme auf dem Gerät.“
  - Schritte, allgemein gehalten, weil die Menüs je nach Gerät anders heißen: Einstellungen öffnen, nach „Spracherkennung auf dem Gerät“ bzw. „Offline-Spracherkennung“ suchen (oft unter System › Sprache oder in der Google-App unter Sprache), dort Deutsch laden.
  - Knopf „Sprachpaket einrichten“ (`openOfflineSetup`): Ab Android 13 bittet er Android, Deutsch herunterzuladen (`triggerModelDownload`). Sonst öffnet er die Einstellungen der Spracheingabe (`Settings.ACTION_VOICE_INPUT_SETTINGS`, ersatzweise die Spracheinstellungen).
  - Der nächste Tipp fragt das Gerät neu.
- Fehlercodes des `SpeechRecognizer` werden in `SpeechErrors.java` zu festen Codes mit deutschem Text: `permission`, `offline-model-missing`, `no-match`, `speech-timeout`, `busy`, `audio`, `server`, `client` und `unknown`. Netzwerk- und Sprachfehler zählen als fehlendes Offline-Paket, weil nur die Erkennung auf dem Gerät gefragt ist. Hat das Gerät schon Text gehört, gilt bei „nichts mehr verstanden“ der bisher gehörte Text.
- `RECORD_AUDIO` ist die erste Laufzeit-Berechtigung der App. Das Plugin fragt beim ersten Diktat über den Alias `microphone`. `<queries>` im Manifest enthält `android.speech.RecognitionService`, sonst sieht die App ab Android 11 den Erkennungsdienst nicht.

### Browser: Whisper auf dem Gerät

- **Modell:** öffentliche ONNX-Gewichte vom Hugging-Face-Hub (`whisper-model.ts`):
  - Mit WebGPU: `onnx-community/whisper-small`, 4 Bit (Encoder 66 MB, Decoder 233 MB).
  - Sonst WebAssembly: `onnx-community/whisper-base`, 8 Bit (Encoder 23 MB, Decoder 54 MB).
  - Scheitert WebGPU beim Laden, nimmt die App das kleinere Modell.
- **Laufzeit:** transformers.js (`@huggingface/transformers`, feste Version) und die WebAssembly-Laufzeit von ONNX (rund 27 MB) liefert die App selbst aus, nicht ein CDN. Beides steckt in einem eigenen Worker-Chunk, den der Browser erst beim ersten Diktat lädt; der Haupt-Chunk wächst dadurch nicht.
- **Einmal fragen:** Vor dem ersten Laden fragt die Sprechblase: „Dafür einmalig ~110 MB laden, danach geht es offline. Die Aufnahme verlässt das Gerät nie.“ Mit WebGPU sind es ~330 MB. Erst nach „Laden“ beginnt der Download, mit Fortschritt im Knopf.
  - transformers.js legt das Modell im Cache des Browsers ab.
  - Die Zusage merkt sich das Gerät in `localStorage` `voice:model` (pro Modell).
  - Leert jemand den Cache, lädt das Modell beim nächsten Mal ohne neue Frage, mit Fortschritt.
- **Aufnahme:** `MediaRecorder` nimmt auf. Bei kurzen Texten misst ein `AnalyserNode` die Lautstärke für das Ende nach der Pause. Danach dekodiert ein `AudioContext` mit 16 kHz zu Mono-Samples, und der Worker erkennt Deutsch (`language: "de"`, `task: "transcribe"`, 30-Sekunden-Fenster).
- Whisper „hört“ in Stille manchmal Untertitel-Floskeln („Untertitel der Amara.org-Community“). Steht nur so etwas da, gilt das als „nichts verstanden“ (`cleanTranscript`).
- Ohne `crossOriginIsolated` rechnet die WebAssembly-Laufzeit mit einem Thread. Das ist langsamer, aber es geht.

## Tag und Dauer beim Anlegen

`parseQuest(text, { today, ignore })` in `utils/quest-parse.ts` ist eine reine Funktion. Sie erkennt:

- **Tage:**
  - heute, morgen, übermorgen
  - Wochentage: „Freitag“ ist der nächste Freitag, an einem Freitag also der in einer Woche. „Diesen Freitag“ darf heute sein. „Nächsten Freitag“ ist der Freitag der nächsten Kalenderwoche.
  - Daten wie „am 3.12.“, „3.12.2026“, „3.12.26“, „3. Dezember“, „24. Nov. 2028“. Ein Datum ohne Jahr, das dieses Jahr schon vorbei ist, gilt fürs nächste Jahr.
- **Uhrzeiten:** „um 13 Uhr“, „13:30“, „13 Uhr 30“, „um 9.15“, „9.15 Uhr“, „um dreizehn Uhr“, „gegen 8 Uhr“. Mit Punkt oder als bloße Stunde braucht sie „Uhr“ danach oder „um“ davor, damit „13.12.“ ein Datum bleibt. Sie wird zur festen Uhrzeit, die Quest also zum Termin; ohne Tag gilt der Tag der Zeile, im Questlog heute. Chip mit Uhr-Symbol: „13:00 Uhr“, vorgelesen „Uhrzeit: 13:00 Uhr, entfernen“.
- **Dauern:**
  - „30 Minuten“, „30 min“, „1 Stunde“, „2 Std.“, „2h“, „1,5 h“
  - „anderthalb“ bzw. „eineinhalb Stunden“, „zweieinhalb Stunden“, „eine halbe Stunde“, „eine Viertelstunde“, „eine Dreiviertelstunde“
  - „1 Stunde und 30 Minuten“
  - Zahlwörter bis sechzig („zwanzig“, „fünfundvierzig“), höchstens ein Tag
- Es zählt nur der erste Tag, die erste Uhrzeit und die erste Dauer; alles Weitere bleibt im Titel. Die Uhrzeit wird vor Tag und Dauer gesucht.
- Verbindungswörter davor („am“, „bis“, „für“, „um“, „gegen“, „ca.“, „etwa“) gehören zum Erkannten. Übrige Kommas und ein „und“ dazwischen verschwinden. Ein großer Anfangsbuchstabe bleibt groß.
- Erkennt sie nichts, bleibt der Text, wie er ist. Bliebe nach dem Entfernen nichts übrig, bleibt der ganze Text der Titel.
- `matches` liefert für jede Erkennung Art, Wert, Beschriftung („morgen“, „Fr., 27.11.“, „30 Min.“) und die Stelle im Text.

### Im Schnell-Anlegen

- Die Erkennung läuft bei jedem Tastendruck und nach jedem Diktat. Unter dem Feld steht je Erkanntem ein Chip mit Symbol (Kalender, Uhr), Wort und ✕, z. B. „morgen“ und „30 Min.“. Der Name sagt es ganz: „Tag: morgen, entfernen“.
- Ein Tipp auf den Chip verwirft ihn (`ignore`): Seine Wörter bleiben im Titel, und nichts wird aus ihnen gesetzt. Das gilt, bis das Feld leer ist.
- Das Feld zeigt den Text, wie er getippt ist. Erst beim Anlegen geht der Titel ohne die erkannten Wörter an den Server, mit `scheduledDate` und `plannedDurationMinutes`.
- **Der erkannte Tag gewinnt** gegen den Tag der Zeile: „Wäsche morgen“ in Heute steht danach bei morgen. Im Questlog plant ein erkannter Tag die Quest aus dem Questlog heraus; der Chip sagt das mit „→ morgen“ und im Namen („plant sie ein statt ins Questlog“). Landet die Quest anderswo als in der Zeile, sagt eine stille Zeile „Für morgen eingeplant.“
- ↑ und ↓ wirken weiter, aber nur für die eigene Liste: Ein Tag aus dem Text sortiert die Zeile nicht um.

### In „Neue Quest“

- Tag und Dauer aus dem Titel füllen ihre Felder, solange niemand diese Felder selbst angefasst hat (auch „Heute“/„Morgen“ zählt als angefasst). Dieselben Chips stehen unter dem Titel; ein ✕ leert das Feld wieder.
- Aus dem Titel gehen beim Erstellen nur die Wörter, deren Wert auch übernommen wurde. Hat jemand den Tag selbst gesetzt, bleibt „morgen“ im Titel stehen.
- Für eine Kampagne wird nichts erkannt; sie hat weder Tag noch Dauer.

## Kampagne und Kategorie beim Anlegen

Bekommt `parseQuest` die offenen Kampagnen (`campaigns`) und die Kategorien (`categories`), erkennt es auch, wozu eine Quest gehört. Was man sagen kann:

| Gesagt | Ergebnis |
|---|---|
| „Kapitel 4 gliedern **Kampagne Buch schreiben**“ | unter „Buch schreiben“ |
| „… **zur Kampagne** Buch schreiben“, „… **für die Kampagne** Buch schreiben“ | ebenso |
| „Kapitel 4 gliedern **für Buch schreiben**“ | ebenso, aber nur, wenn der Name genau stimmt |
| „Laufen **Kategorie Sport**“, „Laufen **in der Kategorie** Sport“ | Kategorie Sport |
| „Kapitel 4 gliedern morgen 30 Minuten Kampagne Buch schreiben Kategorie Schreiben“ | Titel „Kapitel 4 gliedern“, morgen, 30 Min., unter „Buch schreiben“, Kategorie Schreiben |

Regeln (`utils/quest-parse-names.ts`):

- **Nur mit Schlüsselwort.** Ein Name zählt nach „Kampagne“ bzw. „Kategorie“ (davor dürfen „zur“, „zum“, „für (die)“, „in (der)“, „mit (der)“, „unter“ stehen). Ohne Schlüsselwort zählt nur eine Kampagne nach „für“, und nur, wenn ihr Name genau dasteht. Ein Name allein zählt nie: „Sport machen“ bleibt ein Titel, auch wenn es die Kategorie Sport gibt.
- **Vergleich:** ohne Groß- und Kleinschreibung, Umlaute (ä = ae), ß (= ss), Akzente und Satzzeichen; „&“ und „+“ gelten als „und“. Mehrere Wörter gehen („Buch schreiben“), ein Komma, Doppelpunkt oder eine Klammer beendet den Namen.
- **Kleine Hörfehler:** Nach einem Schlüsselwort darf ein Name ab fünf Buchstaben einen Fehler haben (ein Buchstabe falsch, zu viel oder zu wenig, auch ein getrenntes oder zusammengezogenes Wort: „Buch schreibn“, „Buchschreiben“). Kürzere Namen müssen stimmen. Das Schlüsselwort selbst darf einen Fehler haben („Kathegorie“, „Kampagnen“).
- **Längster Name gewinnt:** Gibt es „Buch“ und „Buch schreiben“, gewinnt bei „Kampagne Buch schreiben“ das längere. Ein Fehler zählt wie zwei Buchstaben weniger, so schlägt ein genaues „Buch“ ein „Buche“ mit einem Fehler.
- Namen werden vor Tag und Dauer gesucht: Eine Kampagne „Sport am Montag“ bleibt ganz, das „am Montag“ darin ist kein Tag.
- Es zählt nur die erste Kampagne und die erste Kategorie. Das Erkannte geht mit Schlüsselwort und Verbindungswörtern aus dem Titel; ein „und“ zwischen zwei Erkanntem auch. Bliebe nichts übrig, bleibt der ganze Text der Titel.
- Nur offene Kampagnen (erledigte nicht, lose oberste Quests nicht; `parentChoices(…, { campaignsOnly: true })`) und nur die eigenen Kategorien.
- `matches` liefert `campaign` (mit `id` und dem Symbol der Kampagne) und `category` (mit `id` und Marke); das Ergebnis `campaignId` und `categoryId`.

### Neue Kampagne, neue Kategorie

Passt ein Name **nach seinem Schlüsselwort** zu keiner Kampagne bzw. Kategorie (auch nicht mit Hörfehler), bietet die App an, sie anzulegen (`parseQuest(…, { offerNew: true })`, `findNewAfterKeyword` in `quest-parse-names.ts`). Nach einem bloßen „für“ nie: Dort zählt weiter nur eine Kampagne, die es genau so gibt.

| Gesagt (ohne passende Kampagne/Kategorie) | Ergebnis |
|---|---|
| „Wäsche waschen **Kategorie Haushalt** morgen“ | Titel „Wäsche waschen“, morgen, neue Kategorie „Haushalt“ |
| „Kisten packen **Kampagne Umzug nach Berlin** 30 Minuten“ | neue Kampagne „Umzug nach Berlin“, 30 Min. |
| „Kisten **Kampagne Umzug Kategorie Haushalt**“ | beide neu; die Kampagne bekommt die neue Kategorie |
| „Laufen **Kampagne Marathon am Freitag**“ | neue Kampagne „Marathon“, Freitag |
| „Kisten packen für Umzug“ | nichts: kein Schlüsselwort |

- **Wie weit der Name reicht:** die Wörter nach dem Schlüsselwort bis dahin, wo ein Tag oder eine Dauer beginnt (mit ihren Verbindungswörtern: „am Freitag“, „für 30 Minuten“), bis zum anderen oder demselben Schlüsselwort (mit „in der“, „zur“ usw.), bis zu etwas schon Erkanntem, einem Komma, Punkt, Doppelpunkt oder einer Klammer, sonst bis zum Ende. Verbindungswörter am Ende („und“, „am“, „für“, „der“ …) gehören nicht dazu. Der erste Buchstabe wird groß.
- **Höchstens so lang, wie der Server nimmt:** 200 Zeichen für eine Kampagne (Titel einer Quest), 60 für eine Kategorie. Ein längerer Name wird nicht angeboten; seine Wörter bleiben im Titel.
- Nur, wenn die Liste bekannt ist: Solange die Kampagnen oder Kategorien nicht geladen sind (oder das Laden scheiterte), wird nichts als neu angeboten. Sonst entstünde eine Kampagne doppelt.
- Eine erledigte Kampagne zählt nicht als vorhanden: „Kampagne Umzug“ bietet dann eine neue an.
- `matches` liefert die neue als `campaign` bzw. `category` mit `isNew: true` (ohne `id`), das Ergebnis `newCampaign` bzw. `newCategory`.
- **Chip:** „Neue Kampagne: Umzug“ bzw. „Neue Kategorie: Haushalt“, mit Plus statt Symbol oder Marke, dem Wort „Neue“ und gestricheltem Rand statt Füllung, nie nur Farbe. Der Name sagt „…, wird beim Anlegen erstellt, entfernen“. Ein ✕ verwirft ihn wie die anderen: Seine Wörter bleiben im Titel, und nichts wird angelegt.
- **Beim Anlegen** entsteht erst das Neue, dann die Quest (`createNewPlaces` in `api/new-places.api.ts`): zuerst die Kategorie, wie in ihrem Auswahlfeld (`createCategory`; der Server gibt ihr die erste Kernfarbe, die noch keine Kategorie zeigt), dann die Kampagne, wie „Gehört zu“ sie anlegt (`createCampaign`: oberste Quest ohne Tag und Dauer, in der Farbe ihres Titels), danach die Quest mit `parentId` der Kampagne.
  - Eine neue Kampagne bekommt die genannte Kategorie (neu oder vorhanden), die Quest dieselbe. Ohne genannte Kategorie bekommen beide keine.
  - Scheitert das Anlegen, entsteht keine Quest, der Text bleibt, und die Fehlerzeile sagt, was nicht ging: „Die Kategorie „Haushalt“ konnte nicht angelegt werden, die Quest ist nicht erstellt.“ und dahinter der Grund vom Server.
  - Was schon entstanden ist (die Kategorie, bevor die Kampagne scheiterte), kennt der nächste Versuch: Es wird nicht doppelt angelegt.
  - Danach `notifyDataChanged()`: Die Ansichten laden neu, und `useQuestParseContext` nimmt das Neue sofort in seine Liste auf (`remember`), so passt die nächste Quest mit demselben Namen schon dazu.

### Im Schnell-Anlegen

- Die Listen lädt `useQuestParseContext` erst, wenn der Text „Kampagn…“, „Kategor…“ oder „für“ enthält, und nur einmal für alle Felder der Seite (im Plan steht eins je Tag). Nach einer Änderung an den Daten oder nach einer Minute lädt es beim nächsten solchen Text neu; scheitert das Laden, versucht es nach einer halben Minute wieder, und bis dahin wird kein Name erkannt.
- Chips: „Kampagne: Buch schreiben“ mit dem Symbol der Kampagne und „Kategorie: Sport“ mit dem Quadrat ihrer Marke, nie nur Farbe. Ein ✕ verwirft sie wie die anderen.
- Beim Anlegen geht die Quest mit `parentId` unter die Kampagne. Ohne genannte Kategorie bekommt sie die der Kampagne, wie der Editor sie vorschlägt (`categoryOfChoice`).
- Eine Quest unter einer Kampagne bleibt im Questlog (es zeigt offene Quests ohne Tag, egal wo sie hängen) und an ihrem Tag in Heute und im Plan. Der Kampagnen-Chip verschiebt also nichts und trägt kein „→“.

### In „Neue Quest“

- Wie Tag und Dauer nur aus dem Diktat. Erkanntes füllt „Gehört zu“ und Kategorie, solange niemand sie selbst gewählt hat; „Gehört zu“ zeigt dann auch das übernommene Warum der Kampagne. Die Listen kommen aus den beiden Auswahlfeldern, die sie ohnehin laden.
- Eine genannte Kampagne bringt ihre Kategorie mit, wenn keine genannt ist. Verschwindet der Chip, kommt die Kategorie zurück, die vorher galt (keine, die der Kampagne, in der der Dialog geöffnet wurde, oder die eines gewählten Platzes).
- Geöffnet in einer Kampagne steht „Gehört zu“ schon fest: Dort wird nur die Kategorie erkannt.
- Eine neue Kampagne oder Kategorie steht vorläufig in ihrem Auswahlfeld, als letzte Wahl mit Plus: „Neue Kampagne: Umzug“, „Neue Kategorie: Haushalt“ (`pending` an `ParentPicker` und `CategoryPicker`); die eingeklappte Kategorie zeigt „Haushalt (neu)“. Angelegt wird erst beim Erstellen, wie im Schnell-Anlegen. Wählt jemand im Feld etwas anderes (auch „Keine“), verschwindet das Vorläufige samt Chip, und die Wörter bleiben im Titel.
- Eine neue Kategorie verdrängt die vorher geltende wie eine genannte; verschwindet ihr Chip, kommt die alte zurück.
- Scheitert die Quest nach dem Anlegen, nimmt der nächste Versuch das schon Angelegte, statt es doppelt anzulegen.

## Datenschutz

- **Die Aufnahme verlässt das Gerät nie.** In Android erkennt sie das Gerät selbst. Die Ausnahme steht oben: Unter Android 12 ohne Offline-Paket kann der Dienst das Netz benutzen. Im Browser erkennt Whisper im Worker, und die Samples liegen nur für die eine Erkennung im Speicher.
- Der eigene Server bekommt weder Audio noch das Diktat selbst. Erst der fertige Text landet, wie Getipptes, im Feld.
- Einzige Verbindung nach außen ist im Browser der einmalige Download der öffentlichen Modell-Gewichte von `huggingface.co` (und dessen CDN), nach Zusage. Dabei geht nichts vom Gerät mit außer der üblichen Anfrage.
- In Android lädt das Offline-Paket der Hersteller des Geräts bzw. Google, über die Einstellungen des Geräts.

## Einstellungen

Einstellungen › Spracheingabe (`?abschnitt=spracheingabe`) schaltet das Mikrofon pro Gerät ein oder aus (`localStorage` `voice:input`, `{ enabled: true }` als Standard). Einen Server-Speicher dafür gibt es nicht, weil Handy und Laptop es verschieden wollen können.

- Darunter ein Satz: „Die Erkennung läuft auf deinem Gerät; Aufnahmen verlassen es nicht.“
- Dann, womit dieses Gerät erkennt (`describeDictation()` in `useDictation.ts`, unabhängig vom Schalter):
  - Android: die Erkennung des Geräts. Fehlt das deutsche Offline-Paket, stehen dort derselbe Hinweis, die Schritte und der Knopf „Sprachpaket einrichten“ wie am Mikrofon.
  - Browser: Whisper mit Modellname und Größe, und ob das Modell schon im Cache liegt. transformers.js legt es in Cache Storage unter `transformers-cache` ab (`dictation/whisper-cache.ts`). Liegt es dort, entfernt „Sprachmodell entfernen“ den ganzen Cache, beendet den Worker und vergisst die Zusage (`voice:model`): Das nächste Diktat fragt wieder vor dem Laden.
  - Kein Weg: ein Satz, dass dieses Gerät Sprache nicht selbst erkennen kann.

## Testen

- **Vitest:** Die Komponenten-Specs ersetzen `MicButton` durch `src/test/mic-stub.ts` und geben mit `dictate()` einen erkannten Text hinein. `useDictation.spec.ts` und `MicButton.spec.ts` prüfen die Wege selbst mit nachgestellten Aufnahmen.
- **Playwright** (`e2e/voice-input.spec.ts`) hat kein Mikrofon. Dafür gibt es genau einen Haken: Setzt ein Test vor dem Laden der App `window.__dictationStub = { text: "…" }` (`page.addInitScript`), meldet sich `dictation/stub-engine.ts` als erster Weg, und jedes Diktat „hört“ nach 300 ms diesen Text. Ohne das Global meldet der Weg sich nicht, und die App setzt es nie. Der Haken ist also nur in einem Test aktiv.
