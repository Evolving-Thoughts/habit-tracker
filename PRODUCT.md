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
- **Reflexion und Warum:** Quests und Dailies tragen ein persönliches Warum. Ohne eigenes übernehmen sie das der Quest oder Kampagne darüber, und zwar live: Ändert sich das Warum der Kampagne, ändert es sich überall darunter; dazu kommen Tagesreflexion, Wochenquote und Perfect Week je Kategorie.
- **Zeit erfassen:** Eine Stoppuhr misst die echte Arbeitszeit; die geplante Dauer ist nur ein Soll, das die Stoppuhr nicht anhält. Im Fokus-Modus steht eine einzige Quest im Blick.
- **Notizen:** Jede Quest hat Notizen als formatierten Text (Überschriften, Listen, Checklisten, Zitate, Code, Links). Sie stehen im Fokus-Modus und im Bearbeiten-Dialog und speichern sich von selbst.

## Operating Context

Vor allem am Handy, als PWA oder Test-APK, häufig unterwegs und in kurzen Momenten: abhaken, Timer starten, verschieben. Der Desktop ergänzt das, etwa für größere Planung in den Kampagnen oder im Kalender.

Oberflächensprache ist Deutsch.

## Capabilities and Constraints

- Ansichten: Heute, Plan (die Woche als Brett aus sieben Tagen), Fokus-Modus, Questlog, Kampagnen, Kalender (Monat, Woche, Tag), Dailies, Kategorien, Einstellungen. Jede hat eine eigene Adresse (`#/heute`, `#/plan`, `#/questlog`, …), sodass Zurück und Neuladen funktionieren; der Plan hält auch die gezeigte Woche in der Adresse.
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
| Kampagne | Oberste Quest mit Unter-Quests: das längerfristige Ziel | Wurzel-`todo` |
| Daily | Gewohnheit mit veränderbarem Zeitplan | `habit` |
| Ausführung | Einzelner Lauf eines Dailys | `habit occurrence` |
| Questlog | Offene Quests ohne Tag | Backlog (`scheduledDate` leer) |
| Termin | Quest mit fester Uhrzeit | `todo` mit `timeOfDay` |
| Reihenfolge | In welcher Folge der Tag abgearbeitet wird | `dayPosition` |
| Logbuch | Was erledigt und wie lange gearbeitet wurde | `history`, `work_logs` |
| Fokus-Modus | Eine Quest im Blick, mit Stoppuhr | – |
| Soll | Geplante Dauer; die Stoppuhr läuft darüber hinaus | `plannedDurationMinutes`, `targetMinutes` |

Eine Quest wird zur Kampagne, sobald sie Unter-Quests hat; es gibt dafür kein eigenes Feld.

## Evidence on Hand

Es gibt keine Nutzerzahlen, Testimonials oder Fallstudien. Fachliche Dokumentation liegt in `docs/`.

## Product Principles

1. Planung passt sich dem Tag an, nicht umgekehrt.
2. Jede Quest und jedes Daily darf zeigen, wozu es dient.
3. Auswertungen sind ehrlich und nachvollziehbar, nicht beschönigend.
4. Häufige Handgriffe gehen am Handy schnell und mit einer Hand.
