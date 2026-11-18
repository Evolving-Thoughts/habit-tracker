---
name: Habit-Tracker
description: Warmer, ruhiger Tagesplaner für Quests, Dailies und Kampagnen, gebaut für eine Hand am Handy.
colors:
  ground: "#fde4d0"
  ground-deep: "#f9d3b5"
  surface: "#ffffff"
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
    backgroundColor: "{colors.surface}"
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
- **Apricot-Hauch** (action-tint): Fläche der sekundären, getönten Buttons (Überspringen, Bearbeiten, Verschieben, Timer, Dialog-Schließen), Hover der leisen Buttons, ruhige Fläche des deaktivierten Primär-Buttons, Grund der Wortmarke.
- **Dichter Apricot-Hauch** (action-tint-hover): Hover des getönten Timer-Buttons; eine Stufe dichter als der Hauch, nie als Ruhefläche.
- **Auf Aktion** (on-action): Schrift und Icons auf Orange.

### Secondary
- **Marken** (mark-moss, mark-pine, mark-sage, mark-slate, mark-indigo, mark-heather, mark-plum, mark-berry, mark-walnut, mark-ochre): Tokens in `style.css`, nie Orange, in Helligkeit wie Farbton gestaffelt, damit sie auch bei Rot-Grün-Schwäche meist unterscheidbar bleiben; jede Verwendung nennt Kategorie oder Kampagne zusätzlich in Text. Kategorien speichern keine Farbe; der Name wird per FNV-1a-Hash stabil auf eine von sechs Marken abgebildet (Moos, Schiefer, Heide, Ocker, Salbei, Walnuss) und als kleines Quadrat (0.625rem, Ecke 0.2rem) vor den Namen gesetzt. Eine Kampagne kann eine der zehn Marken speichern; ohne gespeicherte nimmt sie die aus ihrem Titel. Die Entscheidung fällt immer in `campaignMark()`.
- **Ohne Kampagne** (mark-none): helles, warmes Neutral für gemessene Zeit ohne Kampagne, im Logbuch neben den Marken.

### Neutral
- **Apricot-Grund** (ground): Seitenhintergrund, Scrollbar-Spur, Hover im Filtermenü.
- **Tiefer Apricot** (ground-deep): eingelassene Fläche des Nachholen-Panels, Spur der Segmentwahl und Spur aller Fortschrittsbalken.
- **Kartenweiß** (surface): Karten, Leerzustände, Tab-Leiste, Dialoge, Menüs, gewähltes Segment und gewählter Chip, Buttons, die direkt auf dem Grund liegen ("Auf morgen", Nachholen-Chips). Flacher als eine Karte über eigene Tokens: `surface-flat` (55 % Weiß) für Kalendertermine, Plan-Blöcke der Zeitachse, Dailies im Plan und Ladeskelette; `surface-faint` (35 %) für die Tagesspalten im Plan; `surface-quiet` (70 %) für deren Schnell-Anlegen.
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
| surface-faint | rgb(255 255 255 / 35%) | rgb(255 238 222 / 2.5%) |
| surface-flat | rgb(255 255 255 / 55%) | rgb(255 238 222 / 5%) |
| surface-quiet | rgb(255 255 255 / 70%) | rgb(255 238 222 / 8%) |
| line | #f1cfb4 | #44352b |
| line-strong | #a07d66 | #8a705f |
| selection | #fbc79f | #6e3b1f |
| scrim | rgb(43 29 22 / 40%) | rgb(10 6 4 / 60%) |
| scrim-light | rgb(43 29 22 / 18%) | rgb(10 6 4 / 40%) |
| ink | #2b1d16 | #f6e9df |
| ink-muted | #6b4d3d | #cdb4a4 |
| ink-soft | #7a5846 | #a88d7c |
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

**The Hairline-Not-Shadow Rule.** Schatten sieht man auf Dunkel kaum. Gehobenes (Fokuskarte, Popover, Dialog, gewähltes Segment) bekommt statt eines schwereren Schattens eine helle Haarlinie (`0 0 0 1px` in 7–9 % Warmweiß); Popover und Dialog behalten darunter einen weichen dunklen Schatten. Eingelassenes (ground-deep) liegt tiefer als der Grund.

**The Marks-At-Night Rule.** Die zehn Marken sind nachts heller und etwas ruhiger, weiter in der Helligkeit gestaffelt; mark-none ist nachts dunkler als die Marken, damit "ohne Kampagne" leiser bleibt.

Der Undo-Toast bleibt eine Pille in Tinte und ist im Dunkeln deshalb hell mit dunkler Schrift. Native Bedienelemente, Scrollbars und Autofill folgen `color-scheme` (light bzw. dark).

### Kontrast
Ein Test (`frontend/src/theme.spec.ts`) liest beide Token-Sätze aus `style.css` und prüft die Paare, die die App zeichnet: Text 4.5:1, Marken, Ringe, Symbole, Feldrahmen und Fokusring 3:1. Durchscheinende Flächen werden auf den Grund gerechnet.

| Paar | Hell | Dunkel | Mindestens |
|---|---|---|---|
| ink / ground · ground-deep · surface · surface-flat | 13.32 · 11.64 · 16.28 · 14.89 | 14.97 · 15.96 · 12.81 · 13.30 | 4.5 |
| ink-muted / ground · ground-deep · surface · surface-flat | 6.24 · 5.45 · 7.63 · 6.97 | 9.05 · 9.65 · 7.74 · 8.04 | 4.5 |
| ink-soft / ground · ground-deep · surface · surface-flat | 5.19 · 4.53 · 6.34 · 5.80 | 5.74 · 6.12 · 4.91 · 5.10 | 4.5 |
| action / surface · action-tint | 5.18 · 4.69 | 6.14 · 5.67 | 4.5 |
| action / ground (Plus-Button, Ringe; dort steht keine Schrift) | 4.24 | 7.17 | 3 |
| action-strong / action-tint · action-tint-hover · surface · ground · ground-deep | 6.66 · 5.97 · 7.36 · 6.03 · 5.26 | 7.41 · 6.34 · 8.01 · 9.36 · 9.98 | 4.5 |
| on-action / action · action-strong | 5.18 · 7.36 | 7.01 · 9.15 | 4.5 |
| success / surface | 5.05 | 6.95 | 4.5 |
| danger / surface · danger-tint | 6.57 · 5.93 | 6.66 · 6.35 | 4.5 |
| ink / danger-tint (Hinweisfläche) | 14.67 | 12.21 | 4.5 |
| surface / ink (Undo-Toast) | 16.28 | 12.81 | 4.5 |
| line-strong / surface · ground (Feldrahmen) | 3.74 · 3.06 | 3.31 · 3.87 | 3 |
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
- **Display** (800, clamp 1.75–2.25rem, 1.1, -0.02em, balanciert): Wochentag und Datum oben auf "Heute" und der Seitentitel jeder Ansicht (dort mit 6vw-Mittelwert). Die Wochenquote im Kalender steht als Zahl noch größer (800, clamp 2.25–3rem, 1).
- **Headline** (800, clamp 1.5–1.875rem, 1.15, -0.015em): Titel der Fokuskarte und der Anmeldekarte.
- **Title** (800, 1.125rem): Abschnittstitel ("Termine", Einstellungs-Abschnitte), Titel im Leerzustand, Wortmarke; Dialog- und Boot-Fehlertitel 1.375rem im selben Gewicht.
- **Body Large** (1.0625rem): Warum-Satz der Fokuskarte (max. 60ch), Eintragstitel (700), Primär-Button (800).
- **Body** (400, 1rem, 1.45): Fließtext und Feldeingaben; Fortschritt und "Danach" in 600; Seiteneinleitung gedämpft, max. 60ch.
- **Label** (700, 0.875rem, tabellarische Ziffern): Uhrzeiten, Metazeilen, "Jetzt", Feldlabels, Zähler neben Abschnittstiteln. Metazeile der Fokuskarte und Button-Schrift 0.9375rem; Wochentage im Monatsraster 0.8125rem.
- **Nav Label** (700, 0.75rem): Tab-Beschriftung mobil; ab 56rem 0.9375rem.

### Named Rules
**The Tabular-Time Rule.** Jede Uhrzeit, Minutenangabe und Zählung ("10/35 Min.", "1 von 4", "3 von 12") setzt tabellarische Ziffern.

**The Weight-Not-Case Rule.** Betonung kommt über 700/800, nie über Versalien oder Sperrung. Inline-Labels wie "Danach" stehen fett im Satz, nicht als Überzeile.

## Layout

Eine zentrierte Spalte: `min(100% - 2rem, 46rem)`, oben 1.5rem, unten 2rem plus Platz für den Plus-Button. Jede Ansicht beginnt mit derselben Kopfzeile: Seitentitel links, Steuerung rechts (umbrechend), optional ein gedämpfter Einleitungssatz auf eigener Zeile, 1.5rem Abstand zum Inhalt. Abschnitte öffnen mit einem Abschnittstitel 2rem darüber, optional mit Zähler. Abstandsraster in sechs Stufen (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2rem); Karten im Abstand 0.5rem, Abschnitte 2rem, Fokus zu Nachholen 1.5rem.

Anmeldung und Boot-Fehler sind die Ausnahme: eine einzelne Karte (26–27rem breit) mittig auf dem Grund, ohne Tab-Leiste.

Die Kampagnen beginnen mit Kacheln (Raster, je mindestens 14rem, mobil eine Spalte) über dem ganzen Baum; eine geöffnete Kampagne ersetzt Kacheln und Baum durch ihre Detailkarte und nur ihren Teilbaum, darüber "Alle Kampagnen" als leiser Zurück-Button.

Mobil steht unten eine feste Tab-Leiste (4.25rem plus Safe Area) mit vier Zielen (Heute, Questlog, Kampagnen, Kalender) und "Mehr" (Plan, Wochenrückblick, Fokus, Dailies, Kategorien, Einstellungen), das ein Popover über der Leiste mit Scrim öffnet. Die Ziele sind Links mit eigener Adresse; beim Wechsel springt die Ansicht nach oben und nimmt den Fokus; der Body hält per Polsterung Abstand zur Leiste. Ab 56rem wird die Leiste zur oberen Leiste (3.5rem hoch, Innenbreite 64rem): links die fünf Hauptansichten mit Namen (Plan direkt nach Heute), rechts "Befehle" für das Befehlsmenü. Zehn Ziele mit Beschriftung brauchen rund 78rem: Bis 82rem sammelt deshalb ein beschrifteter Button "Mehr" (Icon, Name, kleiner Pfeil) die rechte Gruppe (Wochenrückblick, Fokus, Dailies, Kategorien, Einstellungen) in einem weißen Popover unter der Leiste, mit Icon und Namen je Eintrag; er ist dasselbe "Mehr" wie am Handy, nur ohne Scrim und ohne Plan, und gilt als aktueller Tab, wenn eine seiner Ansichten offen ist. Ab 82rem wächst die Innenbreite auf 80rem, "Mehr" entfällt und alle zehn Ziele stehen mit Namen in der Leiste (Polster etwas enger, 0.625rem); "Befehle" behält dort nur die Lupe in Tap-Größe, der Name bleibt für Screenreader und im Tooltip. Die Tasten Strg K stehen ab 64rem als kleine Tastenkappen neben "Befehle", wo eine Tastatur wahrscheinlich ist.

Der Kalender-Tag nutzt ab 56rem bis zu 64rem Breite: links die Liste des Tages, rechts die Zeitachse (19–24rem); mobil stehen beide untereinander. Der Plan ist die weitere Ausnahme von der Seitenspalte: Er nutzt bis zu 90rem Breite, damit sieben Tagesspalten (mind. 10.5rem) nebeneinander passen. Reicht die Breite nicht, scrollen die Tage innerhalb des Bretts seitwärts, nie die Seite. Unter 40rem füllt ein Tag 85 % der Breite, der nächste lugt herein, die Spalten rasten ein. Der Plus-Button sitzt mobil über der Leiste rechts, auf breiten Schirmen neben der Seitenspalte; Questlog, Kampagnen und Dailies legen über denselben Plus-Button an. Unter 32rem werden Karten- und Dialogpolster auf 1rem reduziert. Ab 40rem wird das Aktionsmenü vom unteren Blatt zum Popover am Auslöser.

Einträge sind ein Raster aus Zeitspalte (2.75rem), Haken-Spalte (Tap-Breite) und Inhalt; Kalendertermine halten dieselbe Flucht, ohne Haken. In den Kampagnen rückt jede Ebene ein, eine 1px-Apricot-Linie führt zur Elternzeile. Tap-Ziele messen mindestens 2.75rem, große Ziele 3rem, der Primär-Button 3.25rem.

## Elevation & Depth

Weitgehend flach. Tiefe entsteht durch Tonwechsel: weiße Karte auf Apricot, eingelassenes Panel in tieferem Apricot, halbtransparentes Weiß für nicht abhakbare Termine. Ein einziger leiser, warmbrauner Kartenschatten hebt pro Ansicht höchstens eine ruhende Karte: die Fokuskarte auf Heute, die Quotenkarte in der Kalenderwoche, die Kennzahlen-Karte im Wochenrückblick (dort liegt die Quotenkarte flach), die Anmeldekarte, die Boot-Fehlerkarte. Sonst hebt er nur einen Auswahlzustand (gewählter Tag im Monatsraster). Alles Schwebende (Tab-Leiste, Popover, Filtermenü, Aktionsmenü, Dialog, Toast, Plus-Button) bekommt einen weichen, diffusen Schatten in warmem Braun.

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
**The One-Lifted-Card Rule.** Pro Ansicht trägt höchstens eine ruhende Karte den Kartenschatten. Listenkarten, Leerzustände und Einstellungskarten liegen flach.

**The Warm-Shadow Rule.** Schatten sind weich, diffus und warmbraun getönt, nie schwarz, nie hart versetzt.

## Shapes

Großzügig gerundet in drei Stufen: Karten, Panels, Leerzustände, Hinweisflächen, Dialoge und Popover 1.375rem (das Aktionsmenü als unteres Blatt nur oben gerundet); Felder, Kalendertage, Filtermenü und der große Primär-Button 0.875rem; alle übrigen Buttons, Segmentwahl, Chips, Fortschrittsbalken, Schalter und Toast als Pille. Runde Icon-Buttons (Timer, Dialog-Schließen, Haken) sind Kreise in Tap-Größe. Der Plus-Button ist ein weiches Quadrat (3.5rem, Ecke 1.125rem). Rahmen kommen fast nicht vor; nur Felder und ungewählte Chips tragen eine 1.5px-Apricot-Linie, Listenzeilen trennt eine 1px-Haarlinie. Gestrichelt ist nur, was nicht stattfindet oder noch nicht ist: Übersprungenes und die Ablagefläche beim Ziehen.

Icons stammen aus einer eigenen Strichfamilie (AppIcon): 24px-Raster, Strich 2, runde Enden und Ecken, `currentColor`. Dazu gehören die sechzehn Kampagnen-Symbole (Buch, Code, Hantel, Herz, Zuhause, Aktentasche, Doktorhut, Musik, Blatt, Geld, Werkzeug, Füller, Kamera, Globus, Stern, Fahne). Aktive Tabs heben den Strich auf 2.4, der Haken im Primär-Button auf 2.6, im Ring auf 3. In Buttons messen Icons 1.125rem.

## Components

Alle Ansichten setzen sich aus dem gemeinsamen Bausatz in `frontend/src/style.css` zusammen: Seite (`.page`, `.page-header`, `.page-title`, `.page-lead`, `.section-title`, `.count`), Buttons (`.btn` und Varianten), Felder und Auswahl (`.field`, `.input`, `.segmented`, `.chips` / `.chip`, `.switch`), Tastenkappen (`.kbd`), Flächen und Zustände (`.card`, `.empty-state`, `.alert`, `.form-error`, `.skeleton`, `.visually-hidden`). Neue Ansichten komponieren diese Bausteine, statt Buttons und Felder einzeln zu stylen.

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
- **Press:** `scale(0.97)` beim Drücken (90ms), Rückfederung über `--spring` (420ms). Haken drücken auf 0.86, Timer auf 0.92.
- **Disabled:** Nebenbuttons verlieren die Fläche und werden leise Tinte. Ein noch nicht verfügbarer Primär-Button wird ruhig: Apricot-Hauch mit leiser Tinte, Cursor `not-allowed`; während er arbeitet, Cursor `progress`.

### Chips
- **Segmentwahl:** Pillen-Spur in tiefem Apricot (0.25rem Innenabstand), Optionen in gedämpfter Tinte 700; die gewählte ist Weiß mit Tinte und leiser Auflage. Für Modi wie Monat · Woche · Tag. Als Buttons mit `aria-pressed` oder, wo es eine echte Auswahl ist (Darstellung), als `role="radiogroup"` mit versteckten nativen Radios in den Labels.
- **Filter-Chip:** Pille mit 1.5px-Apricot-Linie, gedämpfte Tinte; gewählt Weiß mit Tintenrahmen und Tinte. Im Kalender öffnet ein solcher Chip das Filtermenü (weiß, Control-Ecke, Kartenschatten, Einträge mit Hover in Apricot-Grund).

### Cards / Containers
- **Corner Style:** 1.375rem.
- **Background:** Weiß; Termine 55 % Weiß; Nachholen-Panel tiefer Apricot.
- **Shadow Strategy:** höchstens eine gehobene Karte pro Ansicht (siehe Elevation).
- **Border:** keine; Zeilen in Listenkarten trennt eine Haarlinie (Kategorien, Kalenderzeilen).
- **Internal Padding:** Basis 1rem; Fokus 1.5rem (unten 1rem), Quote 1.5rem, Einträge 0.5–1rem.
- **Einstellungen:** jede Gruppe eine flache Karte mit Abschnittstitel; zuerst "Wochenziel Quest-Stunden" (Satz, Zahlfeld in Stunden, getöntes "Speichern", stille Rückmeldung "Gespeichert."), dann "Darstellung": eine Radiogruppe im Look der Segmentwahl ("Wie das Gerät", "Hell", "Dunkel"), darunter gedämpft "Gilt auf diesem Gerät." und bei "Wie das Gerät", was gerade gilt; Schalter (`.switch`, für Benachrichtigungen und Tastenkürzel) sind eine Zeile mit kleiner Pillen-Spur (3 × 1.75rem) in Tap-Fläche, aus leise Tinte, an Orange, weißer Daumen federt über. "Tastatur" erscheint nur, wo eine Tastatur wahrscheinlich ist: Schalter "Tastenkürzel", ein gedämpfter Satz, darunter die Tastenkürzel-Liste.

### Inputs / Fields
- **Style:** Label darüber in gedämpfter Tinte 700, 0.875rem. Feld weiß, 1.5px Feldrahmen (line-strong), Platzhalter in leiser Tinte, Ecke 0.875rem, Tap-Höhe, Polster 0.75rem, Schrift 1rem 400; Textflächen mit Rundum-Polster und vertikal ziehbar.
- **Focus:** 3px-Ring in tiefem Orange, Abstand 2px; Caret orange.
- **Error:** Formularfehler als Satz in Fehlerrot 700, 0.9375rem; Ladefehler als Hinweisfläche (Fehlerhauch, Tinte, Kartenecke) mit Wiederholen-Button.
- **Gespeichert:** stille Rückmeldung als gedämpfter Text neben dem Feld (Kategorien, Tagesreflexion), kein Toast.

### Navigation
- **Tab-Leiste:** Weiß, Icon über 0.75rem-Label (700), inaktiv gedämpfte Tinte, aktiv Orange mit kräftigerem Strich. Druck federt. Ab 56rem oben, Icon neben Label.
- **Mehr:** ein Disclosure-Button (`aria-expanded`, `aria-controls`) über einer Liste von Links, die man mit Tab durchläuft. Am Handy ein weißes Popover über der Leiste mit Scrim `rgb(43 29 22 / 18%)`; zwischen 56rem und 82rem ein Popover unter dem Button ohne Scrim. Escape schließt und gibt den Fokus an den Button zurück, ein Klick daneben, Tab aus der Liste heraus und jeder Ansichtswechsel schließen ebenfalls.
- **Befehle:** leiser Tab mit Lupe und Namen, ab 82rem nur die Lupe; öffnet das Befehlsmenü.

### Befehlsmenü
Strg K oder "Befehle" öffnen einen Dialog nahe dem oberen Rand: Titel "Befehle", darunter das Suchfeld, dann die Einträge als Zeilen in Tap-Höhe (Tinte 700, Control-Ecke), ohne Suche gruppiert nach "Ansichten" und "Aktionen" (Gruppentitel gedämpft 0.875rem), mit Suche als eine Liste nach Treffergüte. Der aktive Eintrag liegt in Apricot-Hauch mit tiefem Orange, wie Hover in Menüs. Rechts stehen die Tasten des Eintrags als Tastenkappen. Findet die Suche nichts, sagt eine ruhige Fläche in Apricot-Grund "Nichts gefunden für „…“."

### Tastenkappe (`.kbd`)
Eine Taste: mindestens 1.75rem breit und hoch, Ecke `--radius-key` (0.375rem, kantig genug für eine Taste, keine Pille), Apricot-Grund mit einer 2px-Kante in tiefem Apricot unten, Tinte 700 in 0.8125rem. Mehrere Tasten stehen mit 0.25rem Abstand nebeneinander ("Strg" "K"). Abgeschaltete Kürzel stehen in leiser Tinte, ihre Kappen blasser. Kappen erscheinen nur, wo eine Tastatur wahrscheinlich ist.

### Tastenkürzel-Liste
In der Übersicht ("?") und in Einstellungen › Tastatur dieselbe Liste: Gruppentitel (800, 1rem), darunter Zeilen mit der Aktion links und den Tastenkappen rechts, getrennt durch Haarlinien.

### Aktionsmenü
Ein Menü "Aktionen für …" pro Zeile statt verstreuter Buttons. Unter 40rem ein weißes Blatt von unten (oben Kartenecke, Scrim `rgb(43 29 22 / 18%)`), ab 40rem ein Popover am Auslöser (mind. 15rem, Kartenecke); beide mit dem Titel des Eintrags als Überschrift in Tinte. Einträge sind leise Buttons in Tinte mit Icon links. "Löschen" steht zuletzt, durch eine Haarlinie abgesetzt, ebenfalls in Tinte; erst der Bestätigungsdialog zeigt "Ja, löschen" rot.

### Wochenrückblick
Eine Spalte in Seitenbreite, Kopfzeile wie im Plan (Titel "Wochenrückblick", Vor/Zurück und "Diese Woche"), darunter der Zeitraum fett mit "diese Woche" / "vor 3 Wochen" gedämpft. Abschnitte mit Abschnittstitel in fester Folge; Diagramme sind kleine handgeschriebene CSS-Stücke ohne Bibliothek, mit fester Höhe, tabellarischen Ziffern und einer Text-Alternative, die alle Werte nennt.
- **Kennzahlen-Karte** (die eine gehobene Karte der Ansicht): Label "Quest-Stunden", die Zahl groß (800, clamp 2–2.75rem), darunter "von 20 Std. Wochenziel · 18 %" gedämpft und ein flacher Tintenbalken; unter einer Haarlinie zwei Kennzahlen nebeneinander (Label, Zahl 1.375rem 800, gedämpfte Erläuterung). Ohne Ziel nur die Stunden, unbekannte Werte als "–".
- **Säulen je Tag:** sieben Spalten, Wert in h:mm über jeder Säule (nie nur beim Hover), Säule in Tinte auf einer Apricot-Grundlinie (6rem hoch), heute mit dem 2px-Tintenrahmen des Kalenders und "Heute" statt des Kürzels; kommende Tage zeigen "–" in leiser Tinte.
- **Balkenliste je Kampagne:** Zeilen mit Marke, Name und "3 Std. von 6 Std."; darunter eine Pillen-Spur in tiefem Apricot, gefüllt in der Marke der Kampagne, alle Zeilen auf einer Skala; das Wochenziel ist ein 2px-Tintenstrich, in einer Legende erklärt.
- **Fortschrittszeilen:** weiße Karten mit 5px-Kampagnenstreifen als Link zur Kampagne (Chevron gedämpft, Druck federt): Titel, "9 von 12 Quests · 75 %", die Änderung fett ("+4 Quests, 62 % → 75 %"), eine Spur mit dem Stand vorher in heller Marke (40 % Marke auf Weiß) und dem Zuwachs der Woche in voller Marke.
- **Aufteilung:** ein geteilter Pillenbalken (1rem), Quest-Arbeit in Tinte, Sonstiges in mark-none, darunter beide Zahlen mit Anteil.
- **Letzte Wochen:** acht Säulen, die gezeigte Woche in Tinte, die anderen in leiser Tinte, der Schnitt der Wochen davor als gestrichelte gedämpfte Linie mit Wert darüber.
- **Erledigt:** je Tag eine Überschrift mit Zähler und eine Listenkarte mit Verlaufspunkten, Kampagne mit Marke in der Metazeile.
- **Rückblick:** drei Textflächen mit Fragen als Label (800), "Speichern" als einziger Primär-Button, ruhig solange nichts geändert ist, "Gespeichert" still daneben.
- Eine Woche ohne gemessene Zeit und ohne Erledigtes zeigt eine Leerzustandskarte statt leerer Diagramme. Ein verfehltes Wochenziel ist eine Zahl; nirgends Warn- oder Fehlerfarbe.

### Quest-Stunden in Heute
Eine leise Zeile im Kopf unter dem Fortschritt, gedämpfte Tinte 600, 0.875rem, Tabellenziffern: "Quest-Stunden heute 1 Std. 20 Min. · Woche 6 Std. von 20 Std.". Ohne Wochenziel nur die Zahlen; ohne gemessene Quest-Zeit und ohne Ziel keine Zeile. Nie farbig, auch nicht unter dem Ziel.

### Fokuskarte (Signature)
Die eine große Karte oben auf Heute: Titel als Headline, Warum-Satz in Body Large, Metazeile mit Kategoriemarke, Uhrzeit, Minuten und Zielstand, darunter "Erledigt" (Primär), Timer (runder getönter Icon-Button) und getönte Nebenaktionen. Sie zeigt, was jetzt dran ist: den Kopf der Reihenfolge oder einen gerade laufenden Termin. Rechts in der Aktionszeile sitzt ein leiser Griff.

### Fokus-Ansicht
Eine Quest allein auf dem Grund, mittig, ohne Tab-Leiste und ohne Timerleiste: Kampagnen-Pille (weiß, mit Marke), Titel als Headline, Warum-Satz gedämpft, darunter die Stoppuhr als größte Schrift der App (800, clamp 4–7rem, Tabellenziffern; solange sie nicht läuft in leiser Tinte). Darunter Zustand ("Bereit", "Läuft", "Pausiert", "Soll erreicht") mit Soll und heute schon gearbeiteter Zeit, dann genau eine Primäraktion (Starten, Pausieren, Weiter) neben "Erledigt", leise darunter "Später" und "Überspringen". Unter einer Haarlinie nennt eine kleine Liste nur, was danach kommt und wann der nächste Termin ist. Oben links führt ein Link zurück zu Heute.

### Timerleiste
Weiße Karte, die oben haftet: Zustand und Titel links, die gearbeitete Zeit in Tinte mit "von n Min." darunter, rechts runde getönte Icon-Buttons (Pause/Weiter, Soll ändern, Erledigen, Beenden). Sie zählt hoch; ist das Soll erreicht, sagt eine ruhige Zeile, dass die Stoppuhr weiterläuft.

### Reihenfolge des Tages
Fokuskarte und die Einträge darunter sind eine sortierbare Liste. Jede Zeile trägt in der Zeitspalte einen Griff aus sechs Punkten in leiser Tinte: ziehen (Maus, Finger, Stift) oder mit Pfeil hoch/runter verschieben. Beim Ziehen bleibt am alten Platz eine 35 % deckende Lücke, die gezogene Zeile hebt der Kartenschatten. Wer an den Kopf rückt, wird zur Fokuskarte. Darüber steht das Schnell-Anlegen: ein Feld mit Segment "Oben | Unten". "Auf morgen" im Kopf der Ansicht verschiebt alles Offene ohne Uhrzeit nach einer Rückfrage.

### Wochenplan-Brett
Sieben Tagesspalten von Montag bis Sonntag, jede eine flache Fläche in 35 % Weiß mit Kartenecke; heute trägt den 2px-Tintenrahmen des Kalenders und "Heute" in der Überschrift. Kopf jeder Spalte: Wochentag (800) und Datum in gedämpfter Tinte, darunter leise "3 offen · 1 Std. 30 Min." (Label, tabellarisch). Darunter die offenen Einträge in der Reihenfolge des Tages, das Schnell-Anlegen als halbtransparentes Feld ohne Rahmen ("Quest hinzufügen …", Enter legt am Ende an), zuletzt Erledigtes durchgestrichen in gedämpfter Tinte. Vergangene Tage zeigen nur, was geschah, ohne Schnell-Anlegen. Ein leerer Tag sagt ruhig "Noch frei.".

Einträge sind kompakte weiße Zeilen mit Control-Ecke: Titel (700, 0.9375rem) über der ganzen Breite, darunter die Metazeile (Uhrzeit, Soll, "seit 15. Nov." für Liegengebliebenes, Kampagne fett) und rechts der Griff. Der Griff ist die eine Verschiebe-Bedienung: ziehen, mit Pfeil hoch/runter in der Reihenfolge, mit Pfeil links/rechts auf den Nachbartag, antippen öffnet "Verschieben". Ist die Zeile breit genug (Container ab 15rem, also mobil), steht der Griff neben Titel und Metazeile. Dailies liegen in 55 % Weiß, ohne Griff und ohne Aktion, mit Dailies-Icon und "Daily" in der Metazeile. Der Kampagnen-Streifen gilt wie auf Heute. Kopfzeile der Ansicht: der Zeitraum als Seitentitel ("16.–22. Nov."), rechts Vor/Zurück als runde Icon-Buttons und "Diese Woche" als getönte Pille.

### Kampagnen-Streifen
Ein Eintrag, der zu einer Kampagne gehört, trägt links einen 5px breiten Streifen in der Marke der Kampagne (ihre gespeicherte Farbe, sonst die aus dem Titel) und nennt sie fett in der Metazeile; das Symbol der Kampagne steht nur auf Kachel und Detailkarte, nicht in Einträgen. Einträge ohne Kampagne bleiben ohne Streifen.

### Eintrag mit Haken-Ring (Signature)
Zeit (oder Griff) | Ring | Inhalt. Nur Termine und Dailies mit Uhrzeit zeigen eine Zeit. Der Ring ist 1.875rem, 2.5px Orange; erledigt füllt er sich orange und der Haken springt mit `check-pop` (Skalierung von 0.4, --spring) ein, der Titel wird durchgestrichen und gedämpft. Übersprungen: gestrichelter Ring in leiser Tinte. Derselbe Ring trägt den Questlog (Timer neben dem Titel, Erledigtes unter "n erledigt" eingeklappt) und den Kampagnen.

### Kampagnen-Kachel
Weiße Karte mit dem 5px-Kampagnenstreifen links: runde Plakette in der Marke (Tap-Größe) mit dem Symbol in Weiß (ohne Symbol das Kampagnen-Icon), Titel (800) als Button, dessen Fläche die ganze Karte deckt; Fokus als Ring um die Karte. Darunter der Wochenstand in Tabellenziffern ("3 Std. 30 Min. von 6 Std." fett, "diese Woche" gedämpft), bei Wochenziel ein flacher Tintenbalken (0.375rem) auf tiefem Apricot, der bei Übererfüllung einfach voll ist, dann der Verlauf der letzten acht Wochen als feine Linie in der Marke über einer Apricot-Grundlinie (fest 2.5rem hoch, Text-Alternative mit allen Wochen) und "Insgesamt …" gedämpft. Über den Kacheln die Segmentwahl Aktiv · Abgeschlossen. Die geöffnete Kampagne zeigt dieselben Teile groß in einer flachen Detailkarte, dazu Fortschritt, Burnup und "Bearbeiten".

### Farbe und Symbol wählen
Im Bearbeiten-Dialog einer obersten Quest: Farben als runde Muster (2rem in Tap-Fläche), gewählt mit weißem Haken und Tintenring; "Automatisch aus dem Titel" als Ring in der abgeleiteten Marke. Symbole als Kacheln in Control-Ecke mit Apricot-Linie, gewählt Tinte auf Weiß. Unter jeder Gruppe steht die Wahl in Worten ("Beere", "Füller"), jede Option hat einen gesprochenen Namen. Darunter "Wochenziel in Stunden" als Zahlfeld in halben Stunden.

### Kampagnen-Zeile
Weiße Karte je Quest: Einrückungslinie, Chevron zum Auf- und Zuklappen (sonst Platzhalter in Tap-Breite), Haken-Ring, Titel als Button, Metazeile mit Kategoriemarke. Nur Quests mit Unter-Quests zeigen Fortschritt als flachen Balken mit Zähler. Rechts der Auslöser des Aktionsmenüs. Beim Ziehen wird das Ziel mit 2px gestrichelter gedämpfter Tinte umrandet.

### Daily-Karte
Weiße, flache Karte: Titel (als Button zum Bearbeiten), Warum-Satz in gedämpfter Tinte, Metazeile mit Kategoriemarke und dem Rhythmus in Klartext. Pausierte Dailies gedämpft.

### Kalender
Kopfzeile mit Segmentwahl Monat · Woche · Tag, Vor/Zurück und dem Zeitraum als Titel-Button, der einen Datumswähler öffnet; der Filter ist ein Menü-Chip.
- **Monat:** Raster aus Tagen in Control-Ecke, heute mit 2px-Tintenrahmen innen, gewählt weiß mit Kartenschatten. Unter jeder Zahl ruhige Punkte (0.4375rem): gefüllt für Erledigtes, Ring für Offenes, ein kurzer Strich in leiser Tinte für Termine; darunter die Zeit im Logbuch als kleine Zahl in gedämpfter Tinte ("2 Std. 15 Min.", mobil "2:15 h"), keine Heatmap. Eine Legende in Label-Größe erklärt alles.
- **Woche:** Quotenkarte mit großer Zahl ("3 von 12"), Label und flachem Tintenbalken auf tiefem Apricot; darunter Daily-Zeilen mit Haarlinien, das Logbuch der Woche als Zeilen je Kampagne (Marke, Name, Zeit; zugleich Legende) und eine weiße Karte pro Tag. Eine Tageskarte mit gemessener Zeit trägt einen gestapelten Pillenbalken (0.625rem) in den Kampagnenmarken, ohne Spur und am längsten Tag der Woche gemessen, daneben die Summe als Text.
- **Tag:** links die Tagesreflexion, Erledigtes, Übersprungenes, Geplantes und Wochenziele; rechts (mobil darunter) "Logbuch" mit Summe und die Zeitachse: Stundenlinien in Apricot-Linie, Uhrzeiten in leiser Tinte, zwei Spuren "Plan" und "Logbuch" (4rem je Stunde). Plan-Blöcke in 55 % Weiß, Logbuch-Blöcke weiß mit dem 5px-Kampagnenstreifen (ohne Kampagne mark-none), Titel und Dauer; überlappende Blöcke stehen nebeneinander, jeder Block mindestens 2.75rem hoch und antippbar zum Korrigieren. Darunter eine Karte mit den Abschnitten als Liste (Korrigieren, Löschen) und "Zeit nachtragen". Ohne Abschnitt sagt eine ruhige Zeile, dass nichts im Logbuch ist.

### Verlaufszeile
Nur lesend: statt des antippbaren Rings ein kleiner gefüllter Punkt (1.25rem) in gedämpfter Tinte mit weißem Haken; übersprungen gestrichelt in leiser Tinte. Ein Zustand, kein Bedienelement, daher nie orange.

### Fortschrittsbalken
Pillen-Spur in tiefem Apricot (0.625rem in der Quote), Füllung flache Tinte, Breitenwechsel 240ms --ease-out. Gilt für Wochenquote und Quests mit Unter-Quests.

### Undo-Toast
Gemeinsame Komponente für Heute und Questlog. Tintenfarbene Pille über Tab-Leiste und Plus-Button, weiße Schrift 600, rechts ein weißer Pillen-Button "Rückgängig" in tiefem Orange. Erscheint mit 0.75rem Aufstieg in 240ms.

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
