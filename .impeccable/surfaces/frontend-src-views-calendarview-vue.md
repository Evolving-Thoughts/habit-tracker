---
version: 1
slug: "frontend-src-views-calendarview-vue"
primary_target: "frontend/src/views/CalendarView.vue"
related_targets: ["frontend/src/views/AuthView.vue"]
---

# Surface: Kalender (Rückblick und Vorschau)

Mode: Operate. Mobile-first; Desktop ergänzt.

Job: Einen Tag, eine Woche oder einen Monat überblicken: wie es lief, was offen ist, was kommt. Ersetzt die frühere Trennung von Kalender und Verlauf.

Sequence:
- Kopf: Zeitraum als Titel, darunter eine Zeile mit Monat · Woche · Tag, vor/zurück, Heute, Datum; Filter Alle/Todos/Habits als Chips.
- Monat: Raster mit ruhigen Punkten (erledigt, offen, Termin) und Legende; der gewählte Tag zeigt seine Einträge darunter.
- Woche: zuerst Wochenquote und Perfect Week je Kategorie, dann Wochenziele, dann sieben Tageszeilen.
- Tag: zuerst Reflexion, dann Erledigt, Übersprungen, Offen; Zeit nachtragen eingeklappt; künftige Tage mit Verschieben.

Anti-goals: Warnrot oder Orange für Überfälliges, blaue Buttons, eine Wand aus Steuerelementen vor dem Inhalt, Erklärabsätze.

Anmeldung (related): eine ruhige Karte, Anmelden als einziger Primär-Button, „Passwort vergessen?“ und „Konto erstellen“ als dezente Links.

Visual authority: DESIGN.md (warme App-Oberfläche aus dem Heute-Brief).
