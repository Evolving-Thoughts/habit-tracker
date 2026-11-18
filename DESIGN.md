---
name: Habit-Tracker
description: Warmer, ruhiger Tagesplaner für Quests, Dailies und Kampagnen, gebaut für eine Hand am Handy.
colors:
  ground: "#fde4d0"
  ground-deep: "#f9d3b5"
  surface: "#ffffff"
  surface-raised: "#ffffff"
  surface-flat: "rgb(255 255 255 / 55%)"
  line: "#f1cfb4"
  line-strong: "#a07d66"
  ink: "#2b1d16"
  ink-muted: "#6b4d3d"
  ink-soft: "#7a5846"
  action: "#c2410c"
  action-strong: "#9a330a"
  action-tint: "#fff1e8"
  action-tint-hover: "#ffe2cf"
  on-action: "#ffffff"
  success: "#2e7d4f"
  danger: "#b42318"
  danger-tint: "#fff0ec"
  mark-moss: "#6d8b5a"
  mark-pine: "#3e6650"
  mark-sage: "#588880"
  mark-slate: "#4f7c99"
  mark-indigo: "#5b5f9e"
  mark-heather: "#9a6b9e"
  mark-plum: "#7a4a6c"
  mark-berry: "#a8566e"
  mark-walnut: "#8c6b55"
  mark-ochre: "#a07c33"
  mark-none: "#a38d7a"
typography:
  display:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(1.75rem, 7vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 6vw, 1.875rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.3
  body-large:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.45
    fontFeature: "tnum"
  nav-label:
    fontFamily: "Nunito Variable, ui-rounded, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  control: "0.875rem"
  card: "1.375rem"
  pill: "999px"
  key: "0.375rem"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  tap: "2.75rem"
  tap-large: "3rem"
  tab-bar-height: "4.25rem"
  page-width: "46rem"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.control}"
    padding: "0 1.5rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.action-strong}"
  button-primary-pill:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.tap}"
  button-primary-disabled:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.ink-soft}"
  button-tinted:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-strong}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.tap}"
  button-on-ground:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.action-strong}"
    rounded: "{rounded.pill}"
    padding: "0 1rem 0 0.75rem"
    height: "{spacing.tap}"
  button-quiet:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.tap}"
  button-quiet-hover:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-strong}"
  button-danger:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.tap}"
  button-link:
    textColor: "{colors.action-strong}"
    padding: "0 0.5rem"
    height: "{spacing.tap}"
  icon-button-timer:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-strong}"
    rounded: "50%"
    size: "{spacing.tap}"
  icon-button-timer-hover:
    backgroundColor: "{colors.action-tint-hover}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.4}"
  card-focus:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1.5rem 1.5rem 1rem"
  planner-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0.5rem 1rem 0.75rem 0.75rem"
  catch-up-panel:
    backgroundColor: "{colors.ground-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  empty-state:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.card}"
    padding: "2rem 1.5rem"
  alert:
    backgroundColor: "{colors.danger-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.4}"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "{spacing.tap}"
  segmented:
    backgroundColor: "{colors.ground-deep}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "{spacing.1}"
  segmented-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  chip:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "{spacing.tap}"
  chip-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  progress-bar:
    backgroundColor: "{colors.ground-deep}"
    rounded: "{rounded.pill}"
    height: "0.625rem"
  action-menu:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  tab-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    height: "{spacing.tab-bar-height}"
  tab-bar-active:
    textColor: "{colors.action}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 0.5rem 0.5rem 1rem"
  kbd:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.key}"
    height: "1.75rem"
---

# Design System: Habit-Tracker

<!-- Aufgenommen aus dem ausgelieferten Code: App-Hülle (Tab-Leiste, Mehr-Menü, Befehlsmenü, Tastenkürzel-Übersicht, Dialoge, Boot-Fehler), Heute, Plan, Wochenrückblick, Questlog, Kampagnen, Dailies, Kalender (ersetzt Kalender und Verlauf), Kategorien, Einstellungen und Anmeldung. Alle Ansichten beziehen Farben, Ecken und Abstände aus den Tokens und setzen sich aus den gemeinsamen Bausteinen am Ende von frontend/src/style.css zusammen. -->

## Overview

**Creative North Star: "Der warme Küchentisch"**

Ein Ort, an dem man morgens kurz den Tag auslegt: warmer Apricot-Grund, darauf weiße Karten mit großen weichen Ecken, eine runde, freundliche Schrift in komfortablen Größen. Das System ist ruhig und flach; Tiefe entsteht aus dem Wechsel zwischen warmem Grund und weißer Karte, nicht aus Schatten oder Verläufen.

Nachts liegt derselbe Tisch im Dunkeln: ein tiefer, warmer Umbra-Grund, Karten eine Stufe heller, warmweiße Tinte. Wer will, wählt in den Einstellungen "Hell" oder "Dunkel"; sonst folgt die App dem Gerät.

Genau eine kräftige Farbe, ein gebranntes Orange, trägt die ganze Bedienung. Sie erscheint nur auf dem, was man antippen kann: Haken, Primär-Button, aktiver Tab, Plus-Button. Alles andere spricht in warmer Tinte. Kategorien bekommen kleine, gedämpfte Farbmarken, die nie orange sind, damit Orange immer "hier tippen" bedeutet.

Bewegung ist taktil: Antippbares gibt beim Druck leicht nach und federt beim Loslassen kurz über. Liegengebliebenes und Fehler werden ohne Alarmfarbe gezeigt; die Oberfläche bietet an, statt zu mahnen.

**Key Characteristics:**
- Warmer Apricot-Grund, weiße Karten, warme braune Tinte statt Grau.
- Eine Aktionsfarbe, ausschließlich auf Antippbarem.
- Große weiche Ecken (Karte 1.375rem, Control 0.875rem, Pillen).
- Nunito Variable, kräftige 700/800-Gewichte für Titel und Labels, tabellarische Ziffern für Zeiten und Zählungen.
- Flach mit einem einzigen leisen Kartenschatten; Druck federt.
- Zwei Themen aus denselben Rollen: Hell (Apricot) und Dunkel (Umbra), nie Grau, nie reines Schwarz.
- Mobile zuerst: Tap-Ziele ab 2.75rem, feste Tab-Leiste unten, ab 56rem Leiste oben.
- Ein gemeinsamer Bausatz (Seite, Buttons, Felder, Segmentwahl, Chips, Karte, Zustände) für jede Ansicht.

## Colors

Ein warmes, einstimmiges Apricot-Umfeld mit einer gebrannten Orange-Stimme und zehn leisen Tönen für Kategorien und Kampagnen.

### Primary
- **Gebranntes Orange** (action): Haken-Ring und gefüllter Haken, Primär-Button "Erledigt", "Alle nachholen", Dialog-Submit, Plus-Button, aktiver Tab, eingeschalteter Schalter. Außerdem `accent-color` und `caret-color`.
- **Tiefes Orange** (action-strong): Hover des Primär-Buttons, Text auf getönten Buttons, Links, Fokusring (3px, Abstand 2px).
- **Apricot-Hauch** (action-tint): Fläche der sekundären, getönten Buttons (Stoppuhr ▶, Fokus-Modus auf der Fokuskarte, Nebenaktionen in Dialogen, Dialog-Schließen), Hover der leisen Buttons und des Menü-Auslösers "…", ruhige Fläche des deaktivierten Primär-Buttons, Grund der Wortmarke.
- **Dichter Apricot-Hauch** (action-tint-hover): Hover des getönten Stoppuhr-Buttons und Fläche des ▶, dessen Stoppuhr gerade läuft oder pausiert (dann mit 2px-Ring in tiefem Orange innen); eine Stufe dichter als der Hauch.
- **Auf Aktion** (on-action): Schrift und Icons auf Orange.

### Secondary
- **Marken** (mark-moss, mark-pine, mark-sage, mark-slate, mark-indigo, mark-heather, mark-plum, mark-berry, mark-walnut, mark-ochre): Tokens in `style.css`, nie Orange, in Helligkeit wie Farbton gestaffelt, damit sie auch bei Rot-Grün-Schwäche meist unterscheidbar bleiben; jede Verwendung nennt Kategorie oder Kampagne zusätzlich in Text. Kategorien speichern keine Farbe; der Name wird per FNV-1a-Hash stabil auf eine von sechs Marken abgebildet (Moos, Schiefer, Heide, Ocker, Salbei, Walnuss) und als kleines Quadrat (0.625rem, Ecke 0.2rem) vor den Namen gesetzt. Eine Kampagne kann eine der zehn Marken speichern; ohne gespeicherte nimmt sie die aus ihrem Titel. Die Entscheidung fällt immer in `campaignMark()`.
- **Ohne Kampagne** (mark-none): helles, warmes Neutral für gemessene Zeit ohne Kampagne, im Logbuch neben den Marken.

### Neutral
- **Apricot-Grund** (ground): Seitenhintergrund, Scrollbar-Spur, Hover im Filtermenü.
- **Tiefer Apricot** (ground-deep): eingelassene Fläche des Nachholen-Panels, Spur der Segmentwahl und Spur aller Fortschrittsbalken.
- **Kartenweiß** (surface): Karten, Leerzustände, Tab-Leiste, Dialoge, Menüs, Felder, gewähltes Segment und gewählter Chip, Buttons, die direkt auf dem Grund liegen ("Auf morgen", Nachholen-Chips). Flacher als eine Karte über eigene Tokens: `surface-flat` (55 % Weiß) für Kalendertermine, Plan-Blöcke der Zeitachse, Dailies im Plan und Ladeskelette; `surface-faint` (35 %) für die Tagesspalten im Plan; `surface-quiet` (70 %) für deren Schnell-Anlegen.
- **Gehobene Karte** (surface-raised): genau die eine ruhende Karte, die die One-Lifted-Card Rule hebt (Fokuskarte, Quotenkarte der Kalenderwoche, Quest-Stunden-Kennzahl im Wochenrückblick, Anmelde- und Boot-Fehlerkarte). Hell ist sie Kartenweiß und wird vom Kartenschatten gehoben; dunkel ist sie eine Stufe heller als die Zeilen (#3a2b21 auf #2f231b), weil ein Schatten auf Umbra kaum zu sehen ist.
- **Apricot-Linie** (line): Haarlinien zwischen Listenzeilen (Nachholen, Kategorien, Kalenderzeilen, Menütrenner), Einrückungslinie in den Kampagnen, Chiprahmen (1.5px), Tab-Leisten-Kante, Unterstreichung von Text-Links.
- **Feldrahmen** (line-strong): der 1.5px-Rahmen von Feldern, Auswahllisten, Textflächen und dem Notizen-Editor. Er ist oft die einzige Kante eines Felds und hält deshalb 3:1 gegen Karte und Grund.
- **Warme Tinte** (ink): Fließtext, Titel, die Jetzt-Linie, der Undo-Toast, Füllung aller Fortschrittsbalken, Heute-Rahmen im Kalender (2px innen), Rahmen des gewählten Chips, "Löschen" im Aktionsmenü.
- **Gedämpfte Tinte** (ink-muted): Metazeilen, Zeiten, Fortschritt, inaktive Tabs, erledigte Titel, Feldlabels, Legende, die Punkte im Monatsraster und der Zustandspunkt in Verlaufszeilen.
- **Leise Tinte** (ink-soft): deaktivierte und laufende Zustände, gestrichelter Ring oder Punkt für Übersprungenes, Terminstrich im Monatsraster, ausgeschalteter Schalter.
- **Fehlerrot / Fehlerhauch** (danger, danger-tint): echte Fehlermeldungen (Hinweisfläche, Formularfehler) und als einzige Ausnahme die endgültige Löschbestätigung ("Ja, löschen"); nie für Überfälliges.
- **Erfolgsgrün** (success): nur der Haken vor einem verbundenen Google-Kalender in den Einstellungen.

### Named Rules
**The Orange-Means-Tap Rule.** Die Aktionsfarbe steht nur auf Antippbarem. Statusanzeigen, Linien, Überschriften, Fortschritt und Kategorien sind nie orange; die Jetzt-Linie ist Tinte.

**The Warm-Ink Rule.** Es gibt kein neutrales Grau. Jeder Text- und Linienton ist ein warmes Braun aus der Tinten- oder Apricot-Familie.

**The No-Guilt Rule.** Liegengebliebenes liegt in tiefem Apricot, nicht in Rot. Rot gehört Fehlern des Systems, nicht Versäumnissen der Person.

**The Last-Step-Red Rule.** Neben Fehlern ist die einzige rote Fläche der letzte, unumkehrbare Schritt einer Löschung ("Ja, löschen"). Der Weg dorthin, etwa "Löschen" im Aktionsmenü, bleibt in Tinte.

**The Same-Roles Rule.** Hell und Dunkel teilen jede Rolle und jeden Token-Namen; Komponenten fragen nie, welches Thema gilt. Jede Farbe der App ist ein Token in `style.css`, ein Test lehnt Farbliterale in `.vue`-Dateien und außerhalb der Token-Blöcke ab.

**The Ink-Choice Rule.** Auswahl ist keine zweite Farbe: gewähltes Segment und gewählter Chip sind Tinte auf Weiß, Fortschritt ist ein flacher Tintenbalken auf tiefem Apricot.

### Dunkel
Dasselbe Haus bei Nacht, keine Umkehrung: Die Rollen bleiben, die Werte wechseln. `:root` hält Hell, `:root[data-theme="dark"]` Dunkel; wie das Attribut gesetzt wird, steht in `docs/theme.md`.

| Token | Hell | Dunkel |
|---|---|---|
| ground | #fde4d0 | #1e1611 |
| ground-deep | #f9d3b5 | #150f0b |
| surface | #ffffff | #2f231b |
| surface-raised | = surface (#ffffff) | #3a2b21 |
| surface-faint | rgb(255 255 255 / 35%) | rgb(255 238 222 / 2.5%) |
| surface-flat | rgb(255 255 255 / 55%) | rgb(255 238 222 / 5%) |
| surface-quiet | rgb(255 255 255 / 70%) | rgb(255 238 222 / 8%) |
| line | #f1cfb4 | #44352b |
| line-strong | #a07d66 | #8f7563 |
| selection | #fbc79f | #6e3b1f |
| scrim | rgb(43 29 22 / 40%) | rgb(10 6 4 / 60%) |
| scrim-light | rgb(43 29 22 / 18%) | rgb(10 6 4 / 40%) |
| ink | #2b1d16 | #f6e9df |
| ink-muted | #6b4d3d | #cdb4a4 |
| ink-soft | #7a5846 | #ad9281 |
| action | #c2410c | #f08a4e |
| action-strong | #9a330a | #ffa774 |
| action-tint | #fff1e8 | #3d2619 |
| action-tint-hover | #ffe2cf | #4d2f1e |
| on-action | #ffffff | #2b1408 |
| success | #2e7d4f | #6cc08e |
| danger | #b42318 | #ff8a7a |
| danger-tint | #fff0ec | #3f211b |
| mark-moss | #6d8b5a | #93ad80 |
| mark-pine | #3e6650 | #6f9a80 |
| mark-sage | #588880 | #8cbab2 |
| mark-slate | #4f7c99 | #86abc6 |
| mark-indigo | #5b5f9e | #9a9edb |
| mark-heather | #9a6b9e | #c79ccb |
| mark-plum | #7a4a6c | #b483a6 |
| mark-berry | #a8566e | #d78fa4 |
| mark-walnut | #8c6b55 | #b8987f |
| mark-ochre | #a07c33 | #d6b46e |
| mark-none | #a38d7a | #857265 |

**The Warm-Night Rule.** Dunkel ist warmes Umbra, nie neutrales Grau und nie reines Schwarz; die Tinte ist Warmweiß, nie reines Weiß.

**The Still-Orange Rule.** Nachts ist das Orange heller (action #f08a4e), damit es auf Umbra als einzige Tippfarbe leuchtet; Schrift auf Orange wird dafür dunkle Tinte (on-action #2b1408), auch die Symbole auf den Kampagnen-Plaketten. "Tief" (action-strong) heißt im Dunkeln "kontrastreicher", also heller: Hover, Text auf getönten Flächen, Links und Fokusring. Orange bleibt auch nachts nur auf Antippbarem.

**The Hairline-Not-Shadow Rule.** Schatten sieht man auf Dunkel kaum. Gehobenes (Fokuskarte, Popover, Dialog, gewähltes Segment) bekommt statt eines schwereren Schattens eine helle Haarlinie (`0 0 0 1px` in 7–9 % Warmweiß); Popover und Dialog behalten darunter einen weichen dunklen Schatten. Die eine gehobene Karte einer Ansicht liegt zusätzlich eine Stufe heller (surface-raised), sonst teilt sie nachts die Farbe aller Zeilen und die Ordnung fällt zusammen. Eingelassenes (ground-deep) liegt tiefer als der Grund.

**The Marks-At-Night Rule.** Die zehn Marken sind nachts heller und etwas ruhiger, weiter in der Helligkeit gestaffelt; mark-none ist nachts dunkler als die Marken, damit "ohne Kampagne" leiser bleibt.

Der Undo-Toast bleibt eine Pille in Tinte und ist im Dunkeln deshalb hell mit dunkler Schrift. Native Bedienelemente, Scrollbars und Autofill folgen `color-scheme` (light bzw. dark).

### Kontrast
Ein Test (`frontend/src/theme.spec.ts`) liest beide Token-Sätze aus `style.css` und prüft die Paare, die die App zeichnet: Text 4.5:1, Marken, Ringe, Symbole, Feldrahmen und Fokusring 3:1. Durchscheinende Flächen werden auf den Grund gerechnet, gestapelte Schicht für Schicht (das Schnell-Anlegen im Plan liegt in surface-quiet auf der Tagesspalte in surface-faint). Platzhalter stehen in leiser Tinte und halten auch auf dem echten Feldgrund 4.5:1; dafür ist ink-soft nachts etwas heller als zuvor (#ad9281 statt #a88d7c, vorher 4.38 im Plan).

| Paar | Hell | Dunkel | Mindestens |
|---|---|---|---|
| ink / ground · ground-deep · surface · surface-flat | 13.32 · 11.64 · 16.28 · 14.89 | 14.97 · 15.96 · 12.81 · 13.30 | 4.5 |
| ink-muted / ground · ground-deep · surface · surface-flat | 6.24 · 5.45 · 7.63 · 6.97 | 9.05 · 9.65 · 7.74 · 8.04 | 4.5 |
| ink-soft / ground · ground-deep · surface · surface-flat | 5.19 · 4.53 · 6.34 · 5.80 | 6.12 · 6.52 · 5.23 · 5.43 | 4.5 |
| ink · ink-muted · ink-soft / surface-raised (gehobene Karte) | 16.28 · 7.63 · 6.34 | 11.40 · 6.89 · 4.66 | 4.5 |
| action · action-strong / surface-raised | 5.18 · 7.36 | 5.46 · 7.13 | 4.5 |
| Platzhalter (ink-soft) / Feld (surface) | 6.34 | 5.23 | 4.5 |
| Platzhalter (ink-soft) / Schnell-Anlegen im Plan (surface-quiet auf surface-faint auf ground) | 6.10 | 4.67 | 4.5 |
| action / surface · action-tint | 5.18 · 4.69 | 6.14 · 5.67 | 4.5 |
| action / ground (Plus-Button, Ringe; dort steht keine Schrift) | 4.24 | 7.17 | 3 |
| action-strong / action-tint · action-tint-hover · surface · ground · ground-deep | 6.66 · 5.97 · 7.36 · 6.03 · 5.26 | 7.41 · 6.34 · 8.01 · 9.36 · 9.98 | 4.5 |
| on-action / action · action-strong | 5.18 · 7.36 | 7.01 · 9.15 | 4.5 |
| success / surface | 5.05 | 6.95 | 4.5 |
| danger / surface · danger-tint | 6.57 · 5.93 | 6.66 · 6.35 | 4.5 |
| ink / danger-tint (Hinweisfläche) | 14.67 | 12.21 | 4.5 |
| surface / ink (Undo-Toast) | 16.28 | 12.81 | 4.5 |
| line-strong / surface · ground · surface-raised (Feldrahmen) | 3.74 · 3.06 · 3.74 | 3.55 · 4.15 · 3.16 | 3 |
| Marken / surface (kleinster Wert) | 3.82 (moss) | 4.80 (pine) | 3 |
| Marken / ground (kleinster Wert) | 3.13 (moss) | 5.61 (pine) | 3 |
| on-action / Marke (Symbol auf Plakette, kleinster Wert) | 3.82 (moss) | 5.48 (pine) | 3 |
| mark-none / surface | 3.16 | 3.33 | 3 |

## Typography

**Display Font:** Nunito Variable (mit ui-rounded, system-ui, Segoe UI, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** keine eigene; Ziffern über `font-variant-numeric: tabular-nums`

**Character:** Eine einzige runde, humanistische Familie, selbst gehostet über @fontsource-variable/nunito. Hierarchie entsteht aus Gewicht (400 / 600 / 700 / 800) und Größe, nicht aus einer zweiten Schrift.

### Hierarchy
- **Display** (800, clamp 1.75–2.25rem, 1.1, -0.02em, balanciert): Wochentag und Datum oben auf "Heute" und der Seitentitel jeder Ansicht (dort mit 6vw-Mittelwert). Die Zahl unter "Dailies im Wochensoll" in der Kalenderwoche steht noch größer (800, clamp 2.25–3rem, 1).
- **Headline** (800, clamp 1.5–1.875rem, 1.15, -0.015em): Titel der Fokuskarte und der Anmeldekarte.
- **Title** (800, 1.125rem): Abschnittstitel ("Termine", Einstellungs-Abschnitte), Titel im Leerzustand, Wortmarke; Dialog- und Boot-Fehlertitel 1.375rem im selben Gewicht.
- **Body Large** (1.0625rem): Warum-Satz der Fokuskarte und der Kampagnen-Detailkarte (max. 60ch), Eintragstitel (700), Primär-Button (800).
- **Body** (400, 1rem, 1.45): Fließtext und Feldeingaben; Fortschritt und "Danach" in 600; Seiteneinleitung gedämpft, max. 60ch.
- **Label** (700, 0.875rem, tabellarische Ziffern): Uhrzeiten, Metazeilen, "Jetzt", Feldlabels, Zähler neben Abschnittstiteln. Metazeile der Fokuskarte und Button-Schrift 0.9375rem; Wochentage im Monatsraster 0.8125rem.
- **Nav Label** (700, 0.75rem, -0.01em): Tab-Beschriftung mobil; die Tabs haben dafür kaum Seitenpolster (0.0625rem, Leiste 0.25rem), damit "Kampagnen" auch bei 360px ungekürzt passt. Ab 56rem 0.9375rem ohne Sperrung.

### Named Rules
**The Tabular-Time Rule.** Jede Uhrzeit, Minutenangabe und Zählung ("10/35 Min.", "1 von 4", "3 von 12") setzt tabellarische Ziffern.

**The Weight-Not-Case Rule.** Betonung kommt über 700/800, nie über Versalien oder Sperrung. Inline-Labels wie "Danach" stehen fett im Satz, nicht als Überzeile.

**The Stopwatch-Word Rule.** Was misst, heißt in der Oberfläche "Stoppuhr", nie "Timer": in Beschriftungen, Namen für Screenreader, Menüs, Befehlsmenü, Einstellungen ("Benachrichtigen, wenn das Soll erreicht ist"), Meldungen des Servers und Push. Sie zählt hoch; das Soll hält sie nicht an, also "läuft ab" nichts. "Timer" bleibt nur ein Suchwort im Befehlsmenü und der Name im Code.

## Layout

Eine zentrierte Spalte: `min(100% - 2rem, 46rem)`, oben 1.5rem, unten Platz für den Plus-Button (`--fab-clearance`: seine Größe, sein Abstand über der Tab-Leiste und 1.5rem Luft), damit ▶ und "…" der letzten Zeile frei liegen, wenn man ans Ende scrollt. Jede Ansicht beginnt mit derselben Kopfzeile: Seitentitel links, Steuerung rechts (umbrechend), optional ein gedämpfter Einleitungssatz auf eigener Zeile, 1.5rem Abstand zum Inhalt. Abschnitte öffnen mit einem Abschnittstitel 2rem darüber, optional mit Zähler. Abstandsraster in sechs Stufen (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2rem); Karten im Abstand 0.5rem, Abschnitte 2rem, Fokus zu Nachholen 1.5rem.

Anmeldung und Boot-Fehler sind die Ausnahme: eine einzelne Karte (26–27rem breit) mittig auf dem Grund, ohne Tab-Leiste.

Die Kampagnen beginnen mit Kacheln (Raster, je mindestens 14rem, mobil eine Spalte) über dem Baum "Kampagnen und ihre Quests": nur Kampagnen mit allem darunter, lose Quests ohne Kampagne stehen im Questlog, in Heute und im Plan. Eine geöffnete Kampagne ersetzt Kacheln und Baum durch ihre Detailkarte und die Quests darunter ("Quests der Kampagne"); die Kampagne selbst ist die Karte und steht nicht noch einmal als Zeile im Baum. Darüber "Alle Kampagnen" als leiser Zurück-Button. Ohne Kampagne zeigt die Ansicht einen Leerzustand ("Noch keine Kampagnen.", Plus-Button, lose Quests im Questlog).

Mobil steht unten eine feste Tab-Leiste (4.25rem plus Safe Area) mit vier Zielen (Heute, Questlog, Kampagnen, Kalender) und "Mehr" (Plan, Wochenrückblick, Fokus, Dailies, Kategorien, Einstellungen), das ein Popover über der Leiste mit Scrim öffnet. Die Ziele sind Links mit eigener Adresse; beim Wechsel springt die Ansicht nach oben und nimmt den Fokus; der Body hält per Polsterung Abstand zur Leiste. Ab 56rem wird die Leiste zur oberen Leiste (3.5rem hoch, Innenbreite 64rem): links die fünf Hauptansichten mit Namen (Plan direkt nach Heute), rechts "Befehle" für das Befehlsmenü. Rechts sammelt ein beschrifteter Button "Mehr" (Icon, Name, kleiner Pfeil) die übrigen Ansichten in einem weißen Popover unter der Leiste, mit Icon und Namen je Eintrag; er ist dasselbe "Mehr" wie am Handy, nur ohne Scrim und ohne Plan, und gilt als aktueller Tab, wenn eine Ansicht offen ist, die bei dieser Breite keinen eigenen Tab hat. Die Leiste wächst in drei Stufen, weil zehn beschriftete Ziele rund 78rem brauchen:
- **56–70rem:** "Mehr" hält Wochenrückblick, Fokus, Dailies, Kategorien und Einstellungen. Die Tasten Strg K stehen ab 64rem als kleine Tastenkappen neben "Befehle", wo eine Tastatur wahrscheinlich ist.
- **Ab 70rem** (ein übliches PC-Fenster): Innenbreite 80rem; Wochenrückblick, Fokus und Dailies stehen mit Namen als rechte Gruppe in der Leiste, "Mehr" hält nur noch Kategorien und Einstellungen. Die Tabs rücken etwas enger (Polster 0.625rem), die Schrift bleibt gleich groß; "Befehle" behält nur die Lupe in Tap-Größe, der Name bleibt für Screenreader und im Tooltip.
- **Ab 82rem:** "Mehr" entfällt, alle zehn Ziele stehen mit Namen in der Leiste.

Der Kalender-Tag nutzt ab 56rem bis zu 64rem Breite: links die Liste des Tages, rechts die Zeitachse (19–24rem); mobil stehen beide untereinander. Auch der Wochenrückblick nutzt ab 56rem mehr Breite, bis 72rem, für sein Dashboard (siehe Components › Dashboard-Muster). Der Plan ist die weiteste Ausnahme von der Seitenspalte: Er nutzt bis zu 90rem Breite, damit sieben Tagesspalten nebeneinander passen (unter 56rem mind. 10.5rem). Ab 56rem steht links die Questlog-Spalte (offen 12rem, zugeklappt eine Leiste so breit wie ihr Chevron, 2.75rem); daneben ist ein Tag mindestens 8.5rem breit, so viel, wie übliche deutsche Wörter brauchen ("Steuererklärung", "Halbmarathon"). Damit passt die Woche ab etwa 1100px neben die Leiste und ab 80rem (1280px) neben die offene Spalte; darunter beginnt die Spalte deshalb zugeklappt, solange man sie auf dem Gerät nicht selbst geöffnet hat. Reicht die Breite nicht, scrollen die Tage innerhalb des Bretts seitwärts, nie die Seite, und rasten am Spaltenanfang ein. Das Brett öffnet am Montag, solange heute von dort ganz zu sehen ist (immer, wenn die Woche passt); sonst scrollt es nur so weit, dass heute ganz sichtbar ist, und hält die Tage davor im Blick, so weit es geht. Unter 40rem füllt ein Tag 85 % der Breite, der nächste lugt herein, die Spalten rasten ein. Der Plus-Button sitzt mobil über der Leiste rechts, auf breiten Schirmen neben der Seitenspalte; Questlog, Kampagnen und Dailies legen über denselben Plus-Button an. Im Dokument steht er nach dem Inhalt der Ansicht (The FAB-Last Rule), sichtbar bleibt er, wo er ist. Unter 32rem werden Karten- und Dialogpolster auf 1rem reduziert. Ab 40rem wird das Aktionsmenü vom unteren Blatt zum Popover am Auslöser.

**The Way-Back Rule.** Der Weg zurück zum Jetzt ("Diese Woche" in Plan und Wochenrückblick, "Heute" im Kalender) ist eine getönte Pille vor den Pfeilen und erscheint nur, wenn der gezeigte Zeitraum heute nicht enthält; auf dem laufenden Zeitraum würde sie nichts ändern. Weil sie vor den Pfeilen steht, bleiben die Pfeile an ihrem Platz, wenn sie verschwindet. Nach dem Tippen geht der Fokus auf das, was den neuen Zeitraum nennt (Titel bzw. Zeitraum).

Einträge folgen dem Zeilenvertrag (Components › Zeilen): Zeitspalte oder Griff (2.75rem), Haken-Spalte (Tap-Breite), Inhalt, rechts ▶ und "…"; Kalendertermine und Daily-Läufe, die noch nicht fällig sind, halten dieselbe Flucht, ohne Haken. In den Kampagnen rückt jede Ebene ein, eine 1px-Apricot-Linie führt zur Elternzeile. Tap-Ziele messen mindestens 2.75rem, große Ziele 3rem, der Primär-Button 3.25rem.

## Elevation & Depth

Weitgehend flach. Tiefe entsteht durch Tonwechsel: weiße Karte auf Apricot, eingelassenes Panel in tieferem Apricot, halbtransparentes Weiß für nicht abhakbare Termine. Ein einziger leiser, warmbrauner Kartenschatten hebt pro Ansicht höchstens eine ruhende Karte: die Fokuskarte auf Heute, die Quotenkarte "Dailies im Wochensoll" in der Kalenderwoche, die Quest-Stunden-Kennzahl im Wochenrückblick (am Handy die ganze Kennzahlen-Karte; die Quotenkarte liegt dort flach), die Anmeldekarte, die Boot-Fehlerkarte. Sonst hebt er nur einen Auswahlzustand (gewählter Tag im Monatsraster). Alles Schwebende (Tab-Leiste, Popover, Filtermenü, Aktionsmenü, Dialog, Toast, Plus-Button) bekommt einen weichen, diffusen Schatten in warmem Braun.

### Shadow Vocabulary
Alle Schatten sind Tokens (`--shadow-card`, `--shadow-rest`, `--shadow-thumb`, `--shadow-bar`, `--shadow-popover`, `--shadow-dialog`, `--shadow-toast`, `--shadow-fab`), die Scrims ebenso (`--color-scrim`, `--color-scrim-light`). Die Werte unten gelten für Hell; Dunkel ersetzt sie durch Haarlinien (siehe Colors › Dunkel).
- **Kartenschatten** (`box-shadow: 0 1px 2px rgb(107 50 18 / 6%), 0 6px 18px rgb(107 50 18 / 7%)`): die eine gehobene Karte der Ansicht, gewählter Kalendertag, Filtermenü; Basis von Mehr-Popover und Aktionsmenü.
- **Leistenkante** (`box-shadow: 0 -1px 0 var(--color-line), 0 -8px 24px rgb(107 50 18 / 8%)`): mobile Tab-Leiste; oben nur `0 1px 0 var(--color-line)`.
- **Popover** (`box-shadow: var(--shadow-card), 0 12px 32px rgb(107 50 18 / 16%)`): Mehr-Menü, Aktionsmenü.
- **Auflage** (`box-shadow: 0 1px 2px rgb(107 50 18 / 12%)`): gewähltes Segment; der Daumen des Schalters trägt dasselbe in Tinte (`rgb(43 29 22 / 20%)`).
- **Dialog** (`box-shadow: 0 12px 40px rgb(43 29 22 / 22%)`, Backdrop `rgb(43 29 22 / 40%)`).
- **Toast** (`box-shadow: 0 8px 24px rgb(43 29 22 / 30%)`).
- **Plus-Button** (`box-shadow: 0 4px 14px rgb(154 51 10 / 28%)`).

### Named Rules
**The One-Lifted-Card Rule.** Pro Ansicht trägt höchstens eine ruhende Karte den Kartenschatten und als Fläche `surface-raised` (hell gleich Kartenweiß, dunkel eine Stufe heller). Listenkarten, Leerzustände und Einstellungskarten liegen flach in surface.

**The Warm-Shadow Rule.** Schatten sind weich, diffus und warmbraun getönt, nie schwarz, nie hart versetzt.

## Shapes

Großzügig gerundet in drei Stufen: Karten, Panels, Leerzustände, Hinweisflächen, Dialoge und Popover 1.375rem (das Aktionsmenü als unteres Blatt nur oben gerundet); Felder, Kalendertage, Filtermenü und der große Primär-Button 0.875rem; alle übrigen Buttons, Segmentwahl, Chips, Fortschrittsbalken, Schalter und Toast als Pille. Runde Icon-Buttons (Stoppuhr, Dialog-Schließen, Haken) sind Kreise in Tap-Größe. Der Plus-Button ist ein weiches Quadrat (3.5rem, Ecke 1.125rem). Rahmen kommen fast nicht vor; nur Felder und ungewählte Chips tragen eine 1.5px-Apricot-Linie, Listenzeilen trennt eine 1px-Haarlinie. Gestrichelt ist nur, was nicht stattfindet oder noch nicht ist: Übersprungenes und die Ablagefläche beim Ziehen.

Icons stammen aus einer eigenen Strichfamilie (AppIcon): 24px-Raster, Strich 2, runde Enden und Ecken, `currentColor`. Dazu gehören die sechzehn Kampagnen-Symbole (Buch, Code, Hantel, Herz, Zuhause, Aktentasche, Doktorhut, Musik, Blatt, Geld, Werkzeug, Füller, Kamera, Globus, Stern, Fahne). Aktive Tabs heben den Strich auf 2.4, der Haken im Primär-Button auf 2.6, im Ring auf 3. In Buttons messen Icons 1.125rem.

## Components

Alle Ansichten setzen sich aus dem gemeinsamen Bausatz in `frontend/src/style.css` zusammen: Seite (`.page`, `.page-header`, `.page-title`, `.page-lead`, `.section-title`, `.count`), Buttons (`.btn` und Varianten), Felder und Auswahl (`.field`, `.input`, `.segmented`, `.chips` / `.chip`, `.switch`), Tastenkappen (`.kbd`), Flächen und Zustände (`.card` mit `.card-head` und `.card-title` für Karten mit Titel innen, `.empty-state`, `.alert`, `.form-error`, `.skeleton`, `.visually-hidden`). Neue Ansichten komponieren diese Bausteine, statt Buttons und Felder einzeln zu stylen.

### Buttons
Weich, griffig, federnd.
- **Shape:** Pille in Tap-Höhe, Schrift 700, 0.9375rem, Icon 1.125rem links. Nur der große Primär-Button ("Erledigt", Anmelden) hat die Control-Ecke 0.875rem und 3.25rem Höhe.
- **Tinted (Basis):** Apricot-Hauch, Schrift tiefes Orange. Die Standardform jeder Nebenaktion, auch in allen Dialogen.
- **Primary:** Orange voll, weiße Schrift 800. Ein Primär-Button pro Kontext; als Pille für Sammelaktionen ("Alle nachholen") und Dialog-Submit.
- **On Ground:** Weiß auf dem Apricot-Grund, Schrift tiefes Orange ("Auf morgen", Nachholen-Chips).
- **Quiet:** ohne Fläche in gedämpfter Tinte; beim Hover Apricot-Hauch und tiefes Orange. Für "Abbrechen", Menüeinträge und Nebenwege.
- **Danger:** Fehlerhauch mit Fehlerrot, nur für die endgültige Löschbestätigung.
- **Icon:** quadratisch in Tap-Größe, ohne Polster.
- **Link:** tiefes Orange, unterstrichen in Apricot-Linie, Tap-Höhe; für Wechsel wie "Passwort vergessen?" und "Konto erstellen" auf der Anmeldung.
- **Hover / Focus:** Primär wird tiefes Orange (160ms, --ease-out); Fokus ist ein 3px-Ring in tiefem Orange.
- **Press:** `scale(0.97)` beim Drücken (90ms), Rückfederung über `--spring` (420ms). Haken drücken auf 0.86, Stoppuhr-Buttons auf 0.92.
- **Disabled:** Nebenbuttons verlieren die Fläche und werden leise Tinte. Ein noch nicht verfügbarer Primär-Button wird ruhig: Apricot-Hauch mit leiser Tinte, Cursor `not-allowed`; während er arbeitet, Cursor `progress`.

### Chips
- **Segmentwahl:** Pillen-Spur in tiefem Apricot (0.25rem Innenabstand), Optionen in gedämpfter Tinte 700; die gewählte ist Weiß mit Tinte und leiser Auflage. Für Modi wie Monat · Woche · Tag. Als Buttons mit `aria-pressed` oder, wo es eine echte Auswahl ist (Darstellung), als `role="radiogroup"` mit versteckten nativen Radios in den Labels.
- **Filter-Chip:** Pille mit 1.5px-Apricot-Linie, gedämpfte Tinte; gewählt Weiß mit Tintenrahmen und Tinte.
- **Filter im Kalender:** ein leiser runder Icon-Button (drei kürzer werdende Striche) neben dem Titel, Name "Einträge: Alle". Ist ein Filter gewählt, nennt er ihn ("Quests", "Dailies") als Pille in Tinte auf Weiß mit Tintenrahmen, damit niemand einen gefilterten Kalender für den ganzen hält. Er öffnet das Filtermenü (weiß, Control-Ecke, Kartenschatten, Einträge mit Hover in Apricot-Grund).

### Cards / Containers
- **Corner Style:** 1.375rem.
- **Background:** Weiß; die eine gehobene Karte surface-raised; Termine 55 % Weiß; Nachholen-Panel tiefer Apricot.
- **Shadow Strategy:** höchstens eine gehobene Karte pro Ansicht (siehe Elevation).
- **Border:** keine; Zeilen in Listenkarten trennt eine Haarlinie (Kategorien, Kalenderzeilen).
- **Internal Padding:** Basis 1rem; Fokus 1.5rem (unten 1rem), Quote 1.5rem, Einträge 0.5–1rem.
- **Einstellungen:** jede Gruppe eine flache Karte mit Abschnittstitel; zuerst "Wochenziel Quest-Stunden" (Satz, Zahlfeld in Stunden, getöntes "Speichern", stille Rückmeldung "Gespeichert."), dann "Darstellung": eine Radiogruppe im Look der Segmentwahl ("Wie das Gerät", "Hell", "Dunkel"), darunter gedämpft "Gilt auf diesem Gerät." und bei "Wie das Gerät", was gerade gilt; Schalter (`.switch`, für Benachrichtigungen und Tastenkürzel) sind eine Zeile mit kleiner Pillen-Spur (3 × 1.75rem) in Tap-Fläche, aus leise Tinte, an Orange, weißer Daumen federt über. "Tastatur" erscheint nur, wo eine Tastatur wahrscheinlich ist: Schalter "Tastenkürzel", ein gedämpfter Satz, darunter die Tastenkürzel-Liste.

### Inputs / Fields
- **Style:** Label darüber in gedämpfter Tinte 700, 0.875rem. Feld weiß, 1.5px Feldrahmen (line-strong), Platzhalter in leiser Tinte, Ecke 0.875rem, Tap-Höhe, Polster 0.75rem, Schrift 1rem 400; Textflächen mit Rundum-Polster und vertikal ziehbar.
- **Focus:** 3px-Ring in tiefem Orange, Abstand 2px; Caret orange.
- **Error:** Formularfehler als Satz in Fehlerrot 700, 0.9375rem; Ladefehler als Hinweisfläche (Fehlerhauch, Tinte, Kartenecke) mit "Erneut versuchen", auch auf Heute. Der Text sagt in einfachen Worten, was geschah und ob etwas verloren ist: "Der Server hatte gerade einen Fehler. Deine Daten sind davon nicht betroffen; versuch es gleich noch einmal." beim Laden, "… die Änderung ist nicht gespeichert. Was du eingegeben hast, bleibt hier stehen; …" beim Speichern, "Keine Verbindung zum Server. …" offline. Eine eigene Meldung des Servers ("Das Ende muss nach dem Start liegen.") bleibt, wie sie ist.
- **Gespeichert:** stille Rückmeldung als gedämpfter Text neben dem Feld (Kategorien, Tagesreflexion), kein Toast.
- **Aufklapper** (`FormDisclosure`): seltene, optionale Felder warten hinter einer Zeile statt einer Pille: Name in Tinte 700, eine Ergänzung in Klammern gedämpft ("Termin (feste Uhrzeit)"), rechts ein Chevron, Haarlinie darüber, Hover in Apricot-Hauch. Der Button trägt `aria-expanded` und `aria-controls`, das Feldpaket darunter ist eine Gruppe mit dem Button als Namen. Er öffnet an Ort und Stelle und gibt den Fokus ins erste Feld, das ihn nehmen kann; schließen lässt den Fokus auf dem Button. Hält das Paket schon einen Wert, beginnt es offen; zugeklappt nennt der Button rechts, was gesetzt ist ("14:30 Uhr", "Morgenseiten, 20-mal · 08.11.–18.12.", "Sport"), gedämpft mit Auslassung. **The Nothing-Hidden Rule:** ein gesetzter Wert steht immer offen oder auf dem Button, nie stumm hinter einem zugeklappten.

### Quest-Editor
"Quest bearbeiten" (`PlannerItemEditor`) und "Neue Quest" (`CreateTodoForm`) zeigen, was fast jede Änderung braucht, und sonst nichts:
- **Immer da:** Titel, Tag mit den Chips Heute · Morgen (mobil auf einer Zeile mit dem Datum), Dauer in Minuten (das Soll), Warum.
- **Aufklapper darunter**, als eine Liste zwischen Haarlinien: "Kampagne (Farbe, Symbol, Wochenziel)" nur für eine oberste Quest (siehe Farbe und Symbol wählen), "Termin (feste Uhrzeit)" mit der Uhrzeit, die ohne Tag gesperrt bleibt und es sagt, "Ziel mit Daily (Daily und Zeitraum)" mit "Zählt für ein Daily" zuerst und erst danach Zeitraum von/bis und "Wie oft im Zeitraum?" (ein Zeitraum ohne Daily bedeutet nichts; ein alter steht trotzdem da, damit man ihn leeren kann), zuletzt "Kategorie". Beim Anlegen gibt es Termin und Kategorie; eine neue Kampagne zeigt Farbe, Symbol und Wochenziel offen, denn dafür legt man sie an.
- **Notizen** folgen im Editor nach den Aufklappern, wie bisher selbstspeichernd.
- **Aktionen:** Im Dialog haftet eine Fußleiste unten über die ganze Dialogbreite (Kartenweiß, Haarlinie oben): ein Formularfehler steht dort direkt über "Speichern" (Primär) und "Abbrechen", beim Anlegen über "Quest erstellen". Der Dialog hält dafür unten Scroll-Abstand, damit ein per Tab erreichtes Feld nie dahinter liegt. "Quest löschen" bleibt der letzte, leise Schritt darunter: Tinte ohne Fläche, erst "Ja, löschen" ist rot.

Solange der Editor lädt (Skelett), schließen Escape und "Dialog schließen" ihn; gesperrt ist der Dialog nur, während er speichert oder löscht.

Das Daily im selben Editor behält seine Felder (Kategorie, Warum, Uhrzeit, Dauer, Aktiv, Zeitplan) und dieselbe haftende Fußleiste.

### Übernommenes Warum
Hat eine Quest oder ein Daily kein eigenes Warum, gilt das der nächsten Quest darüber, live (`WhyField`). Der Editor zeigt es deshalb nie als bearbeitbaren Text: unter dem Label "Warum" steht es als ruhiges Zitat (2px-Linie in Apricot links, "Übernommen von „Buch schreiben“:" gedämpft 0.875rem, darunter der Satz in Tinte), darunter die getönte Pille "Eigenes Warum schreiben" mit Stift. Sie öffnet ein leeres Feld "Eigenes Warum" mit dem Fokus darin; das Zitat bleibt als Bezug darüber ("Ersetzt das Warum von „…“:", nun gedämpft), darunter leise "Leer gelassen gilt weiter das übernommene." und die Pille "Wieder übernehmen", die das eigene leert und den Fokus an "Eigenes Warum schreiben" zurückgibt. So kann kein Tastendruck das Warum still abkoppeln. Gespeichert wird nur, was sich änderte: unverändert nichts, ein neues eigenes als Text, "Wieder übernehmen" als leeres Warum, das wieder erbt. Ohne etwas zu erben ist es ein einfaches Feld "Warum · optional".

### Navigation
- **Tab-Leiste:** Weiß, Icon über 0.75rem-Label (700), inaktiv gedämpfte Tinte, aktiv Orange mit kräftigerem Strich. Druck federt. Ab 56rem oben, Icon neben Label.
- **Mehr:** ein Disclosure-Button (`aria-expanded`, `aria-controls`) über einer Liste von Links, die man mit Tab durchläuft. Am Handy ein weißes Popover über der Leiste mit Scrim `rgb(43 29 22 / 18%)`; zwischen 56rem und 82rem ein Popover unter dem Button ohne Scrim (bis 70rem mit fünf Ansichten, danach mit Kategorien und Einstellungen). Escape schließt und gibt den Fokus an den Button zurück, ein Klick daneben, Tab aus der Liste heraus und jeder Ansichtswechsel schließen ebenfalls.
- **Befehle:** leiser Tab mit Lupe und Namen, ab 70rem nur die Lupe; öffnet das Befehlsmenü.

### Befehlsmenü
Strg K oder "Befehle" öffnen einen Dialog nahe dem oberen Rand: Titel "Befehle", darunter das Suchfeld, dann die Einträge als Zeilen in Tap-Höhe (Tinte 700, Control-Ecke), ohne Suche gruppiert nach "Ansichten" und "Aktionen" (Gruppentitel gedämpft 0.875rem), mit Suche als eine Liste nach Treffergüte. Der aktive Eintrag liegt in Apricot-Hauch mit tiefem Orange, wie Hover in Menüs. Rechts stehen die Tasten des Eintrags als Tastenkappen. Findet die Suche nichts, sagt eine ruhige Fläche in Apricot-Grund "Nichts gefunden für „…“."

### Tastenkappe (`.kbd`)
Eine Taste: mindestens 1.75rem breit und hoch, Ecke `--radius-key` (0.375rem, kantig genug für eine Taste, keine Pille), Apricot-Grund mit einer 2px-Kante in tiefem Apricot unten, Tinte 700 in 0.8125rem. Mehrere Tasten stehen mit 0.25rem Abstand nebeneinander ("Strg" "K"). Abgeschaltete Kürzel stehen in leiser Tinte, ihre Kappen blasser. Kappen erscheinen nur, wo eine Tastatur wahrscheinlich ist.

### Tastenkürzel-Liste
In der Übersicht ("?") und in Einstellungen › Tastatur dieselbe Liste: Gruppentitel (800, 1rem), darunter Zeilen mit der Aktion links und den Tastenkappen rechts, getrennt durch Haarlinien.

### Zeilen (der Zeilenvertrag)
Jede Quest- und Daily-Zeile in jeder Ansicht folgt einem Vertrag, gebaut aus `ItemRow` (Zeile), `CheckRing` (Haken) und `ActionMenu` (Menü):
- **Ring**, wo man den Eintrag erledigen kann, überall mit Rückgängig im Toast (Heute, Questlog, Plan, Kalender, Kampagnen, Dailies). Eine Kampagne mit offenen Quests fragt vorher (siehe Kampagne abschließen).
- **Titel öffnet den Editor** ("… bearbeiten"); die Überschrift behält den reinen Titel. Darunter eine Metazeile; am Handy bleibt sie eine Zeile, der letzte Teil (meist die Kampagne, die auch der Streifen nennt) endet mit Auslassung.
- **▶**, wo Messen Sinn ergibt (Heute, Questlog). Läuft die Stoppuhr dieser Zeile, wird ▶ zu Pause (pausiert zu Weiter) mit dichterem Hauch und Ring, und die Metazeile beginnt mit "läuft" oder "pausiert" in Tinte mit einem ruhig pulsierenden Punkt; nie orange.
- **Alles andere im Menü "…"** (Verschieben, Überspringen, Heute/Morgen/Nächste Woche, Einplanen, Unter-Quest, Fortschritt, Löschen, wo es das gibt). Keine dauerhaften Text-Buttons in der Zeile.
- **Griffe** bleiben, wo sortiert wird (Heute, Plan), in der Zeitspalte.

Je Ansicht:
- **Heute:** Griff, Ring, Titel mit Metazeile, ▶, "…" (Überspringen bei Dailies, Morgen und Nächste Woche, "Anderer Tag …" bzw. "Termin verschieben …"). Eine Zeile mit einer Metazeile misst rund 68px (Desktop wie Handy, solange der Titel auf eine Zeile passt). Ein Daily beginnt seine Metazeile mit dem Dailies-Icon und "Daily" (700), wie im Plan, damit es nicht wie eine Quest aussieht. Unter der Metazeile steht leise das Warum, das eigene oder übernommene (gedämpfte Tinte, 0.9375rem, eine Zeile mit Auslassung, ganz im Tooltip); erledigte und übersprungene Zeilen lassen es weg. Am Handy tragen es nur die nächsten zwei Zeilen der Reihenfolge, Termine und Nachholen erst ab 40rem: Mit Warum misst eine Zeile rund 88px statt 68px, ein langer Tag würde sonst ein Drittel länger. Nachholen behält sein Panel mit den Chips Heute · Morgen · Anderer Tag · Überspringen.
- **Questlog:** nur Quests, an denen man arbeiten kann (keine Kampagnen, keine Questreihen mit offenen Quests; die Regel liegt beim Server). Ring, Titel, Metazeile mit Kampagne, Warum, ▶, "…" mit Einplanen (Heute, Morgen, Nächste Woche, "Tag wählen …", das den Editor am Tag öffnet). Löschen bleibt im Editor.
- **Kampagnen:** Einrückung, Chevron, Ring, Titel, "…" (Stoppuhr starten, Unter-Quest, Fortschritt, Verschieben, Löschen). Der Baum ordnet, daher liegt Messen hier im Menü statt als ▶ auf jeder Zeile. Die geöffnete Kampagne hat keine Zeile; ihre Detailkarte trägt "Bearbeiten" und rechts im Kopf dasselbe "…" (Kampagne abschließen bzw. Wieder öffnen statt des Rings, Stoppuhr starten, Unter-Quest hinzufügen, Verschieben, Löschen; der Fortschritt steht schon auf der Karte), und sie nimmt beim Ziehen Quests auf.
- **Kalender (Monats-Tagesliste, Tag):** offene Quests und die heute fälligen Daily-Läufe mit Ring und Rückgängig (ein Lauf, den der Kalender nur voraussieht, holt sich vor dem Haken seine Ausführung über dieselbe Schnittstelle wie Heute); Titel öffnet den Editor (auch bei Daily-Läufen); Daily-Läufe mit "Daily" vorn in der Metazeile; "…" mit denselben schnellen Tagen wie Heute und "Anderer Tag …". Läufe künftiger Tage halten die Ringspalte frei.
- **Plan:** kompakte Zeilen der Tagesspalten (siehe Wochenplan-Brett); der Griff ist dort die eine Bedienung, weil sieben Spalten schmal sind; X und Leertaste erreichen die Zeile. Die Questlog-Spalte trägt "…" mit "Einplanen auf …".

### Aktionsmenü
Eine gemeinsame Komponente (`ActionMenu`): ein leiser runder Auslöser "…" (Tap-Größe, Name "Aktionen für <Titel>", `aria-haspopup="menu"`, `aria-expanded`), geöffnet ein Menü mit dem Titel des Eintrags als Überschrift in Tinte. Unter 40rem ein weißes Blatt von unten (oben Kartenecke, Scrim `rgb(43 29 22 / 18%)`), ab 40rem ein Popover am Auslöser (mind. 15rem, Kartenecke), unter dem Auslöser oder, wo unten kein Platz ist, darüber. Es hängt am Ende der Seite (Teleport), damit kein scrollendes Brett es abschneidet. Einträge sind leise Buttons in Tinte mit Icon links; wo ein Kürzel dasselbe tut (T, D, W), steht es als Tastenkappe rechts (nur wo eine Tastatur wahrscheinlich ist) und als `aria-keyshortcuts`. Pfeile, Pos1 und Ende wandern, Escape und ein Tipp daneben schließen und geben den Fokus an den Auslöser zurück; ein Eintrag gibt den Fokus erst zurück und läuft dann, so kehrt ein Dialog, den er öffnet, richtig zurück. "Löschen" steht zuletzt, durch eine Haarlinie abgesetzt, ebenfalls in Tinte; erst der Bestätigungsdialog zeigt "Ja, löschen" rot.

### Dashboard-Muster
Wo eine Ansicht Zahlen auf einen Blick zeigt, stehen Karten nebeneinander statt untereinander unter Abschnittstiteln. Jede Karte trägt ihren Titel innen als kleines Label (`.card-title`: gedämpfte Tinte 700, 0.875rem, Tabellenziffern, nie Versalien), rechts daneben in `.card-head` eine leise Zahl, Legende oder ein Nebenbutton. Ein Raster, ein Abstand: 0.75rem am Handy, ab 40rem 1rem zwischen allen Karten.
- **Kennzahlen-Reihe:** drei gleich breite Karten (ab 40rem), je Label, Zahl groß (800, clamp 1.625–2.25rem) mit der Einheit kleiner daneben in gedämpfter Tinte (0.55em, "5 Std. 55 Min.", "92 %"), darunter eine gedämpfte Zeile. Am Handy wird die Reihe zu einer Karte: die erste Kennzahl groß oben, unter einer Haarlinie die beiden anderen nebeneinander. Unbekanntes ist "–".
- **Diagrammkarten:** Säulen und Balken sind handgeschriebenes CSS ohne Bibliothek, mit fester oder begrenzter Höhe, Werten als Text (nie nur beim Hover), tabellarischen Ziffern und einer Text-Alternative, die alle Werte nennt. Hervorgehoben wird mit Tinte, nie mit Orange. Heute ist in einem Diagramm leise markiert: "Heute" statt des Kürzels in Tinte 800 und eine 2px-Grundlinie in Tinte unter seiner Säule, kein Rahmen; so führen die Daten, nicht die Markierung. Eine Zahl steht nur einmal: Was eine Kennzahl sagt, wiederholt keine Diagrammkarte.
- **Raster:** eine breite Diagrammkarte (etwa drei Fünftel) neben einer Spalte aus zwei kleineren Karten; die Karten einer Reihe sind gleich hoch, das große Diagramm füllt seine Karte (11–16rem). Darunter Karten über die ganze Breite. Am Handy steht alles in derselben Folge untereinander.

### Wochenrückblick
Ab 56rem bis 72rem breit (wie der Plan breiter als die Seitenspalte), darunter in Seitenbreite. Kopfzeile: Titel "Wochenrückblick" mit gedämpfter Einleitung "Wie weit die Woche deine Kampagnen gebracht hat." und rechts auf derselben Zeile die Wochenwahl: "Diese Woche" als getönte Pille (nur abseits der laufenden Woche, The Way-Back Rule; danach geht der Fokus auf den Zeitraum), runder Zurück-Button, der Zeitraum fett mit "diese Woche" / "vor 3 Wochen" gedämpft darunter, Vor-Button. Am Handy rutscht die Wochenwahl auf eine eigene Zeile, der Zeitraum mittig.

Oben das Dashboard, darunter die Einzelheiten, alles nach dem Dashboard-Muster:
1. **Kennzahlen** (Quest-Stunden, Tagesschnitt, Quest-Arbeit). Die Quest-Stunden sind die eine gehobene Karte der Ansicht (am Handy die ganze Kennzahlen-Karte): "von 20 Std. Wochenziel", dazu ein flacher Tintenbalken (0.5rem) mit "30 % vom Ziel" am gemeinsamen unteren Rand der Reihe. Ohne Ziel nur die Stunden. Tagesschnitt mit "über 3 Tage bisher", Quest-Arbeit als Anteil ("92 %") mit "von 6 Std. gemessen"; den Anteil nennt nur diese Kennzahl.
2. **Quest-Stunden je Tag** neben **Stunden je Kampagne** und **Quest-Arbeit gegen Sonstiges**. Säulen: sieben Spalten, Wert in h:mm oben, Säule in Tinte auf einer Apricot-Grundlinie, heute mit einer 2px-Grundlinie in Tinte und "Heute" (800) statt des Kürzels, ohne Rahmen; kommende Tage zeigen "–" in leiser Tinte; "Std.:Min." leise im Kopf. Balkenliste: Marke, Name und "3 Std. von 6 Std." über einer Pillen-Spur (0.5rem) in der Marke, alle Zeilen auf einer Skala, das Wochenziel als 2px-Tintenstrich mit Legende. Aufteilung: geteilter Pillenbalken, Quest-Arbeit in Tinte, Sonstiges in mark-none, darunter beide Zeiten mit Legende; den Anteil sagt die Kennzahl darüber (die Text-Alternative des Balkens nennt ihn mit).
3. **Quest-Stunden · letzte Wochen** über die ganze Breite: acht Säulen, die gezeigte Woche in Tinte, die anderen in leiser Tinte, unter jeder Wert und Datum, die laufende Woche mit "bisher"; der Schnitt der Wochen davor als gestrichelte gedämpfte Linie, sein Wert oben rechts im Kopf.
4. **Fortschritt je Kampagne:** eine Karte, die Legende ("in dieser Woche", "vorher") im Kopf; Zeilen als Links zur Kampagne (wo Platz ist zwei nebeneinander), links ein gerader 5px-Streifen in der Marke als gerundeter Balken, Hover in Apricot-Grund, Druck federt, Chevron gedämpft: Titel, "9 von 12 Quests · 75 %" (das Nomen folgt der Zahl: "0 von 1 Quest", "0 von 1 Ausführung"), die Änderung fett ("+4 Quests, 62 % → 75 %"), eine Spur mit dem Stand vorher in heller Marke (40 % Marke auf Weiß) und dem Zuwachs der Woche in voller Marke, darunter die Läufe eines Daily-Ziels. Ein zurückgerechneter Stand sagt es in einer leisen Zeile.
5. **Dailies im Wochensoll** und **Perfekte Woche** als zwei flache Karten nebeneinander; eine allein nimmt die Breite.
6. **Erledigt** mit Zähler: eine Karte, die Tage nebeneinander, wo Platz ist, je Tag Überschrift mit Zähler und Zeilen mit Verlaufspunkten. Am Handy zu Beginn zu, mit "Alle 11 Einträge zeigen" als getönter Pille im Kopf; ab 56rem offen bis acht Einträge, darüber ebenfalls zu.
7. **Rückblick:** drei Textflächen mit Fragen als Label (800), ab 56rem nebeneinander, "Speichern" als einziger Primär-Button, ruhig solange nichts geändert ist, "Gespeichert" still daneben.

Diagramme erscheinen nur für gemessene Zeit. Eine Woche ohne gemessene Zeit und ohne Erledigtes zeigt eine Leerzustandskarte statt der Diagramme, die Kennzahlen und die letzten Wochen bleiben um sie herum, wenn frühere Wochen Zeit haben. Beim Laden halten Skelettflächen das Raster des Dashboards. Ein verfehltes Wochenziel ist eine Zahl; nirgends Warn- oder Fehlerfarbe.

### Zählregel des Tages
Heute, die Kalenderwoche, der Kalendertag und das Monatsraster zählen einen Tag gleich (`utils/day-tally.ts`):
- **erledigt:** Quests und Daily-Läufe, die an diesem Tag erledigt wurden, auch wenn sie für einen früheren Tag geplant waren.
- **geplant:** erledigt plus, was für diesen Tag selbst noch offen ist (Termine eingeschlossen, auch der heutige Lauf eines Wochenziels).
- **von früher:** was von einem früheren Tag noch offen ist; das gibt es nur heute. Es steht neben der Zahl, nicht darin.
- **übersprungen:** zählt weder als erledigt noch als geplant; ein Überspringen ist eine Entscheidung, keine Arbeit, die wartet.

Heute heißt das "1 von 7 erledigt · 1 von früher" (dazu "· 1 übersprungen", wenn es das gibt), ein vergangener Tag nennt nur "4 erledigt", ein kommender "3 geplant". Google-Termine zählen nicht mit; die Woche nennt sie dahinter ("· 1 Termin").

**The Same-Count Rule.** Derselbe Tag hat in jeder Ansicht dieselben Zahlen mit denselben Worten. Was von früher wartet, wird genannt, nie still in "geplant" gezählt.

### Zeit in Heute
Unter dem Datum die Zählung des Tages ("2 von 5 erledigt · 1 von früher", siehe Zählregel des Tages), darunter eine leise Zeile, gedämpfte Tinte 600, 0.875rem, Tabellenziffern, die gearbeitete Zeit und Quest-Stunden in Beziehung setzt, statt sie nebeneinander zu stellen: "1 Std. 40 Min. gearbeitet, davon 1 Std. 20 Min. auf Kampagnen · Woche 4 Std. 11 Min. von 20 Std.". Ging alles auf Kampagnen: "…, alles auf Kampagnen"; nichts: nur "40 Min. gearbeitet", und die Woche sagt, was sie zählt ("Kampagnen diese Woche 4 Std. 11 Min. von 20 Std."). Heute noch nichts gearbeitet: nur die Woche. Ohne Wochenziel nur die Zahlen; ohne gemessene Zeit und ohne Ziel keine Zeile. Nie farbig, auch nicht unter dem Ziel.

### Fokuskarte (Signature)
Die eine große, gehobene Karte oben auf Heute: Titel als Headline (antippen öffnet den Editor), rechts oben in der Ecke der leise Griff, wo der Plus-Button ihn nie verdeckt; darunter (bei einem Termin nach seiner Zeitspanne) Warum-Satz in Body Large und Metazeile mit Kategoriemarke, Minuten, Zielstand und, wenn ihre Stoppuhr läuft, "läuft" bzw. "pausiert". Ein Daily nennt "Daily" mit Icon zuerst in der Metazeile. Darunter genau eine Aktionszeile, auch bei 375px: "Erledigt" (Primär, nimmt den Platz; ab 40rem höchstens 18rem breit), ▶ und Fokus-Modus als runde getönte Icon-Buttons (Name und Tooltip "Fokus-Modus"), dann "…" mit Überspringen und Verschieben wie bei den Zeilen.

**The Turn Rule.** Die Fokuskarte zeigt, was jetzt dran ist (`currentItem` in `utils/today-agenda.ts`, dieselbe Regel im Fokus-Modus): ein Termin (Quest oder Daily mit Uhrzeit) von seinem Beginn bis zu seinem Ende, also Beginn plus geplanter Dauer, ohne Dauer 30 Minuten; überschneiden sich zwei, der zuletzt begonnene. Sonst der Kopf der Reihenfolge, das Nächste, woran man arbeiten kann. Vor seinem Beginn und nach seinem Ende steht ein Termin nur in "Termine"; ein unerledigter vergangener Termin bleibt dort leiser (80 % Deckkraft), nie als Warnung. Ein Termin vertritt nie eine leere Reihenfolge: Ist sie leer, sagt eine ruhige Karte "In der Reihenfolge ist nichts mehr offen." und nennt den nächsten Termin. Die Karte wechselt von selbst, solange die Seite offen ist: Ein Zeitgeber wartet genau bis zum nächsten Beginn oder Ende (und bis ein Termin hinter die Jetzt-Linie rückt), statt die Uhr abzufragen; nach dem Aufwachen eines Geräts holt die Ansicht nach. Als Fokuskarte zeigt ein Termin unter dem Titel seine Zeitspanne groß in Tinte (Kalender-Icon, "10:00–10:45", 1.125rem, 800), behält "Erledigt" und ▶ (ein Meeting zu messen ist legitim) und "…" mit "Termin verschieben …"; der Fokus-Modus fehlt, denn dort gibt es für Termine weder "Später" noch eine Reihenfolge, und auch der Griff fehlt, weil ein Termin nicht in der Reihenfolge steht.

### Fokus-Ansicht
Eine Quest allein auf dem Grund, mittig, ohne Tab-Leiste und ohne Stoppuhr-Leiste: Kampagnen-Pille (weiß, mit Marke), Titel als Headline, Warum-Satz gedämpft, darunter die Stoppuhr als größte Schrift der App (800, clamp 4–7rem, Tabellenziffern; solange sie nicht läuft in leiser Tinte). Darunter Zustand ("Bereit", "Läuft", "Pausiert", "Soll erreicht") mit Soll, heute schon gearbeiteter Zeit und bei einem Termin seiner Zeitspanne ("Termin 10:00–10:30"), dann genau eine Primäraktion (Starten, Pausieren, Weiter) neben "Erledigt", leise darunter "Später" und "Überspringen". Unter einer Haarlinie nennt eine kleine Liste nur, was danach kommt und wann der nächste Termin ist. Was im Blick steht, folgt der Turn Rule der Fokuskarte; nur eine laufende Stoppuhr hält ihren Eintrag im Blick. Ist die Reihenfolge leer und wartet noch ein Termin, heißt es "Nichts in der Reihenfolge" mit dem nächsten Termin, nicht "Alles erledigt". Oben links führt ein Link zurück zu Heute.

### Stoppuhr-Leiste
Weiße Karte, die oben haftet: Zustand und Titel links, die gearbeitete Zeit in Tinte mit "von n Min." darunter, rechts runde getönte Icon-Buttons (Pause/Weiter, Soll ändern, Erledigen, Beenden). Sie zählt hoch; ist das Soll erreicht, sagt eine ruhige Zeile, dass die Stoppuhr weiterläuft.

Unter 40rem ist sie eine Zeile (rund 60px): Zustand klein über dem Titel (beide mit Auslassung), die Zeit (1.25rem), Pause/Weiter und ein "…" ("Weitere Aktionen der Stoppuhr") mit Soll ändern, Erledigen und Beenden. Die Zeile zum erreichten Soll wird dort nur vorgelesen; der Zustand oben sagt es in einem Wort.

### Reihenfolge des Tages
Fokuskarte und die Einträge darunter sind eine sortierbare Liste. Jede Zeile trägt in der Zeitspalte einen Griff aus sechs Punkten in leiser Tinte, die Fokuskarte rechts oben: ziehen (Maus, Finger, Stift) oder mit Pfeil hoch/runter verschieben. Beim Ziehen bleibt am alten Platz eine 35 % deckende Lücke, die gezogene Zeile hebt der Kartenschatten. Wer an den Kopf rückt, wird zur Fokuskarte. Darüber steht das Schnell-Anlegen: ein Feld mit Segment "Oben | Unten" und dem leisen Label "Neue Quests" (gedämpfte Tinte 700; am Handy klein über dem Segment, ab 40rem links daneben), damit klar ist, dass es entscheidet, wo neue Quests in die Reihenfolge kommen. "Auf morgen" im Kopf der Ansicht verschiebt alles Offene ohne Uhrzeit nach einer Rückfrage.

### Wochenplan-Brett
Sieben Tagesspalten von Montag bis Sonntag, jede eine flache Fläche in 35 % Weiß mit Kartenecke; heute trägt den 2px-Tintenrahmen des Kalenders und "Heute" in der Überschrift. Kopf jeder Spalte: Wochentag (800) und Datum in gedämpfter Tinte, darunter leise "3 offen · 1 Std. 30 Min." (Label, tabellarisch). Darunter die offenen Einträge in der Reihenfolge des Tages, das Schnell-Anlegen als halbtransparentes Feld ohne Rahmen ("Quest hinzufügen …", wo das nicht ganz ins Feld passt "Hinzufügen …", nie mitten im Wort abgeschnitten; Enter legt am Ende an), zuletzt Erledigtes durchgestrichen in gedämpfter Tinte. Die Zählzeile bricht nur zwischen ihren Teilen ("3 offen" · "1 Std. 30 Min."). Vergangene Tage zeigen nur, was geschah, ohne Schnell-Anlegen. Ein leerer Tag sagt ruhig "Noch frei.".

Einträge sind kompakte weiße Zeilen mit Control-Ecke: Titel (700, 0.9375rem; in den schmalsten Spalten, Zeile unter 8.25rem, 0.875rem) über der ganzen Breite, darunter die Kampagne fett in einer Zeile mit Auslassung (der Streifen nennt sie schon), dann die Metazeile (Uhrzeit, Soll, "seit 15. Nov." für Liegengebliebenes; jeder Teil bleibt ganz) und rechts daneben der Griff, auch wenn es keine Metazeile gibt: Ein Griff neben dem Titel ließe einer Desktop-Spalte für ein deutsches Wort zu wenig Platz. Der Griff ist die eine Verschiebe-Bedienung: ziehen, mit Pfeil hoch/runter in der Reihenfolge, mit Pfeil links/rechts auf den Nachbartag, antippen öffnet "Verschieben". Ist die Zeile breit genug (Container ab 15rem, also mobil), steht der Griff neben Titel und Metazeile, die Kampagne wieder am Ende der Metazeile.

**The Whole-Word Rule.** Titel im Plan brechen zwischen Wörtern (`overflow-wrap: break-word`, nie `anywhere`); nur ein Wort, das länger ist als die ganze Zeile, bricht in sich. Silbentrennung (`hyphens: auto`, nur Wörter ab zehn Zeichen) hilft, wo das Gerät ein deutsches Wörterbuch hat, aber die Spaltenbreiten verlassen sich nie darauf: Chromium unter Windows hat keines. Nach drei Zeilen endet ein Titel mit Auslassung; Tooltip und Name für Screenreader tragen ihn ganz. Dailies liegen in 55 % Weiß, ohne Griff und ohne Aktion, mit Dailies-Icon und "Daily" in der Metazeile. Der Kampagnen-Streifen gilt wie auf Heute; die Quest einer Kampagne selbst wiederholt ihren Namen nicht. Kopfzeile der Ansicht: der Zeitraum als Seitentitel ("16.–22. Nov."), rechts Vor/Zurück als runde Icon-Buttons und davor, nur abseits der laufenden Woche, "Diese Woche" als getönte Pille (siehe The Way-Back Rule). Beim Laden halten Skelettflächen die Spalten des Bretts (mit der Questlog-Spalte, wo es sie gibt); sie werden beschnitten, nie seitwärts gescrollt.

**Questlog-Spalte** (ab 56rem, links vom Brett): eine Fläche wie eine Tagesspalte (35 % Weiß, Kartenecke), Kopf mit Questlog-Icon, "Questlog", Zähler und einem runden Chevron-Button zum Zuklappen; darunter gedämpft "Auf einen Tag ziehen oder über „…“ einplanen." und die offenen Quests ohne Tag, an denen man arbeiten kann (wie das Questlog: keine Kampagnen, keine Questreihen mit offenen Quests), als dieselben kompakten Zeilen mit Kampagnen-Streifen. Ihr Griff ist nur zum Ziehen (nicht fokussierbar); daneben "…" mit "Einplanen auf …" für jeden Tag des Bretts ab heute ("Heute, 18. Nov.", "Donnerstag, 19. Nov." …), die Tastatur- und Tipp-Alternative. Abgelegt steht die Quest sofort an ihrem Platz und verschwindet aus der Spalte; scheitert das Speichern, kehrt beides zurück. Zugeklappt bleibt eine Leiste in Tap-Breite mit Chevron, senkrechtem "Questlog" und Zähler. Ohne eigene Wahl ist sie ab 80rem offen und darunter zu, damit die Woche zuerst ganz zu sehen ist; wer sie auf- oder zuklappt, behält das auf dem Gerät. Am Handy gibt es die Spalte nicht.

### Kampagnen-Streifen
Ein Eintrag, der zu einer Kampagne gehört, trägt links einen 5px breiten Streifen in der Marke der Kampagne (ihre gespeicherte Farbe, sonst die aus dem Titel) und nennt sie fett in der Metazeile; das Symbol der Kampagne steht nur auf Kachel und Detailkarte, nicht in Einträgen. Einträge ohne Kampagne bleiben ohne Streifen.

### Eintrag mit Haken-Ring (Signature)
Zeit (oder Griff) | Ring | Inhalt | ▶ | "…". Nur Termine und Dailies mit Uhrzeit zeigen eine Zeit. Der Ring (`CheckRing`) ist 1.875rem, 2.5px Orange; erledigt füllt er sich orange und der Haken springt mit `check-pop` (Skalierung von 0.4, --spring) ein, der Titel wird durchgestrichen und gedämpft. Übersprungen: gestrichelter Ring in leiser Tinte. Derselbe Ring trägt Questlog (Erledigtes unter "n erledigt" eingeklappt), Kampagnen und die Tageslisten des Kalenders. Jede Zeile hält links Platz für den Kampagnen-Streifen, damit Ringe mit und ohne Streifen fluchten.

### Kampagnen-Kachel
Weiße Karte mit dem 5px-Kampagnenstreifen links: runde Plakette in der Marke (Tap-Größe) mit dem Symbol in Weiß (ohne Symbol das Kampagnen-Icon), Titel (800) als Button, dessen Fläche die ganze Karte deckt; Fokus als Ring um die Karte. Darunter der Wochenstand in Tabellenziffern ("3 Std. 30 Min. von 6 Std." fett, "diese Woche" gedämpft; die Zeile bricht nur zwischen "3 Std. 30 Min.", "von 6 Std." und "diese Woche", nie mitten in einer Angabe), bei Wochenziel ein flacher Tintenbalken (0.375rem) auf tiefem Apricot, der bei Übererfüllung einfach voll ist, dann der Verlauf der letzten acht Wochen als feine Linie in der Marke über einer Apricot-Grundlinie (fest 2.5rem hoch, Text-Alternative mit allen Wochen) und "Insgesamt …" gedämpft. Über den Kacheln die Segmentwahl Aktiv · Abgeschlossen. Hat eine geöffnete Kampagne noch keine Quests, sagt eine leise Zeile unter "Quests der Kampagne", wo "Unter-Quest hinzufügen" steht.

### Kampagnen-Detailkarte
Die geöffnete Kampagne ist eine flache Karte mit ihrem Streifen (die gehobene bleibt frei, The One-Lifted-Card Rule). Von oben nach unten, jede Zahl einmal:
- **Kopf:** Plakette mit Symbol, Titel (1.375rem, 800; gedämpft "Abgeschlossen" darunter, wenn sie es ist), rechts "…" mit den Aktionen der Kampagne.
- **Ihr Warum** direkt darunter in Body Large, gedämpft, höchstens 60ch: wozu die Kampagne da ist. Ohne Warum keine Zeile.
- **Diese Woche** (Gruppe unter einer Haarlinie, Titel als `.card-title`): "1 Std. 10 Min. von 6 Std." fett mit "Quest-Stunden" gedämpft, bei Wochenziel ein flacher Tintenbalken (0.5rem), übererfüllt einfach voll; darunter die Kopfzeile "letzte 8 Wochen" links und "insgesamt 20 Std. 20 Min." rechts über dem Verlauf als feine Linie in der Marke (Text-Alternative mit allen Wochen). Ohne Quest-Stunden (nicht geladen) fehlt die Gruppe.
- **Fortschritt** (Gruppe unter einer Haarlinie), nur wenn Quests darunter stehen: "1 von 4 Quests" in Tinte 700, mit "· 30 von 195 Min.", wenn der Balken Minuten zählt, darüber nichts weiter; dann der flache Tintenbalken und das Burnup. Erst ab zwei Tagen Verlauf zeigt das Burnup die Segmentwahl Erledigt · Noch offen und Anzahl · Minuten, die Linien (höchstens 30rem breit), die Legende und "Stand 18.11., seit 29.10." (bei Minuten mit den Zahlen, die der Balken nicht nennt); an einem Tag steht statt alledem einmal "Der Verlauf beginnt heute. Ab morgen zeigt hier eine Linie, wie es vorangeht."
- **"Bearbeiten"** als getönte Pille zuletzt; der Editor heißt hier "Kampagne bearbeiten".

### Farbe und Symbol wählen
Im Bearbeiten-Dialog einer obersten Quest hinter dem Aufklapper "Kampagne (Farbe, Symbol, Wochenziel)", der offen beginnt, sobald eins davon gesetzt ist, und zugeklappt die Wahl nennt ("Beere · Füller · 6 Std. pro Woche"); beim Anlegen einer Kampagne offen. Farben als runde Muster (2rem in Tap-Fläche), gewählt mit weißem Haken und Tintenring; "Automatisch aus dem Titel" als Ring in der abgeleiteten Marke. Symbole als Kacheln in Control-Ecke mit Apricot-Linie, gewählt Tinte auf Weiß. Unter jeder Gruppe steht die Wahl in Worten ("Beere", "Füller"), jede Option hat einen gesprochenen Namen. Darunter "Wochenziel in Stunden" als Zahlfeld in halben Stunden.

### Kampagnen-Zeile
Weiße Karte je Quest: Einrückungslinie, Chevron zum Auf- und Zuklappen (sonst Platzhalter in Tap-Breite), Haken-Ring, Titel als Button, Metazeile mit Kategoriemarke. Nur Quests mit Unter-Quests zeigen Fortschritt als flachen Balken mit Zähler; er zählt nur die Quests darunter, nie die Quest selbst ("1/3" bei drei Quests, eine erledigt; "30/90 Min.", wenn jede darunter eine Dauer hat). Rechts der Auslöser des gemeinsamen Aktionsmenüs (Stoppuhr starten, Unter-Quest hinzufügen, Fortschritt anzeigen, Verschieben, Löschen).

### Kampagne abschließen
Der Ring einer Kampagne (oberste Quest), unter der noch Quests offen sind, fragt im üblichen Dialog: Titel "Kampagne abschließen?", gedämpft "3 Quests in „Buch“ sind noch offen. Sie bleiben offen; die Kampagne steht danach unter „Abgeschlossen“.", dann "Kampagne abschließen" als Primär-Button und "Abbrechen". Das stimmt mit dem Modell überein: Erledigen betrifft nur die Kampagne selbst, die Quests darunter behalten Zustand und Tag. Ohne offene Quests darunter fragt nichts. Danach sagt der Toast "„Buch“ abgeschlossen" mit Rückgängig. Gilt in Kampagnen (Ring im Baum, "Kampagne abschließen" im "…" der Detailkarte), Heute und im Plan (X); das Questlog führt keine Kampagnen, und der Kalender kennt die Kampagne seiner Zeilen nicht und fragt nicht. Beim Ziehen wird das Ziel mit 2px gestrichelter gedämpfter Tinte umrandet.

### Daily-Karte
Weiße, flache Karte: vorn der Haken-Ring für den heutigen Lauf, wo einer fällig ist oder heute erledigt wurde (gefüllt; antippen öffnet ihn wieder), mit Rückgängig im Toast wie auf Heute; Dailies ohne heutigen Lauf halten die Ringspalte frei, pausierte haben keine. Dann Titel (als Button zum Bearbeiten), Warum-Satz in gedämpfter Tinte (das eigene, sonst das übernommene der Quest, die das Daily zählt), Metazeile mit dem Stand der Woche zuerst in Tinte, dann Kategoriemarke und dem Rhythmus in Klartext. Der Stand kommt aus derselben Lesart der Woche wie der Kalender: ein Wochenziel zählt ("2 von 3 diese Woche"), ein Zeitplan nennt heute ("heute fällig", "heute erledigt", "heute übersprungen") oder den nächsten Tag dieser Woche ("morgen fällig", "Freitag fällig", sonst "diese Woche nicht mehr fällig"). Nie farbig; lädt die Woche nicht, fehlt nur der Stand. Pausierte Dailies gedämpft und ohne Stand. Die Kopfzeile der Ansicht folgt dem Seitenmuster: der Einleitungssatz steht unter dem Titel, nicht daneben.

### Kalender
Kopfzeile in zwei Zeilen statt einer Wand aus Steuerelementen: oben der Zeitraum als Titel-Button, der den Datumswähler öffnet, rechts daneben der Filter als leiser Icon-Button (siehe Chips); darunter links die Segmentwahl Monat · Woche · Tag (am Handy so breit, wie Vor/Zurück übrig lassen), rechts Vor und Zurück als runde getönte Icon-Buttons. "Heute" erscheint als getönte Pille vor den Pfeilen nur, wenn der gezeigte Zeitraum heute nicht enthält; nach dem Tippen geht der Fokus auf den Titel, der den neuen Zeitraum nennt (The Way-Back Rule). Die Tab-Folge entspricht der Sicht: Titel, Filter, Modus, Heute, Zurück, Vor. So stehen, solange heute gezeigt wird, sechs Bedienelemente und ein leises Icon vor dem Inhalt statt acht.
- **Monat:** Raster aus Tagen in Control-Ecke, heute mit 2px-Tintenrahmen innen, gewählt weiß mit Kartenschatten. Unter jeder Zahl ruhige Punkte (0.4375rem): gefüllt für Erledigtes, Ring für Offenes, ein kurzer Strich in leiser Tinte für Termine (eigene Quests mit Uhrzeit, offen oder erledigt, und Termine aus Google Kalender); darunter die Zeit im Logbuch als kleine Zahl in gedämpfter Tinte ("2 Std. 15 Min.", mobil "2:15 h"), keine Heatmap. Eine Legende in Label-Größe erklärt alles. Die Liste des gewählten Tages folgt dem Zeilenvertrag: offene Quests mit Ring (Rückgängig im Toast), Titel öffnet den Editor, "…" mit Morgen, Nächste Woche (und Heute für Liegengebliebenes) und "Anderer Tag …".
- **Woche:** Quotenkarte "Dailies im Wochensoll" (Label oben, große Zahl "3 von 12", darunter "fälligen Ausführungen erledigt", flacher Tintenbalken auf tiefem Apricot); darunter Daily-Zeilen mit Haarlinien, das Logbuch der Woche als Zeilen je Kampagne (Marke, Name, Zeit; zugleich Legende) und eine weiße Karte pro Tag. Eine Tageskarte mit gemessener Zeit trägt einen gestapelten Pillenbalken (0.625rem) in den Kampagnenmarken, ohne Spur und am längsten Tag der Woche gemessen, daneben die Summe als Text. Die Zeile darüber zählt nach der Zählregel des Tages ("1 von 7 erledigt · 1 von früher" heute, "4 erledigt" vorher, "3 geplant" danach, dazu Google-Termine); ein Tag ohne Zählung heißt "Nichts geplant", und wurde trotzdem Zeit gemessen, sagt er es mit: "Nichts geplant · 2 Std. 10 Min. gemessen", damit Wort und Balken sich nicht widersprechen.
- **Tag:** links die Tagesreflexion, darunter leise die Zählung des Tages (gedämpfte Tinte 600, Tabellenziffern), dann "Offen / geplant", "Von früher", "Erledigt", "Übersprungen" (dieselben Zeilen wie im Monat) und Wochenziele. Offenes steht wie auf Heute: Termine nach Uhrzeit, der Rest in der Reihenfolge des Tages (die Regel liegt beim Server, `day-order.ts`); was von früher wartet, hat seine eigene Gruppe wie Nachholen. Erledigtes steht in der Folge, in der es erledigt wurde, auch an vergangenen Tagen; rechts (mobil darunter) der Abschnitt "Logbuch" mit Summe ("Logbuch 1 Std. 40 Min."; künftige Tage "Termine") und die Zeitachse: Stundenlinien in Apricot-Linie, Uhrzeiten in leiser Tinte, zwei Spuren "Geplant" und "Gemessen" (4rem je Stunde), damit Abschnitt und Spur nicht beide "Logbuch" heißen. Die Achse reicht von der vollen Stunde des frühesten Eintrags (Geplantes, Erledigtes oder gemessener Abschnitt) bis zur vollen Stunde nach dem spätesten, wie er gezeichnet ist; sie beginnt nie später als 8 und endet nie früher als 18 Uhr, ein leerer Tag zeigt 8 bis 18. Geplant-Blöcke in 55 % Weiß; Erledigtes ohne geplante Uhrzeit steht in der Spur "Geplant" als schmale Marke (1.5rem, Pille in 55 % Weiß) zur Zeit des Abhakens: der gefüllte Punkt der Verlaufszeile in gedämpfter Tinte mit weißem Haken und der Titel, vorgelesen als ein Satz "Titel, erledigt um 05:37" (der sichtbare Titel ist für Screenreader verborgen, damit nichts doppelt oder mit losem Komma gelesen wird); sie ist ein Zustand, kein Bedienelement. Gemessen-Blöcke weiß mit dem 5px-Kampagnenstreifen (ohne Kampagne mark-none), Titel und Dauer; überlappende Blöcke stehen nebeneinander, jeder Block mindestens 2.75rem hoch und antippbar zum Korrigieren. Darunter eine Karte mit den Abschnitten als Liste (Korrigieren, Löschen; die Quelle heißt "Stoppuhr" oder "Nachtrag") und, eingeklappt, ein leiser Button "Zeit nachtragen" mit Plus (`aria-expanded`): er öffnet Eintrag, Von, Bis, "Nachtragen" und "Abbrechen" an Ort und Stelle, der Fokus geht ins erste Feld; Abbrechen und Escape klappen zu und geben den Fokus an den Button zurück. Ein abgelehnter Nachtrag behält die Felder und zeigt den Grund; ein gespeicherter klappt zu und gibt den Fokus an den Button. "Löschen" nimmt den Abschnitt sofort aus Liste und Zeitachse, der Fokus geht zum Nachbarn, der Toast sagt "Abschnitt „Lesen“ gelöscht" mit Rückgängig; solange zeigt der Kopf "Logbuch" ohne Summe, weil die Summe des Servers den Abschnitt noch zählt. Ohne Abschnitt sagt eine ruhige Zeile "Heute wurde noch keine Zeit gemessen." bzw. "An diesem Tag wurde keine Zeit gemessen.".

### Verlaufszeile
Nur lesend: statt des antippbaren Rings ein kleiner gefüllter Punkt (1.25rem) in gedämpfter Tinte mit weißem Haken; übersprungen gestrichelt in leiser Tinte. Ein Zustand, kein Bedienelement, daher nie orange.

### Fortschrittsbalken
Pillen-Spur in tiefem Apricot (0.625rem in der Quote), Füllung flache Tinte, Breitenwechsel 240ms --ease-out. Gilt für "Dailies im Wochensoll" und Quests mit Unter-Quests.

### Undo-Toast
Gemeinsame Komponente für Heute, Questlog, Plan, Kalender, Kampagnen und Dailies: jede Erledigung mit dem Ring (oder X) und das Löschen eines Logbuch-Abschnitts. Tintenfarbene Pille über Tab-Leiste und Plus-Button, weiße Schrift 600, rechts ein weißer Pillen-Button "Rückgängig" in tiefem Orange. Erscheint mit 0.75rem Aufstieg in 240ms und bleibt fünf Sekunden. Ein Löschen wartet hinter dem Toast: Erst wenn er abläuft, ein neuer ihn ersetzt, die Ansicht wechselt oder die Seite schließt, geht es zum Server; "Rückgängig" zeigt das Gelöschte nur wieder. Die Leiste der Stoppuhr ("Erledigen") und der Fokus-Modus ("Erledigt") haben keinen Toast; dort folgt die nächste Quest.

### Einzelkarte: Anmeldung und Boot-Fehler
Eine ruhige, gehobene weiße Karte mittig auf dem Grund. Anmeldung: Wortmarke (runder Apricot-Hauch mit Tinten-Icon, Name in Title), Headline, gedämpfte Einleitung, Felder, ein einziger voller Primär-Button über die ganze Breite, darunter leise Text-Links. Boot-Fehler: zentriert "Keine Verbindung zum Server" (1.375rem, 800), gedämpfte Erklärung (max. 34ch) und ein Primär-Button zum erneuten Versuch, ohne Rot.

### Lade- und Leerzustände
Skelett aus 55 %-weißen Kartenflächen (Basis 4.25rem; Fokus 13rem, Einträge 4.5rem), pulsierend zwischen voller und halber Deckkraft (1.6s). Leerzustand als weiße Karte, zentriert, fetter Titel plus gedämpfter Satz.

## Do's and Don'ts

### Do:
- **Do** Farben, Ecken, Abstände, Tap-Größen und Bewegung ausschließlich über die Tokens in `frontend/src/style.css` beziehen; eine neue Farbe bekommt einen Wert für Hell und für Dunkel.
- **Do** neue Farbpaare in `frontend/src/theme.spec.ts` aufnehmen, damit beide Themen ihren Kontrast halten.
- **Do** neue Ansichten aus den gemeinsamen Bausteinen (Seite, Buttons, Felder, Segmentwahl, Chips, Karte, Leerzustand, Hinweis, Skelett) zusammensetzen.
- **Do** jede Nebenaktion als getönte Pille (action-tint, Schrift action-strong) bauen und pro Kontext höchstens einen orange gefüllten Primär-Button setzen.
- **Do** Zeilenaktionen in einem Menü "Aktionen für …" bündeln: unteres Blatt auf dem Handy, Popover ab 40rem.
- **Do** antippbare Elemente mit `--press` drücken und über `--spring` (420ms) zurückfedern lassen.
- **Do** Tap-Ziele von mindestens 2.75rem halten, auch auf dem Desktop.
- **Do** Kategorien mit `categoryMark()` als kleine Marke zeigen, nie als eingefärbte Fläche.
- **Do** Icons aus der Strichfamilie in AppIcon ergänzen (24px, Strich 2, runde Enden).
- **Do** Uhrzeiten und Zählungen mit tabellarischen Ziffern setzen.

### Don't:
- **Don't** Orange auf nicht antippbare Elemente legen (Überschriften, Linien, Status, Fortschritt, Kategorien, Verlaufspunkte).
- **Don't** Grau verwenden; Text und Linien bleiben in der warmen Tinten- und Apricot-Familie.
- **Don't** Verläufe, harte versetzte Schatten oder schwarze Schatten einsetzen; im Dunkeln keine schwereren Schatten, sondern Haarlinien.
- **Don't** Farbliterale (#…, rgb(), white) in Komponenten schreiben; ein Test lehnt sie ab.
- **Don't** im Dunkeln neutrales Grau, reines Schwarz oder reines Weiß verwenden.
- **Don't** Überfälliges rot färben oder als Warnblock oben stapeln; Nachholen ist ein Angebot in tiefem Apricot.
- **Don't** Rot für Löschwege vor der endgültigen Bestätigung verwenden; "Löschen" im Menü ist Tinte.
- **Don't** eine zweite Farbe für Auswahl einführen; gewählt heißt Tinte auf Weiß.
- **Don't** Konfetti oder Spielelemente als Bestätigung zeigen; die Bestätigung ist der gefüllte Ring und der Toast mit Rückgängig.
- **Don't** Überzeilen in Versalien über Titel setzen; Kontext steht in der Metazeile.
