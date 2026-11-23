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

- **Kampagnen und Dailies verbunden:** Quests bilden Hierarchien aus Kampagne, Questreihe und Quest; im Editor wählt "Gehört zu" den Platz (eine noch fehlende Kampagne entsteht dort beim Tippen), und jede Karte bietet "In Kampagne verschieben …". Ein Daily gehört direkt zu einer Kampagne; eine Quest kann außerdem ein Daily mit Zeitraum und Sollmenge verlinken, etwa 20 Läufe bis Dezember.
- **Planen nach Tag und Reihenfolge:** Eine Quest hat ihren Tag, nur ein Termin hat eine Uhrzeit. Was heute ansteht, zieht man in die Reihenfolge, in der man es angehen will; Offenes wandert mit einem Schritt auf morgen. Termine stehen in beide Richtungen im eigenen Google Kalender.
- **Reflexion und Warum:** Quests und Dailies tragen ein persönliches Warum. Ohne eigenes übernehmen sie das der Quest oder Kampagne darüber, ein Daily das seiner Kampagne (sonst das der Quest, die es zählt), und zwar live: Ändert sich das Warum der Kampagne, ändert es sich überall darunter; dazu kommen Tagesreflexion, Dailies im Wochensoll und Perfect Week je Kategorie.
- **Zeit erfassen:** Eine Stoppuhr misst die echte Arbeitszeit und zählt bei einer Quest, an der schon gearbeitet wurde, von der geloggten Zeit weiter; die geplante Dauer ist nur ein Soll, das die Stoppuhr nicht anhält, sein Erreichen meldet sie einmal in der App und als Benachrichtigung. Eine Pause unter einer Minute gehört zur Arbeit, ein Abschnitt unter einer Minute zählt nicht. Im Fokus-Modus steht eine einzige Quest im Blick, ohne Vorschau auf die nächste; ein Termin wird erst eine Viertelstunde vorher genannt. Was gemessen wurde, steht als Logbuch im Kalender mit dem Plan auf einer Zeitachse, lässt sich dort durch Ziehen seiner Ränder oder im Dialog korrigieren und steht, ab fünf Minuten, auch im eigenen Google Kalender.
- **Kampagnen-Stunden statt Punkte:** Zeit auf Quests einer Kampagne und auf Dailies, die zu ihr gehören, zählt als Kampagnen-Stunden, gemessen an einem Wochenziel (in den Einstellungen oder direkt im Wochenrückblick gesetzt, in Stunden und Minuten; eine Änderung gilt ab der laufenden Woche, vergangene Wochen behalten ihr Ziel) und, wenn gewünscht, einem eigenen je Kampagne. Heute nennt den Stand in einer ruhigen Zeile mit schmalem Balken; die Kampagnen stehen als Kacheln mit Farbe, Symbol, Wochenstand, Verlauf der letzten acht Wochen und Gesamtzeit. Ein verfehltes Ziel ist eine Zahl, keine Warnung; ebenso die Serie eines Dailys ("12 in Folge · Rekord 21"), auch wenn sie gerissen ist. Es gibt keine Punkte, Stufen oder Abzeichen.
- **Wochenrückblick:** Eine Seite je Woche schaut zurück. Oben ein ruhiges Dashboard auf einen Blick: vier Kennzahlen (Kampagnen-Stunden gegen das Wochenziel dieser Woche, das man in der laufenden Woche dort gleich ändern kann; Tagesschnitt; Anteil der Kampagnen-Arbeit; Dailies im Wochensoll mit der Perfect Week je Kategorie in einer Zeile), dann die Stunden je Tag und je Kampagne, Kampagnen-Arbeit gegen Sonstiges und die letzten acht Wochen, jede Woche als Säule aus Kampagnen-Arbeit und Sonstigem. Darunter, wie weit jede Kampagne kam ("+4 Quests, 62 % → 71 %"), was erledigt wurde (am Desktop als Woche in sieben Spalten), und drei Fragen zum Selbst-Beantworten: Was lief gut, was nicht, was ändere ich.
- **Das Beste des Tages:** Jeden Tag eine kurze Zeile (höchstens 280 Zeichen) über den schönsten oder eindrücklichsten Moment, nur für sich. Heute fragt abends ruhig danach (ab einer Uhrzeit, die man in den Einstellungen wählt, voreingestellt 20:00; vorher keine Karte), der Kalender-Tag hält sie neben der Reflexion, auch für vergangene Tage, und eine eigene Ansicht blättert durch das Jahr zurück, mit "Heute vor einem Jahr". Eine Stunde nach der Uhrzeit erinnert, wer es will, eine Benachrichtigung, solange der Tag noch keine Zeile hat, höchstens einmal am Tag. Keine Serie, keine Zählung, die mahnt.
- **Notizen:** Jede Quest und jeder einzelne Lauf eines Dailys hat Notizen als formatierten Text (Überschriften, Listen, Checklisten, Zitate, Code, Links). Sie stehen im Fokus-Modus und im Bearbeiten-Dialog, speichern sich von selbst und lassen sich im Befehlsmenü durchsuchen.

## Operating Context

Vor allem am Handy, als PWA oder Test-APK, häufig unterwegs und in kurzen Momenten: abhaken, Stoppuhr starten, verschieben. Der Desktop ergänzt das, etwa für größere Planung in den Kampagnen oder im Kalender.

Oberflächensprache ist Deutsch.

## Capabilities and Constraints

- Ansichten, in der Reihenfolge der Navigation: Heute (die Liste des Tages, Termine darin nach ihrer Uhrzeit; am Desktop daneben der Tageskalender), Fokus-Modus, Kalender (Monat, Woche, Tag; Geplantes, Erledigtes und die gemessenen Abschnitte des Logbuchs stehen je Tag in einer Spalte auf einer Stundenachse: am Tag neben der Liste des Tages, in der Woche sieben Spalten mit gearbeiteter Zeit und dem, was jeder Tag ohne Uhrzeit hält; im Monat die Zeit je Tag und die Liste des gewählten Tages mit seinen Quests und Daily-Läufen), Plan (ein Brett, das mit heute beginnt: ganz links das Questlog, aus dem man Quests auf einen Tag zieht und wieder zurück, daneben, was liegen geblieben ist, dann heute und so viele kommende Tage, wie in die Breite passen; jeder Tag und das Questlog tragen oben ihr Schnell-Anlegen; die Läufe der Dailies sind Karten wie auf Heute: antippen öffnet sie mit den Notizen des Laufs, ziehen sortiert sie oder verschiebt sie auf einen anderen Tag, so weit ihr Lauf warten darf), Questlog (die offenen Quests ohne Tag, an denen man arbeiten kann, in der Reihenfolge, in die man sie zieht; das Schnell-Anlegen legt oben oder unten an), Kampagnen (oben die Kampagnen-Stunden dieser Woche und insgesamt und wie viele Kampagnen laufen und abgeschlossen sind, darunter eine Kachel je Kampagne mit "Abschließen" und zuletzt "Neue Kampagne"; eine Kachel öffnet ihre Kampagne mit ihren Quests, und der Plus-Button legt dort eine Quest darin an), Dailies (nach Kategorie gruppiert und nach Kategorie und Kampagne filterbar, jedes mit seinem Warum, dem Stand der Woche, seiner Serie und, wo heute ein Lauf fällig ist, dem Haken dafür), Wochenrückblick (die Woche in Zahlen, das Beste ihrer Tage und drei Fragen), Das Beste (die Zeilen des Besten des Tages, neueste zuerst, nach Monaten mit "12 von 30 Tagen"; Tage ohne Zeile fehlen, ältere Monate laden beim Scrollen, "Monat wählen" springt zu jedem Monat mit Zeilen, ein Tipp ändert eine Zeile an Ort und Stelle; oben "Heute vor einem Jahr", wenn es diesen Tag gab), Einstellungen (dort auch die Kategorien mit ihrem Wochensoll und ihrer Farbe). Jede hat eine eigene Adresse (`#/heute`, `#/plan`, `#/questlog`, …), sodass Zurück und Neuladen funktionieren; der Plan hält auch den ersten gezeigten Tag in der Adresse (`#/plan?ab=…`; alte Links mit einer Woche führen zu deren erstem Tag ab heute), der Wochenrückblick die gezeigte Woche, Das Beste den gezeigten Monat oder Tag (`#/das-beste?monat=…`, `?tag=…`), die Kampagnen die geöffnete Kampagne, die Dailies ihren Filter. Die alte Adresse `#/kategorien` führt zum Abschnitt Kategorien in den Einstellungen.
- Anlegen und Bearbeiten: Der Plus-Dialog beginnt mit der Wahl "Quest | Daily"; eine schon angelegte offene Quest ohne Unter-Quests lässt sich im Editor ebenso zum Daily machen (es übernimmt Titel, Warum, Kategorie und Kampagne, danach wird die Quest gelöscht). Kategorie und Kampagne wählt man durch Tippen; ein neuer Name legt sie an. Wer eine Quest einer Kampagne zuordnet, sieht deren Warum als übernommenes und bekommt ihre Kategorie vorgeschlagen. Eine Kampagne zeigt im Editor nur, was zu ihr passt (Titel, Warum, Kategorie, Farbe, Symbol, Wochenziel, Notizen). "Löschen" steht in jeder Ansicht zuletzt im Menü "…" jeder Karte, mit derselben Rückfrage wie im Editor.
- Tastatur am Desktop: einzelne Tasten öffnen die Ansichten in der Reihenfolge der Leiste (H Heute, F Fokus-Modus, K Kalender, P Plan, Q Questlog, C Kampagnen, A Dailies, R Wochenrückblick, B Das Beste, Komma Einstellungen), legen eine Quest an (N) und wirken auf die Zeile unter dem Mauszeiger oder mit dem Fokus (Leertaste Stoppuhr, X erledigen, T/D/W auf heute, morgen, nächsten Montag; dieselben Schritte stehen im Menü "Aktionen für …" jeder Zeile); im Plan verschieben die Pfeiltasten eine Karte mit dem Fokus (hoch und runter in der Reihenfolge, links und rechts einen Tag); "Nach oben" und "Nach unten" im Menü sortieren den Tag und das Questlog; Strg+Enter erledigt im Fokus-Modus, Strg+K öffnet das Befehlsmenü, "?" die Übersicht. Einzelne Tasten lassen sich je Gerät in den Einstellungen abschalten. Jede Taste tut nur, was auch ein Button tut. Einzelheiten in `docs/keyboard.md`.
- Suche: Das Befehlsmenü (Strg+K oder die Lupe "Befehle") findet außer Ansichten und Befehlen ab zwei Zeichen Kampagnen, Quests (offene und in den letzten 30 Tagen erledigte) und Dailies nach ihrem Titel und Text in den Notizen von Quests und Läufen, in Tagesreflexionen, im Besten des Tages und in den Antworten des Wochenrückblicks, jeweils mit einem kurzen Ausschnitt um den Treffer; Groß- und Kleinschreibung und Akzente zählen nicht. Ein Treffer öffnet die Quest oder das Daily im Editor (bei Notizen dort, wo sie stehen), die Kampagne, den Tag im Kalender, den Tag in Das Beste oder die Woche im Wochenrückblick; eine offene Quest bietet daneben "Stoppuhr starten" und "Zur Kampagne". Dort legt man auch eine neue Quest, Kampagne oder ein neues Daily an. Einzelheiten in `docs/search.md`.
- Darstellung: hell (warmer Apricot) oder dunkel (warmes Umbra), je Gerät in den Einstellungen und im Befehlsmenü wählbar; voreingestellt folgt die App dem Gerät, auch wenn es abends umschaltet. Einzelheiten in `docs/theme.md`.
- Navigation: am Handy eine Leiste unten mit vier Tabs (Heute, Kalender, Questlog, Kampagnen) und "Mehr"; ab 56rem oder bei Bedienung mit Maus oder Trackpad eine obere Leiste, in der jede Ansicht ihren beschrifteten Tab hat, nach Absicht gruppiert (Heute · Fokus | Kalender · Plan · Questlog | Kampagnen · Dailies | Wochenrückblick · Das Beste), ganz rechts "Befehle" als Lupe und Einstellungen als Zahnrad. Eine neue Ansicht beginnt oben und bleibt dort, während sie lädt; Zurück kehrt an die gemerkte Stelle zurück.
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
| Daily | Gewohnheit mit veränderbarem Zeitplan; kann zu einer Kampagne gehören | `habit` (`campaignId`) |
| Ausführung | Einzelner Lauf eines Dailys, mit eigenen Notizen | `habit occurrence` |
| Questlog | Offene Quests ohne Tag, an denen man arbeiten kann, in eigener Reihenfolge | Backlog (`scheduledDate` leer, keine offene Quest darunter, keine Kampagne; `backlogTodos`, `backlogPosition`) |
| Liegen geblieben | Offenes von einem früheren Tag; Heute nennt es "von früher" (Nachholen), der Plan zeigt es in eigener Spalte | überfällig (`isOverdue`, `overdueTodos`) |
| Termin | Quest mit fester Uhrzeit | `todo` mit `timeOfDay` |
| Reihenfolge | In welcher Folge der Tag abgearbeitet wird | `dayPosition` |
| Logbuch | Was erledigt und wie lange gearbeitet wurde | `history`, `work_logs` |
| Fokus-Modus | Eine Quest im Blick, mit Stoppuhr; ein Termin erscheint erst 15 Minuten vorher als "Gleich um …" | – |
| Stoppuhr | Misst die echte Arbeitszeit und zählt hoch, ab der schon geloggten Zeit ihres Ziels; Pausen unter einer Minute setzen den Abschnitt fort; nie "Timer" in der Oberfläche | `timer` |
| Soll | Geplante Dauer; die Stoppuhr läuft darüber hinaus | `plannedDurationMinutes`, `targetMinutes` |
| Kampagnen-Stunden | Gemessene Zeit auf Quests, die zu einer Kampagne gehören, und auf Dailies dieser Kampagne; Heute nennt sie als Teil der gearbeiteten Zeit ("davon … auf Kampagnen") | `quest-hours` |
| Fortschritt | Erledigte gegen alle Quests unter einer Kampagne oder Questreihe, nie sie selbst | `progress`, `goal_snapshots` |
| Wochenziel | Kampagnen-Stunden, die man pro Woche erreichen will, insgesamt oder je Kampagne; das gesamte gilt ab der Woche, in der man es setzt, frühere Wochen behalten ihres | `weekly_quest_targets` (`weeklyTargetMinutes` in der API), `todos.weeklyTargetMinutes` |
| Wochenrückblick | Rückschau auf eine Woche mit Zahlen, Fortschritt der Kampagnen und drei Antworten | `week-review`, `week_reviews` |
| Das Beste des Tages | Eine kurze Zeile je Tag über den schönsten oder eindrücklichsten Moment, nur für sich; die Ansicht dazu heißt "Das Beste" | `day-best`, `day_bests`, `day_best_settings` (`docs/day-best.md`) |
| Dailies im Wochensoll | Erledigte gegen fällige Ausführungen einer Woche; ein Wochenziel zählt mit seiner Sollzahl | `weekQuota` |
| Serie | Wie viele fällige Ausführungen eines Dailys zuletzt hintereinander erledigt wurden ("12 in Folge"), dazu der Rekord; Übersprungenes zählt nicht und unterbricht nicht, eine verpasste Ausführung unterbricht, die heute noch offene nicht; ein Wochenziel zählt Wochen. Eine Zahl, nie eine Warnung | `streak` (`docs/streaks.md`) |

Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder eine Farbe, ein Symbol oder ein Wochenziel bekommt; ein eigenes Kampagnen-Feld gibt es nicht. Farbe, Symbol und Wochenziel gibt es nur für oberste Quests; wandert eine Kampagne unter eine andere Quest, verliert sie alle drei.

Das Questlog führt nur, woran man arbeiten kann: Eine Quest mit offenen Quests darunter (eine Questreihe) wird über diese erledigt, und eine Kampagne wird über ihre Quests geplant, auch solange sie nur wegen Farbe, Symbol oder Wochenziel eine ist. Beide stehen in den Kampagnen, nicht im Questlog. Eine Questreihe, deren Quests alle erledigt sind, ist wieder ein Schritt und steht dort. Umgekehrt zeigen die Kampagnen nur Kampagnen; eine lose oberste Quest ohne Unter-Quests lebt im Questlog, in Heute und im Plan.

## Evidence on Hand

Es gibt keine Nutzerzahlen, Testimonials oder Fallstudien. Fachliche Dokumentation liegt in `docs/`.

## Product Principles

1. Planung passt sich dem Tag an, nicht umgekehrt.
2. Jede Quest und jedes Daily darf zeigen, wozu es dient.
3. Auswertungen sind ehrlich und nachvollziehbar, nicht beschönigend.
4. Häufige Handgriffe gehen am Handy schnell und mit einer Hand.
