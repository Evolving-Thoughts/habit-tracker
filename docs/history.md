# Verlauf: Tag und Woche

„Verlauf“ zeigt gespeicherte erledigte Todos und erledigte/übersprungene Habit-Ausführungen. Es ist eine reine Leseansicht: kein Timerstart, keine Bearbeitung, kein Nachtragen vergangener Ausführungen beim Öffnen. Für heute und zukünftige Tage/Wochen ergänzt eine schreibfreie Vorausschau die gespeicherte Historie.

## Anzeige

- Tagesansicht: Bereiche **Offen / geplant**, **Erledigt** und **Übersprungen** mit Anzahl; Wochenziele ohne festen Tag stehen separat.
- Wochenansicht: Montag–Sonntag, sieben Tage mit den Zählern ungleich null („2 erledigt · 1 offen“). Ein Tag ohne Einträge heißt „Nichts geplant“; wurde an ihm trotzdem Zeit gemessen, sagt die Zeile es mit („Nichts geplant · 2 Std. 10 Min. gemessen“). „Tag öffnen“ führt zum gewählten Tag.
- Kopf in zwei Zeilen: der Zeitraum als Titel, der die Datumsauswahl öffnet, daneben der Filter **Alle / Quests / Dailies** als leiser Icon-Button (ein gewählter Filter nennt sich); darunter Monat · Woche · Tag und voriger/nächster Zeitraum. „Heute“ erscheint nur, wenn der gezeigte Zeitraum heute nicht enthält (`rangeContains`). Es gibt keinen Aktualisieren-Button; die Ansicht lädt bei Änderungen anderswo selbst neu.
- Tagesansicht mit Zeitachse: siehe `logbook.md` (Spuren „Geplant“ und „Gemessen“, Erledigtes als Marke zur Zeit des Abhakens, Achse vom frühesten bis zum spätesten Eintrag, „Zeit nachtragen“ eingeklappt).
- DD.MM.YYYY für Ausgaben; native Datumseingaben folgen der Browser-/Gerätesprache. API-Daten bleiben YYYY-MM-DD/ISO-Zeitpunkte.
- Alle Tageszuordnungen und angezeigten Uhrzeiten verwenden **Europe/Berlin**, einschließlich Sommer-/Winterzeit.

## Zuordnung und Grenzen

- Todos: tatsächlicher `completedAt`-Tag, nicht ihr geplanter Termin. Ein erledigtes Dump-Todo bleibt ungeplant, erscheint aber im Verlauf des Erledigungstags. Ein abweichender geplanter Tag wird separat angezeigt.
- Habits erledigt: gespeicherter `resolvedDate`-Tag. Neue manuelle Erledigungen speichern außerdem `resolvedAt`, auch beim Erledigen über den Timer. Wiederholte identische Statusänderungen behalten den Zeitpunkt. Ältere Ergebnisse ohne diesen neuen Zeitpunkt zeigen keine erfundene Uhrzeit.
- Habits übersprungen: ursprünglicher `scheduledDate`-Tag, auch wenn der Generator das Überspringen erst später speichert. `resolvedDate` des Nachtrags verschiebt die Statistik nicht auf den Nachtragstag.
- Offene und abgebrochene/cancelled Ausführungen erscheinen nicht als erledigt/übersprungen.
- Soft-gelöschte Todos/Habits behalten ihre Ergebnisse, mit Hinweis **Gelöscht**. Pausierte Habits behalten ihre bisherigen Ergebnisse. Endgültiges Entfernen aus der Datenbank ist kein durch diese Ansicht angebotener Vorgang.
- Wieder geöffnete Todos/Ausführungen verlieren den aktuellen Erledigungseintrag. Es gibt noch kein unveränderliches Ereignisjournal für jede Erledigung/Wiederöffnung.
- Karten nutzen den gespeicherten aktuellen Titel. Umbenennen verändert daher auch den angezeigten Titel früherer Ergebnisse; Titel-Snapshots sind nicht Bestandteil dieses PRs.
- Die Dauer an einem Eintrag ist die **geplante**. Für Habits wird die konkrete Ausführungsdauer bevorzugt, ansonsten die aktuelle Standarddauer genutzt. Die tatsächlich gemessene Arbeitszeit steht getrennt davon im Logbuch jedes Tages (`days[].work`, siehe `logbook.md`).
- Als erledigt/übersprungen werden nur bereits gespeicherte Ausführungen angezeigt. Wenn der Generator verpasste Termine noch nicht verarbeitet hat, tauchen deren Skips erst nach regulärer Generierung (z.B. „Heute“) auf. Der Verlauf selbst schreibt keine Nachträge.

## Offen / geplant in Tag und Woche

- Heute und zukünftige Tage sowie aktuelle und zukünftige Wochen zeigen **Offen / geplant** pro Tag, getrennt von Erledigt/Übersprungen. Beide Ansichten nutzen dieselbe Terminberechnung und dieselben schreibfreien Leseabfragen.
- Nicht erledigte, nicht gelöschte Todos mit Termin stehen am geplanten Berlin-Tag. Überfällige Todos aus beliebig früheren Tagen stehen ausschließlich heute in der aktuellen Woche, markiert **überfällig seit …**. Ungeplante Dump-Todos werden keinem Tag zugewiesen.
- Vergangene Tage und Wochen enthalten keine offenen Einträge und keine Wochenziel-Vorausschau. Vergangene Tage der laufenden Woche zeigen keine ungelösten Aufgaben rückwirkend.
- Intervalle und feste Wochentage werden im Speicher aus den gültigen, nicht stornierten Regelversionen berechnet; inklusive Beginn, exklusivem Ende, Intervallanker und Missed-Occurrence-Policy. Ein noch gültiger Carry-over-Habit-Termin erscheint heute mit seinem ursprünglichen Termin; abgelaufene Slots werden nicht als offen erfunden.
- Bereits erledigte, übersprungene und abgebrochene Slots sind nicht zusätzlich geplant. Eine heutige Habit-Erledigung verhindert einen weiteren offenen Slot heute, wie in der bestehenden Terminlogik. Pausierte und gelöschte Habits werden nicht prognostiziert.
- **Wochenziele** stehen separat ohne erfundene Ausführungstage. Angezeigt werden Ziel, bekannte Erledigungen und verbleibende Ausführungen, mindestens null. Wie beim Scheduler zählen alle Erledigungen dieses Habits in der Kalenderwoche, auch unter vorherigen Regeln. Bei Regelwechseln wird jede im ausgewählten Zeitraum gültige Wochenzielversion mit ihrem verbleibenden Gültigkeitsbereich angezeigt. Auch in der Tagesansicht zählt der Fortschritt die zugehörige ganze Kalenderwoche, nicht nur den ausgewählten Tag.
- Die Vorschau ist der aktuelle Planungsstand, keine Garantie zukünftiger Erledigungen oder Aktivität. Bekannte zukünftige Regelwechsel werden berücksichtigt; heutige Pausen/Standarddauern/Titel gelten, bis sie geändert werden. Weder Forecasts noch fehlende Skips werden gespeichert, keine Generation/Reconciliation wird angestoßen.

## API

`GET /history?date=2026-10-07&view=day&filter=all`

- `date` optional: aktueller Berlin-Tag.
- `view`: `day` (Standard) oder `week`; für Woche wird das Datum auf die zugehörige Montag–Sonntag-Woche abgebildet.
- `filter`: `all` (Standard), `todos`, `habits`.
- Antwort: `today`, `timeZone`, `startDate`, `endDate`, `days: [{date, items, work}]`. Beide Ansichten liefern `days[].planned` und `weeklyTargets` (für vergangene Tage/Wochen leer). `days[].work` ist das Logbuch des Tages (gemessene Minuten; in Tag und Woche auch die Anteile je Kampagne und die einzelnen Abschnitte), Tag und Monat liefern zusätzlich `days[].external` (Termine der gelesenen Google-Kalender). Erledigte Einträge tragen `timeOfDay`, wenn sie eine Uhrzeit hatten. Geplante Einträge haben stabile `key`s; berechnete Habit-Slots haben `id: null`, gespeicherte offene Einträge ihre reale ID. Auch leere Tage werden zurückgegeben; IDs sind zusammen mit `type` eindeutig.
- Gültige Kalenderdaten und begrenzter Bereich von einem Tag oder sieben Tagen. Jahr mindestens 1000; inklusive exklusiver oberer Query-Grenze höchstens 9999. Ungültige/mehrfach angegebene Parameter und unbekannte Optionen: 400.
- Authentifiziert, ausschließlich eigene Daten, `Cache-Control: no-store`. Kein Nutzer-ID-Parameter und keine private API-Zwischenspeicherung im Service Worker.
- Alle Datenabfragen laufen in einer read-only verwendeten Repeatable-Read-Transaktion für einen konsistenten Snapshot. Keine Abhängigkeit vom Occurrence-Generator.

## Entwicklung und Tests

Kein DB-Reset nötig. Die nullable Spalte `habit_occurrences.resolvedAt` wird durch das bestehende Entwicklungsschema-Synchronize angelegt. Produktiv ist dafür eine explizite Migration nötig; keine erfundene Rückfüllung alter Uhrzeiten.

Tests prüfen zusätzlich überfällige/geplante Todos, Intervall-/Wochentagsprognosen, Regelwechsel, Wochenzielzählung, Filter und unveränderte Datenbankzeilen beim Lesen. Tests prüfen Nutzertrennung einschließlich gelöschter Beziehungen, Berlin-Mitternacht und beide DST-Wechsel, Montag/Jahreswechsel, verspätete Erledigungen, geplante Skip-Tage, Soft-Delete, Reopen, idempotente Erledigung, reine Lesezugriffe, Filter, Leer-/Fehlerzustände und veraltete Frontend-Antworten. Browser-E2E nutzen die echten App-/API-/Datenbank-Komponenten.

Seitdem hinzugekommen: Monatsansicht, Wochenquote (in der Oberfläche "Dailies im Wochensoll") und Perfect Week sowie das Logbuch der gemessenen Arbeitszeit (`logbook.md`). Die Dailies lesen dieselbe Woche (`GET /history?view=week&filter=habits` für die laufende Woche) für den Stand jedes Dailys: ein Wochenziel aus `weeklyTargets` („2 von 3 diese Woche“), ein Zeitplan aus den erledigten, übersprungenen und offenen Ausführungen von heute und den offenen der restlichen Woche („heute fällig“, „heute erledigt“, „Freitag fällig“, sonst „diese Woche nicht mehr fällig“; `dailyWeekStatus` in `utils/habit.ts`). Eine eigene Schnittstelle braucht das nicht. Noch nicht enthalten: Streaks und unveränderliche Ereignis-Snapshots.
