# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Der Projektinhaber und wenige Bekannte. Sie planen damit ihren eigenen Alltag: Quests (einzelne Aufgaben), Dailies (Gewohnheiten) und Kampagnen (längerfristige Ziele). Später ist eine öffentliche Nutzung möglich, aber nicht beschlossen. Registrieren kann sich jede Person mit bestätigter E-Mail-Adresse; die Anmeldung bietet es als Nebenweg an.

Die App ist zugleich ein Lernprojekt für sauberes TypeScript und Architekturentscheidungen.

## Product Purpose

Ein Tagesplaner für Aufgaben, Gewohnheiten und Ziele, der den Alltag nicht als starre Checkliste behandelt. Seine Sprache ist die eines Rollenspiels: Man erledigt Quests und Dailies und bringt damit Kampagnen voran. Er verbindet, was jemand erreichen will, mit dem, was er heute tut, und zeigt ehrlich, wie es lief.

Erfolg heißt: Die App wird täglich benutzt, weil sie das Planen leichter macht, nicht weil sie Pflicht ist.

## Positioning

Vier Dinge zusammen, die andere Tracker meist getrennt halten:

- **Kampagnen und Dailies verbunden:** Quests bilden Hierarchien aus Kampagne, Questreihe und Quest; eine Quest kann ein Daily mit Zeitraum und Sollmenge verlinken, etwa 20 Läufe bis Dezember.
- **Planen nach Tag und Reihenfolge:** Eine Quest hat ihren Tag, nur ein Termin hat eine Uhrzeit. Was heute ansteht, zieht man in die Reihenfolge, in der man es angehen will; Offenes wandert mit einem Schritt auf morgen. Termine stehen in beide Richtungen im eigenen Google Kalender.
- **Reflexion und Warum:** Quests und Dailies tragen ein persönliches Warum. Ohne eigenes übernehmen sie das der Quest oder Kampagne darüber, und zwar live: Ändert sich das Warum der Kampagne, ändert es sich überall darunter; dazu kommen Tagesreflexion, Dailies im Wochensoll und Perfect Week je Kategorie.
- **Zeit erfassen:** Eine Stoppuhr misst die echte Arbeitszeit; die geplante Dauer ist nur ein Soll, das die Stoppuhr nicht anhält. Im Fokus-Modus steht eine einzige Quest im Blick. Was gemessen wurde, steht als Logbuch im Kalender neben dem Plan und, ab fünf Minuten, auch im eigenen Google Kalender.
- **Quest-Stunden statt Punkte:** Zeit auf Quests einer Kampagne zählt als Quest-Stunden, gemessen an einem Wochenziel in den Einstellungen und, wenn gewünscht, einem eigenen je Kampagne. Heute nennt den Stand in einer ruhigen Zeile; die Kampagnen stehen als Kacheln mit Farbe, Symbol, Wochenstand, Verlauf der letzten acht Wochen und Gesamtzeit. Ein verfehltes Ziel ist eine Zahl, keine Warnung; es gibt keine Punkte, Stufen oder Abzeichen.
- **Wochenrückblick:** Eine Seite je Woche schaut zurück. Oben ein ruhiges Dashboard auf einen Blick: Quest-Stunden gegen das Wochenziel, Tagesschnitt, Quest-Arbeit gegen Sonstiges, die Stunden je Tag und je Kampagne und die letzten acht Wochen. Darunter, wie weit jede Kampagne kam ("+4 Quests, 62 % → 71 %"), Dailies im Wochensoll und Perfect Week, was erledigt wurde, und drei Fragen zum Selbst-Beantworten: Was lief gut, was nicht, was ändere ich.
- **Notizen:** Jede Quest hat Notizen als formatierten Text (Überschriften, Listen, Checklisten, Zitate, Code, Links). Sie stehen im Fokus-Modus und im Bearbeiten-Dialog und speichern sich von selbst.

## Operating Context

Vor allem am Handy, als PWA oder Test-APK, häufig unterwegs und in kurzen Momenten: abhaken, Timer starten, verschieben. Der Desktop ergänzt das, etwa für größere Planung in den Kampagnen oder im Kalender.

Oberflächensprache ist Deutsch.

## Capabilities and Constraints

- Ansichten: Heute, Plan (die Woche als Brett aus sieben Tagen; am Desktop mit dem Questlog daneben, aus dem man Quests auf einen Tag zieht), Wochenrückblick (die Woche in Zahlen und drei Fragen), Fokus-Modus, Questlog, Kampagnen (Kacheln je Kampagne über dem ganzen Baum; eine Kachel öffnet ihre Kampagne), Kalender (Monat, Woche, Tag; neben dem Geplanten das Logbuch: am Tag die gemessenen Abschnitte auf einer Zeitachse, in der Woche die Zeit je Kampagne, im Monat die Zeit je Tag), Dailies, Kategorien, Einstellungen. Jede hat eine eigene Adresse (`#/heute`, `#/plan`, `#/questlog`, …), sodass Zurück und Neuladen funktionieren; Plan und Wochenrückblick halten auch die gezeigte Woche in der Adresse, die Kampagnen die geöffnete Kampagne.
- Tastatur am Desktop: einzelne Tasten öffnen die Ansichten (H, P, Q, C, K, R) und den Fokus-Modus (F), legen eine Quest an (N) und wirken auf die Zeile unter dem Mauszeiger oder mit dem Fokus (Leertaste Stoppuhr, X erledigen, T/D/W auf heute, morgen, nächsten Montag; dieselben Schritte stehen im Menü "Aktionen für …" jeder Zeile); Strg+Enter erledigt im Fokus-Modus, Strg+K öffnet das Befehlsmenü, "?" die Übersicht. Einzelne Tasten lassen sich je Gerät in den Einstellungen abschalten. Jede Taste tut nur, was auch ein Button tut. Einzelheiten in `docs/keyboard.md`.
- Darstellung: hell (warmer Apricot) oder dunkel (warmes Umbra), je Gerät in den Einstellungen und im Befehlsmenü wählbar; voreingestellt folgt die App dem Gerät, auch wenn es abends umschaltet. Einzelheiten in `docs/theme.md`.
- Navigation: am Handy vier Tabs und "Mehr"; ab 56rem eine obere Leiste mit den fünf Hauptansichten, "Mehr" für die übrigen und "Befehle"; ab 70rem (übliches PC-Fenster) stehen auch Wochenrückblick, Fokus und Dailies direkt darin, ab 82rem alle Ansichten mit Namen.
- Fachbegriffe: siehe Glossar. Daily und Ausführung (einzelner Lauf eines Dailys) sind zu unterscheiden.
- Technik: Vue 3, NestJS, PostgreSQL; Android über Capacitor als Hülle um die Web-App.
- Offen: ob und wann die App öffentlich wird.

## Glossar

Die Oberfläche spricht das Vokabular links. Code, API und Datenbank behalten die neutralen Namen rechts; die technische Doku in `docs/` verwendet die Code-Namen.

| Oberfläche | Bedeutung | Im Code |
|---|---|---|
| Quest | Einzelne Aufgabe, einmal zu erledigen | `todo` |
| Unter-Quest | Quest unterhalb einer anderen | `todo` mit `parentId` |
| Questreihe | Quest unterhalb einer Kampagne, die selbst Unter-Quests hat | `todo` mit Eltern und Kindern |
| Kampagne | Oberste Quest mit Unter-Quests, Farbe, Symbol oder Wochenziel: das längerfristige Ziel | Wurzel-`todo` |
| Daily | Gewohnheit mit veränderbarem Zeitplan | `habit` |
| Ausführung | Einzelner Lauf eines Dailys | `habit occurrence` |
| Questlog | Offene Quests ohne Tag | Backlog (`scheduledDate` leer) |
| Termin | Quest mit fester Uhrzeit | `todo` mit `timeOfDay` |
| Reihenfolge | In welcher Folge der Tag abgearbeitet wird | `dayPosition` |
| Logbuch | Was erledigt und wie lange gearbeitet wurde | `history`, `work_logs` |
| Fokus-Modus | Eine Quest im Blick, mit Stoppuhr | – |
| Soll | Geplante Dauer; die Stoppuhr läuft darüber hinaus | `plannedDurationMinutes`, `targetMinutes` |
| Quest-Stunden | Gemessene Zeit auf Quests, die zu einer Kampagne gehören | `quest-hours` |
| Wochenziel | Quest-Stunden, die man pro Woche erreichen will, insgesamt oder je Kampagne | `weeklyQuestTargetMinutes`, `weeklyTargetMinutes` |
| Wochenrückblick | Rückschau auf eine Woche mit Zahlen, Fortschritt der Kampagnen und drei Antworten | `week-review`, `week_reviews` |
| Dailies im Wochensoll | Erledigte gegen fällige Ausführungen einer Woche; ein Wochenziel zählt mit seiner Sollzahl | `weekQuota` |

Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder eine Farbe, ein Symbol oder ein Wochenziel bekommt; ein eigenes Kampagnen-Feld gibt es nicht. Farbe, Symbol und Wochenziel gibt es nur für oberste Quests; wandert eine Kampagne unter eine andere Quest, verliert sie alle drei.

## Evidence on Hand

Es gibt keine Nutzerzahlen, Testimonials oder Fallstudien. Fachliche Dokumentation liegt in `docs/`.

## Product Principles

1. Planung passt sich dem Tag an, nicht umgekehrt.
2. Jede Quest und jedes Daily darf zeigen, wozu es dient.
3. Auswertungen sind ehrlich und nachvollziehbar, nicht beschönigend.
4. Häufige Handgriffe gehen am Handy schnell und mit einer Hand.
