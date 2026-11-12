---
version: 1
slug: "frontend-src-views-todayview-vue"
primary_target: "frontend/src/views/TodayView.vue"
related_targets: ["frontend/src/App.vue"]
---

# Surface: Heute

Mode: Operate. Mobile-first (Handy, eine Hand, kurze Momente); Desktop ergänzt.

Job: In 10 Sekunden sehen, was jetzt dran ist, wozu, und was danach kommt; abhaken, Timer starten, Liegengebliebenes nachholen.

Constraints: Vue 3, Deutsch, bestehende Fachlogik (verschieben, überspringen, feste Termine) bleibt. Backend liefert Warum, Zielstand und Arbeitsminuten für Heute. Tab-Leiste ersetzt die Navigation in allen Ansichten.

Anti-goals: Konfetti, Spielelemente, rote Schuld, austauschbare Kartenwand ohne Warum.

Open: Dark Mode später; übrige Ansichten ziehen die Tokens später nach.

## Direction contract

THESIS: Heute ist ein Fokus, kein Status-Stapel. Ein großer nächster Schritt mit seinem Warum, darunter der Tag als Zeitachse. Verweigert wird die Kategorie-Standardliste mit Überfällig-Block oben und gleich gewichteten Karten.

OWN-WORLD: Warmer Apricot-Grund, weiße Karten mit großen weichen Ecken, runde humanistische Schrift (Nunito) in komfortablen Größen, tabellarische Ziffern. Genau eine kräftige Aktionsfarbe (Orange) nur auf Antippbarem: Haken, Primär-Button, aktiver Tab. Flache Farbe, keine Verläufe, kaum Schatten. Kategorien als kleine Farbmarke.

STORY: Wer öffnet, sieht sofort den nächsten Eintrag und warum er zählt, tippt Erledigt, bekommt eine ruhige Bestätigung mit Rückgängig und sieht den Fortschritt im Kopf wachsen. Liegengebliebenes ist ein Angebot, kein Vorwurf.

FIRST VIEWPORT: Oben Wochentag-Datum groß, darunter Fortschrittszeile. Dann die weiße Fokuskarte über die volle Breite: Kategorie, Titel 22px, Warum, Zielstand, großer orangefarbener Erledigt-Button (48px) plus Timer. Darunter "Danach: …", die Nachholen-Zeile und der Beginn der Zeitachse mit Jetzt-Linie. Unten die feste Tab-Leiste mit fünf Zielen, Plus-Button darüber ohne Überdeckung.

FORM: Challenger digital-design-canon-warm-consumer-app-surface, gewählt statt Position 7 der eigenen Liste (Gartenkalender). Signature move: Aktionsfarbe ausschließlich auf Antippbarem plus federnder Druck; der Fokus mit sichtbar wartendem nächsten Eintrag. seed:98c95900551301ce

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
