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
  bar: "#2b1d16"
  action: "#c2410c"
  action-strong: "#9a330a"
  action-tint: "#fff1e8"
  action-tint-hover: "#ffe2cf"
  on-action: "#ffffff"
  success: "#2e7d4f"
  danger: "#b42318"
  danger-tint: "#fff0ec"
  mark-indigo: "#6765b3"
  mark-navy: "#294d91"
  mark-ochre: "#695900"
  mark-pine: "#194516"
  mark-berry: "#984964"
  mark-plum: "#513058"
  mark-teal: "#338f9c"
  mark-walnut: "#a67a55"
  mark-moss: "#5e7454"
  mark-sage: "#195a4f"
  mark-sky: "#196ea1"
  mark-slate: "#02415c"
  mark-heather: "#793369"
  mark-wine: "#703336"
  mark-olive: "#7c8634"
  mark-lilac: "#5f5378"
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

<!-- Aufgenommen aus dem ausgelieferten Code: App-Hülle (Tab-Leiste, Mehr-Menü, Befehlsmenü, Tastenkürzel-Übersicht, Dialoge, Boot-Fehler), Heute, Plan, Wochenrückblick, Questlog, Kampagnen, Dailies, Kalender (ersetzt Kalender und Verlauf), Einstellungen (mit den Kategorien) und Anmeldung. Alle Ansichten beziehen Farben, Ecken und Abstände aus den Tokens und setzen sich aus den gemeinsamen Bausteinen am Ende von frontend/src/style.css zusammen. -->

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
- Mobile zuerst: Tap-Ziele ab 2.75rem, feste Tab-Leiste unten, ab 56rem oder bei Mausbedienung Leiste oben.
- Ein gemeinsamer Bausatz (Seite, Buttons, Felder, Segmentwahl, Chips, Karte, Zustände) für jede Ansicht.

## Colors

Ein warmes, einstimmiges Apricot-Umfeld mit einer gebrannten Orange-Stimme und sechzehn Marken für Kategorien und Kampagnen, von denen acht auch für farbenblinde Augen sicher unterscheidbar sind.

### Primary
- **Gebranntes Orange** (action): Haken-Ring und gefüllter Haken, Primär-Button "Starten" der Fokuskarte, "Alle nachholen", Dialog-Submit, Plus-Button, aktiver Tab, eingeschalteter Schalter. Außerdem `accent-color` und `caret-color`.
- **Tiefes Orange** (action-strong): Hover des Primär-Buttons, Text auf getönten Buttons, Links, Fokusring (3px, Abstand 2px).
- **Apricot-Hauch** (action-tint): Fläche der sekundären, getönten Buttons (Stoppuhr ▶, Fokus-Modus auf der Fokuskarte, Nebenaktionen in Dialogen, Dialog-Schließen), Hover der leisen Buttons und des Menü-Auslösers "…", ruhige Fläche des deaktivierten Primär-Buttons, bei Tag Grund der Wortmarke (über das Token logo-disc, das nachts auf eine sichtbare warme Stufe wechselt).
- **Dichter Apricot-Hauch** (action-tint-hover): Hover des getönten Stoppuhr-Buttons und Fläche des ▶, dessen Stoppuhr gerade läuft oder pausiert (dann mit 2px-Ring in tiefem Orange innen); eine Stufe dichter als der Hauch.
- **Auf Aktion** (on-action): Schrift und Icons auf Orange.

### Secondary
- **Kernmarken** (mark-indigo, mark-navy, mark-ochre, mark-pine, mark-berry, mark-plum, mark-teal, mark-walnut; Indigo, Nachtblau, Ocker, Tanne, Beere, Pflaume, Petrol, Walnuss): Tokens in `style.css`, nie Orange, weit in Helligkeit und Farbton gestaffelt, sodass jedes Paar auch bei Protanopie, Deuteranopie und Tritanopie klar verschieden bleibt, hell wie dunkel (`palette.spec.ts` simuliert es; siehe The Never-Colour-Alone Rule).
- **Weitere Marken** (mark-moss, mark-sage, mark-sky, mark-slate, mark-heather, mark-wine, mark-olive, mark-lilac; Moos, Salbei, Himmel, Schiefer, Heide, Weinrot, Oliv, Flieder): mehr Auswahl, für volles Farbsehen deutlich verschieden; bei Farbenblindheit können einzelne Paare zusammenfallen. Alle Farben, die vor der größeren Palette gespeichert wurden, gehören weiter dazu.
- **Wahl und Herkunft:** Kategorien und Kampagnen können eine der sechzehn Marken speichern (gewählt in der gemeinsamen Palette, `MarkPicker`); ohne gespeicherte bildet der Titel einer Kampagne per FNV-1a-Hash stabil auf eine der acht Kernmarken ab. Eine neue Kategorie ohne gewählte Farbe bekommt die erste Kernmarke in der Vergabe-Reihenfolge (Indigo, Ocker, Pflaume, Walnuss, Nachtblau, Beere, Tanne, Petrol: jede nächste so weit von den früheren, wie die Kernmarken es unter Rot-Grün-Blindheit erlauben, mit Stufen in der Helligkeit; `palette.spec.ts` prüft die ersten vier mit der Machado-Simulation), die noch keine Kategorie zeigt, gespeichert; ältere ohne gespeicherte zeigen die Marke ihres Namens, außer eine andere Kategorie zeigt sie schon, dann die erste freie in derselben Reihenfolge (der Server entscheidet das an einer Stelle, `shownCategoryColors`). So sehen zwei Kategorien nie gleich aus, solange eine Kernmarke frei ist. Gezeichnet wird immer über `categoryMark()` bzw. `campaignMark()`. Eine Kategorie zeigt sich als kleines Quadrat (0.625rem, Ecke 0.2rem) vor ihrem Namen, eine Kampagne als Streifen und Chip (siehe Kampagnen-Chip).
- **Ohne Kampagne** (mark-none): helles, warmes Neutral für gemessene Zeit ohne Kampagne, im Logbuch neben den Marken.

### Neutral
- **Apricot-Grund** (ground): Seitenhintergrund, Scrollbar-Spur, Hover im Filtermenü.
- **Tiefer Apricot** (ground-deep): eingelassene Fläche des Nachholen-Panels, Spur der Segmentwahl und Spur aller Fortschrittsbalken.
- **Kartenweiß** (surface): Karten, Leerzustände, Tab-Leiste, Dialoge, Menüs, Felder, gewähltes Segment und gewählter Chip, Buttons, die direkt auf dem Grund liegen (die Tages-Pille im Kopf von Heute, Nachholen-Chips). Flacher als eine Karte über eigene Tokens: `surface-flat` (55 % Weiß) für Kalendertermine, Termin-Blöcke und Erledigt-Marken im Tageskalender, Dailies im Plan und Ladeskelette; `surface-faint` (35 %) für die Tagesspalten im Plan, die Spalte des Tageskalenders und die heutige Spalte der Kalenderwoche; `surface-quiet` (70 %) für deren Schnell-Anlegen.
- **Gehobene Karte** (surface-raised): genau die eine ruhende Karte, die die One-Lifted-Card Rule hebt (Fokuskarte, Kampagnen-Stunden-Kennzahl im Wochenrückblick, Anmelde- und Boot-Fehlerkarte). Hell ist sie Kartenweiß und wird vom Kartenschatten gehoben; dunkel ist sie eine Stufe heller als die Zeilen (#3a2b21 auf #2f231b), weil ein Schatten auf Umbra kaum zu sehen ist.
- **Apricot-Linie** (line): Haarlinien zwischen Listenzeilen (Nachholen, Kategorien, Kalenderzeilen, Menütrenner), Einrückungslinie in den Kampagnen, Chiprahmen (1.5px), Tab-Leisten-Kante, Unterstreichung von Text-Links.
- **Feldrahmen** (line-strong): der 1.5px-Rahmen von Feldern, Auswahllisten, Textflächen und dem Notizen-Editor. Er ist oft die einzige Kante eines Felds und hält deshalb 3:1 gegen Karte und Grund.
- **Warme Tinte** (ink): Fließtext, Titel, die Jetzt-Linie (mit ihrer Uhrzeit in der Stundenspalte), der Undo-Toast, Füllung aller Fortschrittsbalken, Heute-Rahmen im Kalender (2px innen), Rahmen des gewählten Chips, "Löschen" im Aktionsmenü.
- **Gedämpfte Tinte** (ink-muted): Metazeilen, Zeiten, Fortschritt, inaktive Tabs, erledigte Titel, Feldlabels, Legende, die Punkte im Monatsraster und der Zustandspunkt in Verlaufszeilen.
- **Balken** (bar): Säulen und Balken der Diagramme und die Messbalken im Wochenrückblick (Kampagnen-Stunden gegen das Wochenziel, Kampagnen-Arbeit im geteilten Balken und in den letzten Wochen). Hell ist es die Tinte; dunkel ein ruhigerer warmer Ton (#bfa491), weil volle Tinte die Balken nachts zum hellsten Element der Seite machte.
- **Leise Tinte** (ink-soft): deaktivierte und laufende Zustände, gestrichelter Ring oder Punkt für Übersprungenes, Terminstrich im Monatsraster, ausgeschalteter Schalter.
- **Fehlerrot / Fehlerhauch** (danger, danger-tint): echte Fehlermeldungen (Hinweisfläche, Formularfehler) und als einzige Ausnahme die endgültige Löschbestätigung ("Ja, löschen"); nie für Überfälliges.
- **Erfolgsgrün** (success): nur der Haken vor einem verbundenen Google-Kalender in den Einstellungen.

### Named Rules
**The Never-Colour-Alone Rule.** Eine Marke sagt nie allein, wozu etwas gehört: Neben jedem Streifen und jedem Quadrat steht der Name der Kampagne oder Kategorie in Text, bei Kampagnen mit ihrem Symbol (Kampagnen-Chip). Farbe beschleunigt das Wiedererkennen, sie trägt keine Information, die sonst fehlt.

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
| bar | = ink (#2b1d16) | #bfa491 |
| action | #c2410c | #f08a4e |
| action-strong | #9a330a | #ffa774 |
| action-tint | #fff1e8 | #3d2619 |
| action-tint-hover | #ffe2cf | #4d2f1e |
| on-action | #ffffff | #2b1408 |
| logo-disc | = action-tint (#fff1e8) | = line-strong (#8f7563) |
| success | #2e7d4f | #6cc08e |
| danger | #b42318 | #ff8a7a |
| danger-tint | #fff0ec | #3f211b |
| mark-indigo (Kern) | #6765b3 | #8ca6f4 |
| mark-navy (Kern) | #294d91 | #518ccd |
| mark-ochre (Kern) | #695900 | #aa933a |
| mark-pine (Kern) | #194516 | #328048 |
| mark-berry (Kern) | #984964 | #e08699 |
| mark-plum (Kern) | #513058 | #7c698f |
| mark-teal (Kern) | #338f9c | #67d3e0 |
| mark-walnut (Kern) | #a67a55 | #e4b797 |
| mark-moss | #5e7454 | #bbc96d |
| mark-sage | #195a4f | #6fcf9e |
| mark-sky | #196ea1 | #3db8e0 |
| mark-slate | #02415c | #789eb3 |
| mark-heather | #793369 | #a7859a |
| mark-wine | #703336 | #ae5f74 |
| mark-olive | #7c8634 | #aab28b |
| mark-lilac | #5f5378 | #9872be |
| mark-none | #a38d7a | #857265 |

**The Warm-Night Rule.** Dunkel ist warmes Umbra, nie neutrales Grau und nie reines Schwarz; die Tinte ist Warmweiß, nie reines Weiß.

**The Still-Orange Rule.** Nachts ist das Orange heller (action #f08a4e), damit es auf Umbra als einzige Tippfarbe leuchtet; Schrift auf Orange wird dafür dunkle Tinte (on-action #2b1408), auch die Symbole auf den Kampagnen-Plaketten. "Tief" (action-strong) heißt im Dunkeln "kontrastreicher", also heller: Hover, Text auf getönten Flächen, Links und Fokusring. Orange bleibt auch nachts nur auf Antippbarem.

**The Hairline-Not-Shadow Rule.** Schatten sieht man auf Dunkel kaum. Gehobenes (Fokuskarte, Popover, Dialog, gewähltes Segment) bekommt statt eines schwereren Schattens eine helle Haarlinie (`0 0 0 1px` in 7–9 % Warmweiß); Popover und Dialog behalten darunter einen weichen dunklen Schatten. Die eine gehobene Karte einer Ansicht liegt zusätzlich eine Stufe heller (surface-raised), sonst teilt sie nachts die Farbe aller Zeilen und die Ordnung fällt zusammen. Eingelassenes (ground-deep) liegt tiefer als der Grund.

**The Marks-At-Night Rule.** Die Marken sind nachts heller, Farbton für Farbton dieselben; die Kernmarken bleiben auch nachts für jede Art des Sehens auseinander. mark-none ist nachts dunkler als die Marken, damit "ohne Kampagne" leiser bleibt.

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
| Marken / surface (kleinster Wert) | 3.78 (teal) | 3.10 (plum) | 3 |
| Marken / ground (kleinster Wert) | 3.10 (teal) | 3.63 (plum) | 3 |
| on-action / Marke (Symbol auf Plakette und Chip, kleinster Wert) | 3.78 (teal) | 3.54 (plum) | 3 |
| mark-none / surface | 3.16 | 3.33 | 3 |
| bar / surface · surface-raised · ground-deep (Säulen, Messbalken auf ihrer Spur) | 16.28 · 16.28 · 11.64 | 6.49 · 5.77 · 8.09 | 3 |

Ein zweiter Test (`frontend/src/palette.spec.ts`) prüft die Marken so, wie farbenblinde Augen sie sehen: Protanopie, Deuteranopie und Tritanopie nach Machado, Oliveira und Fernandes (2009) auf linearem sRGB, Abstand als OKLab-ΔE ×100. Die Kernmarken halten in beiden Themen jedes Paar mindestens 9 auseinander, alle sechzehn für volles Farbsehen mindestens 8; jede Marke hält 3:1 auf Karte, Grund und dem flachen Daily im Plan.

| Kernmarken, kleinster Abstand (OKLab ×100) | Hell | Dunkel |
|---|---|---|
| volles Farbsehen | 12.2 | 11.4 |
| Protanopie | 9.6 | 9.8 |
| Deuteranopie | 9.6 | 9.7 |
| Tritanopie | 9.6 | 9.8 |
| alle 16 Marken, volles Farbsehen | 8.5 | 8.6 |

## Typography

**Display Font:** Nunito Variable (mit ui-rounded, system-ui, Segoe UI, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** keine eigene; Ziffern über `font-variant-numeric: tabular-nums`

**Character:** Eine einzige runde, humanistische Familie, selbst gehostet über @fontsource-variable/nunito. Hierarchie entsteht aus Gewicht (400 / 600 / 700 / 800) und Größe, nicht aus einer zweiten Schrift.

### Hierarchy
- **Display** (800, clamp 1.75–2.25rem, 1.1, -0.02em, balanciert): Wochentag und Datum oben auf "Heute" und der Seitentitel jeder Ansicht (dort mit 6vw-Mittelwert). "Dailies im Wochensoll" ist im Wochenrückblick eine Kennzahl wie die anderen.
- **Headline** (800, clamp 1.5–1.875rem, 1.15, -0.015em): Titel der Fokuskarte und der Anmeldekarte.
- **Title** (800, 1.125rem): Abschnittstitel ("Logbuch" über dem Tageskalender, Einstellungs-Abschnitte), Titel im Leerzustand, Wortmarke; Dialog- und Boot-Fehlertitel 1.375rem im selben Gewicht.
- **Body Large** (1.0625rem): Warum-Satz der Fokuskarte und der Kampagnen-Detailkarte (max. 60ch), Eintragstitel (700), Primär-Button (800).
- **Body** (400, 1rem, 1.45): Fließtext und Feldeingaben; Fortschritt und "Danach" in 600; Seiteneinleitung gedämpft, max. 60ch.
- **Label** (700, 0.875rem, tabellarische Ziffern): Uhrzeiten, Metazeilen, "Jetzt", Feldlabels, Zähler neben Abschnittstiteln. Metazeile der Fokuskarte und Button-Schrift 0.9375rem; Wochentage im Monatsraster 0.8125rem.
- **Nav Label** (700, 0.75rem, -0.01em): Tab-Beschriftung mobil; die Tabs haben dafür kaum Seitenpolster (0.0625rem, Leiste 0.25rem), damit "Kampagnen" auch bei 360px ungekürzt passt. Ab 56rem oder bei Mausbedienung 0.9375rem ohne Sperrung.

### Named Rules
**The Tabular-Time Rule.** Jede Uhrzeit, Minutenangabe und Zählung ("10/35 Min.", "1 von 4", "3 von 12") setzt tabellarische Ziffern.

**The Weight-Not-Case Rule.** Betonung kommt über 700/800, nie über Versalien oder Sperrung. Inline-Labels wie "Danach" stehen fett im Satz, nicht als Überzeile.

**The Stopwatch-Word Rule.** Was misst, heißt in der Oberfläche "Stoppuhr", nie "Timer": in Beschriftungen, Namen für Screenreader, Menüs, Befehlsmenü, Einstellungen ("Benachrichtigen, wenn das Soll erreicht ist"), Meldungen des Servers und Push. Sie zählt hoch; das Soll hält sie nicht an, also "läuft ab" nichts. "Timer" bleibt nur ein Suchwort im Befehlsmenü und der Name im Code.

## Layout

Eine zentrierte Spalte: `min(100% - 2rem, 46rem)`, oben 1.5rem, unten Platz für den Plus-Button (`--fab-clearance`: seine Größe, sein Abstand über der Tab-Leiste und 1.5rem Luft), damit ▶ und "…" der letzten Zeile frei liegen, wenn man ans Ende scrollt. Jede Ansicht beginnt mit derselben Kopfzeile: Seitentitel links, Steuerung rechts (umbrechend), optional ein gedämpfter Einleitungssatz auf eigener Zeile, 1.5rem Abstand zum Inhalt. Abschnitte öffnen mit einem Abschnittstitel 2rem darüber, optional mit Zähler. Abstandsraster in sechs Stufen (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2rem); Karten im Abstand 0.5rem, Abschnitte 2rem, Fokus zu Nachholen 1.5rem.

Anmeldung und Boot-Fehler sind die Ausnahme: eine einzelne Karte (26–27rem breit) mittig auf dem Grund, ohne Tab-Leiste.

Heute nutzt ab 64rem die ganze Breite des Fensters (2rem Rand): links die Liste (Kopf, Schnell-Anlegen, Fokuskarte, Reihenfolge, Nachholen, Abgeschlossenes), die den Rest nimmt, rechts der Tageskalender von heute (`clamp(22rem, 30vw, 32rem)`), der in voller Fensterhöhe haftet, während die Liste scrollt. Dort gibt es keinen Plus-Button (er läge über dem ▶ der Zeilen): "Neue Quest" steht als Pille auf dem Grund (On Ground, Plus in tiefem Orange) im Kopf vor ‹ ›, damit "Starten" der Fokuskarte die eine Primäraktion bleibt, und öffnet denselben Dialog; der Kopf bricht um, bevor der Titel schmaler als 16rem würde, und die Steuerung wandert dann als Gruppe in die nächste Zeile. Darunter bleibt Heute die eine Spalte, und unter dem Kopf steht die Segmentwahl **Liste · Logbuch** (Radiogruppe "Ansicht", am Handy in zwei gleich breiten Hälften, je Option eine Tap-Höhe): "Liste" zeigt Schnell-Anlegen, Fokuskarte, Reihenfolge, Nachholen, Abgeschlossenes und Das Beste; "Logbuch" zeigt an ihrer Stelle den Tageskalender von heute in voller Breite, derselbe wie daneben am Desktop (Termine, Logbuch-Blöcke, Tippen zum Korrigieren, Ränder ziehen, "Zeit nachtragen"). Er steht dort in seiner natürlichen Höhe und scrollt mit der Seite, nie in sich; beim Öffnen rückt die Seite zur Jetzt-Linie, wenn sie unterhalb der ersten Bildschirmhälfte läge. Der Kopf des Tages bleibt in beiden stehen. An einem Tag nach heute heißt die zweite Option "Termine", wie der Tageskalender dort selbst; heute und vergangene Tage sagen "Logbuch". Die Wahl gilt je Gerät (`today:pane`), ohne Wahl beginnt Heute mit der Liste; Plus-Button und Stoppuhr-Leiste behalten ihren Abstand.

Rechts im Kopf blättern runde Icon-Buttons ‹ › ("Voriger Tag", "Nächster Tag") durch die Tage. Sie stehen an jedem Tag zuletzt und an derselben Stelle (The Still-Finger Rule): Wer blättert, muss Maus oder Finger nie versetzen. Davor steht genau eine Pille, getönt auf dem Grund: heute "Auf morgen" (verschiebt nach der Rückfrage alles Offene samt Nachholen, Termine mit ihrer Uhrzeit; nur, solange es etwas zu verschieben gibt), an einem anderen Tag "Heute", das zurückführt. Am Handy haben die Buttons die oberste Zeile für sich, neben dem Etikett eines anderen Tags, und das Datum läuft darunter über die volle Breite; so teilt kein Datum seine Zeile mit ihnen, wie lang der Wochentag auch ist. Ein anderer Tag zeigt über dem Datum klein und kräftig in gedämpfter Tinte (800, nie orange: es ist ein Etikett, kein Ziel), wie weit er weg ist ("Gestern", "Morgen", "in 3 Tagen"). Die Pille ist ein **Ablageziel**: Eine Karte (Quest oder Daily-Lauf), die man auf "Auf morgen" bzw. "Heute" zieht und dort loslässt, wandert ohne Rückfrage an diesen Tag, ein Termin mit seiner Uhrzeit; darüber sagt eine Zeile über der Liste "„Bewerbung“ steht jetzt bei morgen.". Während eine Karte gezogen wird, tragen sie einen 2px gestrichelten Rand in gedämpfter Tinte; liegt die Karte darüber, wird der Rand durchgezogene Tinte, die Pille wächst um 8 % und färbt sich in Apricot-Hauch, und die gezogene Karte tritt zurück (halb so groß, 60 % deckend, über den Zeiger gehoben), damit das Ziel lesbar bleibt. Form sagt es, nicht nur Farbe. Was nicht wandern kann, leuchtet nicht auf und sagt beim Loslassen in derselben Zeile, warum, statt still nichts zu tun: ein Google-Termin ("„Zahnarzt“ kommt aus Google Kalender und bleibt an seinem Tag. Verschieben lässt er sich nur dort.") und ein Daily-Lauf außerhalb seines Fensters ("„Lesen“ lässt sich nur bis heute verschieben."). Ein Daily-Lauf, den an einem späteren Tag erst der Zeitplan vorhersagt (noch nicht gespeichert), trägt keinen Ring, keine Füllung und einen 1.5px gestrichelten Rand in starker Linientinte innen an der Karte ("eingeplant, noch nicht da"; vorgelesen "Eingeplant; der Lauf entsteht an seinem Tag."), im Plan ebenso. Abhaken lässt er sich nicht, aber in seinem Tag ziehen wie jede Karte; auf einen anderen Tag wandert er nicht. Liegt eine Karte über einem Ablageziel, das sie nicht nimmt (ein Google-Termin, ein Lauf außerhalb seines Fensters), verblasst die Pille auf 45 % und der Zeiger sagt "nicht erlaubt". Seine Einträge stehen auf denselben Karten wie heute, mit der Zählung des Tages statt der Kopfzahlen von heute; ohne Fokuskarte, Stoppuhr, Nachholen und "Auf morgen", die zum Jetzt gehören. Ein späterer Tag hat das Schnell-Anlegen ("Quest für morgen hinzufügen") und sortiert per Ziehen; ein vergangener zeigt Erledigtes unter "Abgeschlossen", darunter Reflexion und Das Beste. Liste · Logbuch gilt auch dort.

Die Kampagnen beginnen mit Kacheln (Raster, je mindestens 14rem, mobil eine Spalte) über dem Baum "Kampagnen und ihre Quests": nur Kampagnen mit allem darunter, lose Quests ohne Kampagne stehen im Questlog, in Heute und im Plan. Eine geöffnete Kampagne ersetzt Kacheln und Baum durch ihre Detailkarte und die Quests darunter ("Quests der Kampagne"); die Kampagne selbst ist die Karte und steht nicht noch einmal als Zeile im Baum. Darüber "Alle Kampagnen" als leiser Zurück-Button. Ohne Kampagne zeigt die Ansicht einen Leerzustand ("Noch keine Kampagnen.", Plus-Button, lose Quests im Questlog).

Mobil steht unten eine feste Tab-Leiste (4.25rem plus Safe Area) mit vier Zielen (Heute, Kalender, Questlog, Kampagnen) und "Mehr", das ein Blatt von unten mit Scrim öffnet: zuerst "Suchen" (das Befehlsmenü, dessen Feld gleich den Fokus hat), dann Fokus, Plan, Dailies, Wochenrückblick, Das Beste, Einstellungen. Läuft eine Stoppuhr, liegt ihre Leiste direkt über der Tab-Leiste (siehe Stoppuhr-Leiste); ihre Höhe steht als `--timer-bar-height` am Wurzelelement, und Seitenabstand unten, Plus-Button und Toasts rechnen damit. Die Ziele sind Links mit eigener Adresse; beim Wechsel springt die Ansicht nach oben und nimmt den Fokus; der Body hält per Polsterung Abstand zur Leiste. Solange die neue Ansicht lädt, hält sie ihren Platz (oben, am verlangten Abschnitt oder bei Zurück an der gemerkten Stelle): die Scroll-Verankerung des Browsers ist dann aus, und jede Größenänderung setzt die Seite zurück, bis man selbst scrollt (`utils/scroll-hold.ts`). Heute wird dabei nicht neu aufgebaut: zurück aus dem Fokus-Modus oder einer anderen Ansicht steht es sofort da, so wie man es verlassen hat (Liste · Logbuch, aufgeklapptes Nachholen und Abgeschlossenes, Text im Schnell-Anlegen), ohne Skelett, und lädt still nach, was sich inzwischen geändert hat. Offene Dialoge und Menüs von Heute schließen beim Verlassen.

**Zurück am Handy:** Die Zurück-Taste oder -Geste von Android schließt zuerst, was offen ist, und zwar nur das oberste (Dialog, Editor, Befehlsmenü, „…“-Menü, das Blatt „Mehr“), genau wie ✕ oder Escape. Ist nichts offen, geht sie einen Schritt in der App zurück; ohne Schritt zurück führt sie nach Heute, und erst auf Heute verlässt sie die App. Ein neues Overlay meldet sich dafür in `composables/useOverlayStack.ts` an (`useOverlay`); siehe docs/android-test.md › Zurück.

Ab 56rem oder bei Mausbedienung zeigt die obere Leiste alle Ansichten als horizontal erreichbare Tabs (3.5rem hoch, Innenbreite bis 80rem). Jede Ansicht ist ein beschrifteter Tab, nach Absicht gruppiert; zwischen den Gruppen steht etwas mehr Abstand (0.75rem), keine Linie: **Heute · Fokus** | **Kalender · Plan · Questlog** | **Kampagnen · Dailies** | **Wochenrückblick · Das Beste**. Ganz rechts "Befehle" als Lupe und rechts daneben Einstellungen als Zahnrad, beide nur als Icon in Tap-Größe; ihr Name bleibt für Screenreader und im Tooltip, mit der Taste. "Mehr" gibt es hier nicht. Kategorien sind keine eigene Ansicht, sondern ein Abschnitt der Einstellungen. Zwei Stufen:
- **56–75rem:** nur die Namen, ohne Icons, mit schmalerem Polster (0.375rem, jeder Tab mindestens in Tap-Breite); neun Namen, Lupe und Zahnrad brauchen rund 52rem (gemessen in Nunito 700: 835px gegen 849px frei bei 56rem mit Scrollbalken).
- **Ab 75rem:** Icon neben dem Namen, Polster 0.5rem; so braucht die Leiste rund 71.5rem.

Der Kalender-Tag nutzt ab 56rem bis zu 80rem Breite: links die Liste des Tages, rechts der Tageskalender (`clamp(22rem, 38%, 30rem)`), der in voller Fensterhöhe haftet; mobil steht er unter der Liste in seiner natürlichen Höhe und scrollt mit der Seite, nie in sich, und die Liste beginnt dort mit dem Plan des Tages, Reflexion und Das Beste folgen danach. Die Kalenderwoche nutzt bis zu 90rem; ihre sieben Spalten (je mindestens 7.5rem) scrollen in einem Brett nach unten durch die Stunden und, wo sie nicht passen, seitwärts, nie die Seite. Auch der Wochenrückblick nutzt ab 56rem mehr Breite, bis 72rem, für sein Dashboard (siehe Components › Dashboard-Muster). Der Plan ist die weiteste Ausnahme von der Seitenspalte: Er nutzt bis zu 120rem Breite und füllt sie mit so vielen Tagen, wie nebeneinander passen. Ganz links steht die Questlog-Spalte (offen 12rem, zugeklappt eine Leiste so breit wie ihr Chevron, 2.75rem), daneben, wenn es sie gibt, die Spalte "Liegen geblieben" (offen 14rem wie ein Tag, zugeklappt ebenfalls eine 2.75rem-Leiste, die Platz für Tage frei macht), dann heute und die folgenden Tage; ein Tag ist mindestens 14rem breit, so viel, wie Titel zum Lesen brauchen, und die Spalten teilen sich den Rest. Die Ansicht misst ihre Breite und zählt daraus die Tage (`fittingDays` in `utils/week-plan.ts`): ab 56rem mindestens zwei, darunter mindestens heute. Nur wo selbst das nicht passt (offenes Questlog in einem schmalen Fenster), scrollt das Brett innerhalb seiner selbst seitwärts, nie die Seite; die Questlog-Spalte haftet dann am linken Rand, und das Brett öffnet so, dass heute ganz daneben steht. Unter 40rem ist jede Spalte einen Bildschirm breit (siehe Plan-Brett › Am Handy). Ohne eigene Wahl ist die Questlog-Spalte ab 80rem offen und darunter zu. Der Plus-Button sitzt mobil über der Leiste (und einer Stoppuhr-Leiste) rechts und weicht beim Scrollen nach unten aus, beim Scrollen nach oben kommt er zurück; auf breiten Schirmen neben der Seitenspalte (Heute ab 64rem hat statt seiner "Neue Quest" im Kopf); Questlog, Kampagnen und Dailies legen über denselben Plus-Button an. Im Dokument steht er nach dem Inhalt der Ansicht (The FAB-Last Rule), sichtbar bleibt er, wo er ist. Unter 32rem werden Karten- und Dialogpolster auf 1rem reduziert. Ab 40rem wird das Aktionsmenü vom unteren Blatt zum Popover am Auslöser.

**The Way-Back Rule.** Der Weg zurück zum Jetzt ("Diese Woche" im Wochenrückblick, "Heute" im Plan und im Kalender) ist eine getönte Pille vor den Pfeilen und erscheint nur, wenn der gezeigte Zeitraum heute nicht enthält; auf dem laufenden Zeitraum würde sie nichts ändern. Weil sie vor den Pfeilen steht, bleiben die Pfeile an ihrem Platz, wenn sie verschwindet. Nach dem Tippen geht der Fokus auf das, was den neuen Zeitraum nennt (Titel bzw. Zeitraum).

**The Still-Finger Rule.** Wer durch Zeiträume blättert, muss Maus oder Finger nie versetzen: Die Pfeile ‹ › stehen in jeder Ansicht mit Blättern zuletzt und an derselben Stelle, auf dem laufenden Zeitraum wie auf jedem anderen. Was je nach Zeitraum dazukommt oder wegfällt ("Heute", "Auf morgen"), steht davor; am Handy hat diese Reihe ihre eigene Zeile, damit ein langer Titel sie nie verschiebt.

Einträge folgen dem Kartenvertrag (Components › Karten): Zeitspalte (2.75rem, nur bei Uhrzeit oder Datum), Haken-Spalte (Tap-Breite), Inhalt, rechts ▶ und "…"; Kalendertermine und Daily-Läufe, die noch nicht fällig sind, halten dieselbe Flucht, ohne Haken. In den Kampagnen rückt jede Ebene ein, eine 1px-Apricot-Linie führt zur Elternzeile. Tap-Ziele messen mindestens 2.75rem, große Ziele 3rem, der Primär-Button 3.25rem.

## Elevation & Depth

Weitgehend flach. Tiefe entsteht durch Tonwechsel: weiße Karte auf Apricot, eingelassenes Panel in tieferem Apricot, halbtransparentes Weiß für nicht abhakbare Termine. Ein einziger leiser, warmbrauner Kartenschatten hebt pro Ansicht höchstens eine ruhende Karte: die Fokuskarte auf Heute, die Kampagnen-Stunden-Kennzahl im Wochenrückblick (am Handy die ganze Kennzahlen-Karte), die Anmeldekarte, die Boot-Fehlerkarte. Sonst hebt er nur einen Auswahl- oder Ziehzustand (gewählter Tag im Monatsraster, ein Logbuch-Block, dessen Rand gerade gezogen wird). Alles Schwebende (Tab-Leiste, Popover, Filtermenü, Aktionsmenü, Dialog, Toast, Plus-Button) bekommt einen weichen, diffusen Schatten in warmem Braun.

### Shadow Vocabulary
Alle Schatten sind Tokens (`--shadow-card`, `--shadow-rest`, `--shadow-thumb`, `--shadow-bar`, `--shadow-popover`, `--shadow-dialog`, `--shadow-toast`, `--shadow-fab`), die Scrims ebenso (`--color-scrim`, `--color-scrim-light`). Die Werte unten gelten für Hell; Dunkel ersetzt sie durch Haarlinien (siehe Colors › Dunkel).
- **Kartenschatten** (`box-shadow: 0 1px 2px rgb(107 50 18 / 6%), 0 6px 18px rgb(107 50 18 / 7%)`): die eine gehobene Karte der Ansicht, gewählter Kalendertag, Filtermenü; Basis von Mehr-Popover und Aktionsmenü.
- **Leistenkante** (`box-shadow: 0 -1px 0 var(--color-line), 0 -8px 24px rgb(107 50 18 / 8%)`): mobile Tab-Leiste unten (Schatten nach oben); die obere Leiste nur `0 1px 0 var(--color-line)`.
- **Popover** (`box-shadow: var(--shadow-card), 0 12px 32px rgb(107 50 18 / 16%)`): Mehr-Menü, Aktionsmenü.
- **Auflage** (`box-shadow: 0 1px 2px rgb(107 50 18 / 12%)`): gewähltes Segment; der Daumen des Schalters trägt dasselbe in Tinte (`rgb(43 29 22 / 20%)`).
- **Dialog** (`box-shadow: 0 12px 40px rgb(43 29 22 / 22%)`, Backdrop `rgb(43 29 22 / 40%)`).
- **Toast** (`box-shadow: 0 8px 24px rgb(43 29 22 / 30%)`).
- **Plus-Button** (`box-shadow: 0 4px 14px rgb(154 51 10 / 28%)`).

### Named Rules
**The One-Lifted-Card Rule.** Pro Ansicht trägt höchstens eine ruhende Karte den Kartenschatten und als Fläche `surface-raised` (hell gleich Kartenweiß, dunkel eine Stufe heller). Listenkarten, Leerzustände und Einstellungskarten liegen flach in surface.

**The Warm-Shadow Rule.** Schatten sind weich, diffus und warmbraun getönt, nie schwarz, nie hart versetzt.

## Shapes

Großzügig gerundet in drei Stufen: Karten, Panels, Leerzustände, Hinweisflächen, Dialoge und Popover 1.375rem (das Aktionsmenü als unteres Blatt nur oben gerundet); Felder, Kalendertage, Filtermenü und der große Primär-Button 0.875rem; alle übrigen Buttons, Segmentwahl, Chips, Fortschrittsbalken, Schalter und Toast als Pille. Runde Icon-Buttons (Stoppuhr, Dialog-Schließen, Haken) sind Kreise in Tap-Größe. Der Plus-Button ist ein weiches Quadrat (3.5rem, Ecke 1.125rem). Rahmen kommen fast nicht vor; nur Felder und ungewählte Chips tragen eine 1.5px-Apricot-Linie, Listenzeilen trennt eine 1px-Haarlinie. Gestrichelt ist nur, was nicht stattfindet oder noch nicht ist: Übersprungenes, die Ablagefläche beim Ziehen und die Kachel "Neue Kampagne".

Icons stammen aus einer eigenen Strichfamilie (AppIcon): 24px-Raster, Strich 2, runde Enden und Ecken, `currentColor`. Dazu gehören die zweiunddreißig Kampagnen-Symbole (Buch, Code, Hantel, Herz, Zuhause, Aktentasche, Doktorhut, Musik, Blatt, Geld, Werkzeug, Füller, Kamera, Globus, Stern, Fahne, Fahrrad, Tasse, Papierflieger, Farbpalette, Berg, Mond, Menschen, Sprechblase, Glühbirne, Pokal, Kochtopf, Controller, Pfote, Laptop, Karte, Tropfen), alle neutral und ohne militärische Zeichen. Pfeil hoch und runter stehen für "Nach oben" und "Nach unten". Aktive Tabs heben den Strich auf 2.4, der Haken im Primär-Button auf 2.6, im Ring auf 3. In Buttons messen Icons 1.125rem.

## Bewegung

Bewegung ist taktil und kurz: Antippbares gibt beim Druck nach (`--press`, `scale(0.97)`, 90ms) und federt beim Loslassen über (`--spring`, 420ms); Farben und Flächen wechseln in 160–240ms mit `--ease-out`. Was neu erscheint, kommt mit einer kleinen Bewegung: der Haken springt in den Ring, Toasts steigen 0.75rem auf, Blätter und das Mehr-Menü gleiten am Handy von unten herein. Ladeskelette atmen langsam in der Deckkraft.

**The Fade-Not-Move Rule.** Bei reduzierter Bewegung (`prefers-reduced-motion: reduce`, zentral am Ende von `style.css`) bewegt sich nichts, aber jede Änderung zeigt sich: Der Druck schrumpft nicht mehr (`--press: none`), Übergänge behalten nur Farbe, Rahmen, Schatten und Deckkraft, sodass Federn, Heben, Gleiten und wachsende Balken sofort am Ziel stehen. Haken im Ring, Toasts, Blätter und das Mehr-Menü blenden stattdessen in 160ms ein. Laufende Anzeigen (Puls der Stoppuhr, Ring des Mikrofons) stehen still; das Atmen der Ladeskelette bleibt, weil es nur die Deckkraft ändert.

## Components

Alle Ansichten setzen sich aus dem gemeinsamen Bausatz in `frontend/src/style.css` zusammen: Seite (`.page`, `.page-header`, `.page-title`, `.page-lead`, `.section-title`, `.count`), Buttons (`.btn` und Varianten), Felder und Auswahl (`.field`, `.input`, `.segmented`, `.chips` / `.chip`, `.switch`), Tastenkappen (`.kbd`), Flächen und Zustände (`.card` mit `.card-head` und `.card-title` für Karten mit Titel innen, `.empty-state`, `.alert`, `.form-error`, `.skeleton`, `.visually-hidden`). Neue Ansichten komponieren diese Bausteine, statt Buttons und Felder einzeln zu stylen.

### Buttons
Weich, griffig, federnd.
- **Shape:** Pille in Tap-Höhe, Schrift 700, 0.9375rem, Icon 1.125rem links. Nur der große Primär-Button ("Starten" der Fokuskarte, Anmelden) hat die Control-Ecke 0.875rem und 3.25rem Höhe.
- **Tinted (Basis):** Apricot-Hauch, Schrift tiefes Orange. Die Standardform jeder Nebenaktion, auch in allen Dialogen.
- **Primary:** Orange voll, weiße Schrift 800. Ein Primär-Button pro Kontext; als Pille für Sammelaktionen ("Alle nachholen") und Dialog-Submit.
- **On Ground:** Weiß auf dem Apricot-Grund, Schrift tiefes Orange (Tages-Pillen "Auf morgen" und "Heute", Nachholen-Chips).
- **Quiet:** ohne Fläche in gedämpfter Tinte; beim Hover Apricot-Hauch und tiefes Orange. Für "Abbrechen", Menüeinträge und Nebenwege.
- **Danger:** Fehlerhauch mit Fehlerrot, nur für die endgültige Löschbestätigung.
- **Icon:** quadratisch in Tap-Größe, ohne Polster.
- **Link:** tiefes Orange, unterstrichen in Apricot-Linie, Tap-Höhe; für Wechsel wie "Passwort vergessen?" (in der Label-Zeile, Tap-Höhe über eine unsichtbare Fläche) und "Konto erstellen" auf der Anmeldung.
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
- **Internal Padding:** Basis 1rem; Fokus 1.5rem (unten 1rem), Einträge 0.5–1rem.
- **Einstellungen:** oben eine Sprungliste aus Filter-Chips als Links, ein kurzer Name je Abschnitt in der Reihenfolge der Seite (am Handy eine Zeile, die in sich seitwärts scrollt, ab 40rem umbrechend); ein Tipp scrollt zum Abschnitt und gibt seinem Titel den Fokus, wie `?abschnitt=…`. Jede Gruppe ist eine flache Karte mit Abschnittstitel und eigener Adresse; zuerst "Wochenziel Kampagnen-Stunden" (Satz, zwei kleine Zahlfelder "Stunden" und "Minuten" unter der Legende "Wochenziel · optional", gedämpft "Gilt ab dieser Woche; vergangene Wochen behalten ihr Ziel. Beides leer heißt: kein Ziel.", getöntes "Speichern", stille Rückmeldung "Gespeichert."; dasselbe Formular öffnet der Wochenrückblick in seiner Kennzahl), dann "Kategorien" (gedämpfter Satz, vor dem Feld "Neue Kategorie" dieselbe Marke als Button für die Palette der neuen Kategorie, dann "Anlegen", darunter die Kategorien zwischen Haarlinien: Marke als Button in Tap-Größe ("Farbe von Sport: Tanne", `aria-expanded`), der die gemeinsame Palette unter der Zeile öffnet und die Wahl sofort speichert ("Gespeichert" still daneben), Name, Wochensoll als kleines Zahlfeld mit "mal" dahinter, Umbenennen und Löschen als leise Icon-Buttons; `#/kategorien` und "Kategorien" im Befehlsmenü öffnen `#/einstellungen?abschnitt=kategorien`, scrollen dorthin und setzen den Fokus auf den Titel), dann "Darstellung": eine Radiogruppe im Look der Segmentwahl ("Wie das Gerät", "Hell", "Dunkel"), darunter gedämpft "Gilt auf diesem Gerät." und bei "Wie das Gerät", was gerade gilt; Schalter (`.switch`, für Benachrichtigungen und Tastenkürzel) sind eine Zeile mit kleiner Pillen-Spur (3 × 1.75rem) in Tap-Fläche, aus leise Tinte, an Orange, weißer Daumen federt über. "Das Beste des Tages" (vor "Benachrichtigungen"): ein gedämpfter Satz, das Zeitfeld "Heute fragt ab" (voreingestellt 20:00, speichert, sobald eine ganze Uhrzeit steht), darunter der Schalter "Abends an das Beste des Tages erinnern" mit gedämpfter Erklärung (eine Stunde später, wenn der Tag noch keine Zeile hat, höchstens einmal am Tag, nur auf Geräten mit Benachrichtigungen; ab 23 Uhr gibt es keine), still "Gespeichert."; beides gilt auf jedem Gerät. "Benachrichtigungen" sagt unter dem Schalter, solange der Browser noch nicht gefragt hat: "Der Browser fragt gleich, ob die App dir Benachrichtigungen schicken darf." (am Schalter als Beschreibung); hat der Browser sie blockiert, steht statt einer Fehlermeldung eine ruhige Fläche in Apricot-Grund mit den Schritten für Chrome, Edge, Firefox und Android als Liste. Fehlen dem Server die Push-Schlüssel, sagt dieselbe Fläche es in einem Satz und darunter gedämpft "Frag die Person, die den Server betreibt." (was fehlt, steht nur in `docs/betrieb.md`). "Google Kalender" nennt vor "Verbinden" in einem gedämpften Satz, was folgt: Anmeldung bei Google, ein eigener Kalender "Habit Tracker", nie ein Schreiben in andere Kalender; fehlen dem Server die Google-Zugangsdaten, sagt die Fläche nur in einfachen Worten "Google Kalender ist auf dem Server noch nicht eingerichtet." und gedämpft "Frag die Person, die den Server betreibt." (die Namen der Variablen stehen nur in `docs/betrieb.md`). "Fokus-Sperre" zeigt ausgeschaltet nur den Schalter "Bei der Arbeit sperren" und seinen Satz; eingeschaltet folgen "Wann gesperrt wird" als Radioliste im Look von "Was gesperrt wird" ("Solange die Stoppuhr läuft", voreingestellt, oder "Erst ab einem Soll", nur dann mit dem Minutenfeld darunter), Art, Listen und die Einrichtung des Geräts mit ihren gespeicherten Werten. Im Browser, der nicht sperren kann, bleiben Einstellungen und Listen bearbeitbar (sie liegen auf dem Server); nur "App hinzufügen" und die Einrichtung des Geräts fehlen, an ihrer Stelle steht ein Satz: Gesperrt wird auf dem Android-Handy. Was die Sperre am Wirken hindert (leere Sperrliste, Bedienungshilfe aus, VPN nicht erlaubt), sagt `FocusBlockSetupHint`: die ruhige Fläche in Apricot-Grund, fett "Die Fokus-Sperre wirkt so noch nicht.", dann je Grund ein Satz und Buttons auf dem Grund, die es beheben ("Bedienungshilfe einschalten", "VPN erlauben"); in den Einstellungen über den Optionen, im Fokus-Modus kompakt unter den Buttons und nur für die Handy-Berechtigungen (die leere Liste ist dort die leise Zeile der Fokus-Ansicht), und in der Stoppuhr-Leiste, solange eine Sperre läuft, als eine kleine Zeile "Fokus-Sperre wirkt noch nicht." nur mit den Buttons der Handy-Berechtigungen. "Fokus-Klänge": ein Auswahlfeld "Klang" ("Aus", dann die Gruppen "Musik" und "Geräusche") statt einer langen Radioliste, darunter der Lautstärke-Regler: Spur in tiefem Apricot, Füllung und Daumen in Orange (antippbar), nie Browser-Grau; bei "Aus" ist er gesperrt (blasser, Label gedämpft). Die Felder für Websites schlagen je Liste ein passendes Beispiel vor: Sperrliste "youtube.com", Erlaubt-Liste "wikipedia.org". "Spracheingabe" (nach "Töne"): Schalter, der Satz "Die Erkennung läuft auf deinem Gerät; Aufnahmen verlassen es nicht.", darunter gedämpft, womit das Gerät erkennt (Android oder Whisper im Browser mit Modell und Größe); liegt das Modell im Cache, ein getöntes "Sprachmodell entfernen"; fehlt in Android das Offline-Paket, die ruhige Fläche in Apricot-Grund mit den Schritten und "Sprachpaket einrichten". "Tastatur" erscheint nur, wo eine Tastatur wahrscheinlich ist: Schalter "Tastenkürzel", ein gedämpfter Satz, darunter die Tastenkürzel-Liste.

### Inputs / Fields
- **Style:** Label darüber in gedämpfter Tinte 700, 0.875rem. Feld weiß, 1.5px Feldrahmen (line-strong), Platzhalter in leiser Tinte, Ecke 0.875rem, Tap-Höhe, Polster 0.75rem, Schrift 1rem 400; Textflächen mit Rundum-Polster und vertikal ziehbar.
- **Focus:** 3px-Ring in tiefem Orange, Abstand 2px; Caret orange.
- **Error:** Formularfehler als Satz in Fehlerrot 700, 0.9375rem; Ladefehler als Hinweisfläche (Fehlerhauch, Tinte, Kartenecke) mit "Erneut versuchen", auch auf Heute. Der Text sagt in einfachen Worten, was geschah und ob etwas verloren ist: "Der Server hatte gerade einen Fehler. Deine Daten sind davon nicht betroffen; versuch es gleich noch einmal." beim Laden, "… die Änderung ist nicht gespeichert. Was du eingegeben hast, bleibt hier stehen; …" beim Speichern, "Keine Verbindung zum Server. …" offline. Eine eigene Meldung des Servers ("Das Ende muss nach dem Start liegen.") bleibt, wie sie ist.
- **Gespeichert:** stille Rückmeldung als gedämpfter Text neben dem Feld (Kategorien, Tagesreflexion), kein Toast.
- **Aufklapper** (`FormDisclosure`): seltene, optionale Felder warten hinter einer Zeile statt einer Pille: Name in Tinte 700, eine Ergänzung in Klammern gedämpft ("Termin (feste Uhrzeit)"), rechts ein Chevron, Haarlinie darüber, Hover in Apricot-Hauch. Der Button trägt `aria-expanded` und `aria-controls`, das Feldpaket darunter ist eine Gruppe mit dem Button als Namen. Er öffnet an Ort und Stelle und gibt den Fokus ins erste Feld, das ihn nehmen kann; schließen lässt den Fokus auf dem Button. Hält das Paket schon einen Wert, beginnt es offen; zugeklappt nennt der Button rechts, was gesetzt ist ("14:30 Uhr", "Morgenseiten, 20-mal · 08.11.–18.12.", "Sport"), gedämpft mit Auslassung. **The Nothing-Hidden Rule:** ein gesetzter Wert steht immer offen oder auf dem Button, nie stumm hinter einem zugeklappten.

### Mikrofon (Spracheingabe)
- **Knopf:** ohne Fläche in gedämpfter Tinte, Mikrofon-Symbol 1.25rem, Tap-Größe; Hover Apricot-Hauch und tiefes Orange. Im Feld (`.mic-field`, `placement="field"`) deckt er an der rechten Kante bzw. oben rechts in Textflächen die volle Tap-Fläche (2.75rem); was man von ihm sieht (Hover, Zuhören, Ring), liegt 2px innen mit der Ecke des Felds weniger 2px, so bleibt der Feldrahmen frei. Nur solange er da ist, hält der Text rechts Abstand.
- **Zustand nie nur als Farbe:** beim Zuhören Apricot-Hauch, ein Quadrat statt des Mikrofons, das Wort „Hört zu …“ und ein langsamer Ring (bei reduzierter Bewegung ein ruhiger Ring); dann „Wird erkannt …“ bzw. „Lade Sprachmodell … 42 %“ in Ziffern gleicher Breite.
- **Sprechblase** für Rückfrage, Einrichtung und Fehler: weiß gehoben, Control-Ecke, Popover-Schatten, unter dem Knopf rechtsbündig, höchstens 20rem.
- **Wo:** im Schnell-Anlegen und im Titel von „Neue Quest“ rechts im Feld; in der Werkzeugleiste der Notizen am Ende (am Handy oben neben „Text“); in Das Beste, Reflexion und den Antworten des Wochenrückblicks oben rechts im Feld. Ist die Spracheingabe aus oder das Gerät ohne Erkennung, gibt es keinen Knopf und keinen Abstand.
- **Erkannt-Chips** (`QuestParseChips`): unter dem Feld je erkanntem Tag, erkannter Dauer, Kampagne und Kategorie eine kleine Pille in Apricot-Hauch, Tinte 700 in 0.875rem, vorn Kalender bzw. Uhr in tiefem Orange, hinten ein kleines ✕ in gedämpfter Tinte; 2rem hoch, bei grobem Zeiger Tap-Höhe. Eine Kampagne trägt vorn ihr Symbol, eine Kategorie das Quadrat ihrer Marke, und beide nennen ihre Art in Worten („Kampagne: Buch schreiben“, „Kategorie: Sport“); ein langer Name endet mit Auslassung, das ✕ bleibt. Im Questlog steht vor dem Tag „→“, weil er die Quest aus dem Questlog plant; eine Kampagne plant nichts heraus und bekommt keins. Ein Tipp verwirft den Chip; der Text im Feld bleibt, wie er getippt ist.
- **Notizen:** „Trennlinie“ steht als Aktion unter „Einfügen“ in der Auswahl „Text“, nicht mehr als eigener Knopf, damit die Werkzeugleiste kurz bleibt.

### Quest-Editor
"Quest bearbeiten" (`PlannerItemEditor`, in jeder Ansicht derselbe, auch im Questlog) und "Neue Quest" (`CreateTodoForm`) zeigen, was fast jede Änderung braucht, und sonst nichts:
- **Quest | Daily** steht ganz oben als Segmentwahl (`KindSwitch`, Radiogruppe "Art"): im Plus-Dialog, der immer mit "Quest" beginnt (die Dailies mit "Daily"), und im Editor einer offenen Quest ohne Unter-Quests. Beim Anlegen tauscht der Wechsel nur das Formular, jedes behält, was schon getippt ist. Im Editor wird daraus "Quest als Daily speichern": das Daily-Formular, vorbelegt mit Titel, Warum, Kategorie und Kampagne, darüber in tiefem Apricot "Beim Speichern entsteht dieses Daily, und die Quest „…“ wird gelöscht. Was schon im Logbuch steht, bleibt erhalten."; der Primär-Button heißt "Als Daily speichern". Nach dem Wechsel bleibt der Fokus auf der Segmentwahl.
- **Immer da:** Titel, "Gehört zu", Tag mit den Chips Heute · Morgen (mobil auf einer Zeile mit dem Datum), Dauer in Minuten (das Soll), Warum.
- **Gehört zu** ist ein Auswahlfeld (siehe Auswahlfeld): Kampagnen und jede offene Quest darunter als Pfad ("Buch schreiben › Kapitel 2") mit dem Kampagnen-Abzeichen, nie die Quest selbst oder was unter ihr liegt; "Keine (lose Quest)" bzw. "Keine (eigene Kampagne)" löst sie. Ein unbekannter Name bietet "Neue Kampagne „…“ anlegen": eine oberste Quest in der Farbe, die ihr Titel wählt, also sofort eine Kampagne. Leise darunter "Alle Unter-Quests ziehen mit." Die Wahl zeigt das Warum des neuen Platzes als übernommenes Zitat und schlägt, solange die Quest keine Kategorie hat, die des Platzes oder seiner Kampagne vor. Unter eine Quest gestellt verliert eine oberste Quest den Aufklapper "Kampagne".
- **Aufklapper darunter**, als eine Liste zwischen Haarlinien: "Kampagne (Farbe, Symbol, Wochenziel)" nur für eine oberste Quest (siehe Farbe und Symbol wählen), "Termin (feste Uhrzeit)" mit der Uhrzeit, die ohne Tag gesperrt bleibt und es sagt, "Ziel mit Daily (Daily und Zeitraum)" mit "Zählt für ein Daily" zuerst und erst danach Zeitraum von/bis und "Wie oft im Zeitraum?" (ein Zeitraum ohne Daily bedeutet nichts; ein alter steht trotzdem da, damit man ihn leeren kann), zuletzt "Kategorie" als Auswahlfeld mit Farbmarke, in dem ein neuer Name "Neue Kategorie „…“ anlegen" anbietet. Beim Anlegen gibt es Termin und Kategorie.
- **Kampagnen-Formular:** Eine Kampagne (bearbeitet oder neu angelegt) zeigt nur Titel, einen gedämpften Satz "Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder eine Farbe, ein Symbol oder ein Wochenziel bekommt.", Warum, Kategorie, Farbe, Symbol, Wochenziel (offen, nicht hinter einem Aufklapper) und Notizen. Tag, Dauer, Termin, Ziel mit Daily und "Gehört zu" fehlen; nur ein schon gesetzter Tag, eine Dauer, ein Termin oder ein Ziel bleibt sichtbar, damit man ihn leeren kann (The Nothing-Hidden Rule). Verschoben wird sie über "In Kampagne verschieben …".
- **Notizen** folgen im Editor nach den Aufklappern, wie bisher selbstspeichernd.
- **Aktionen:** Im Dialog ist eine Fußleiste das Letzte im Formular und haftet bündig an der Unterkante über die ganze Dialogbreite (`.sticky-actions`, Kartenweiß, Haarlinie oben); unter ihr scheint nie Inhalt durch, auch nicht im Innenabstand des Dialogs. Ein Formularfehler steht dort direkt über "Speichern" (Primär), "Abbrechen" und, ab 40rem ganz rechts, dem leisen "Quest löschen" (Tinte ohne Fläche); am Handy steht "Quest löschen" stattdessen am Ende des Inhalts unter einer Haarlinie, weg vom Daumen auf "Speichern"; beim Anlegen über "Quest erstellen" bzw. "Kampagne erstellen" und "Abbrechen". Die Rückfrage zum Löschen erscheint direkt über der Fußleiste (Auswirkung, "„…“ wirklich löschen?", rot erst "Ja, löschen", daneben "Nicht löschen" mit dem Fokus). Der Dialog hält unten Scroll-Abstand, damit ein per Tab erreichtes Feld nie dahinter liegt.

Solange der Editor lädt (Skelett), schließen Escape und "Dialog schließen" ihn; gesperrt ist der Dialog nur, während er speichert oder löscht.

**Dialoge am Handy:** Unter 40rem ist jeder Dialog (`ModalDialog`, also jeder Editor, jede Rückfrage) ein Blatt von unten: volle Breite, oben Kartenecke, ein Griff oben in der Mitte. Wer Griff oder Titel weiter als 80px nach unten zieht, schließt es, ein kürzerer Zug federt zurück; ✕ und Escape bleiben. Das Blatt ist nie höher als der sichtbare Teil des Fensters, die Tastatur schiebt es samt Fußleiste nach oben (`interactive-widget=resizes-content`), sodass Felder und "Speichern" nie dahinter liegen.

Das Daily im selben Editor ordnet seine Felder nach dem, was man zuerst entscheidet: Titel, dann der Rhythmus (der geltende als ruhige Fläche, "Rhythmus ändern" mit Art, Einzelheiten und "Gültig ab" direkt darunter), dann Kategorie und Kampagne nebeneinander (mobil untereinander; die Kampagne als Auswahlfeld nur mit Kampagnen, leise "Seine gemessene Zeit zählt dort als Kampagnen-Stunden.", nur mit gewählter Kampagne; ohne eigene Kampagne, aber gezählt von der Quest einer Kampagne, stattdessen "Wird von „Halbmarathon schaffen“ gezählt.", sonst nichts), dann Warum, dann Uhrzeit und Dauer, Aktiv; geöffnet von einem Lauf aus folgen "Notizen zu diesem Lauf". "Neues Daily" hat dieselbe Folge mit Startdatum vor Uhrzeit und Dauer und dieselbe haftende Fußleiste.

### Auswahlfeld
Ein Feld zum Tippen und Wählen (`ComboBox`, WAI-ARIA-Combobox mit Listbox): sieht aus wie jedes Feld, rechts ein leiser Chevron (nur für den Zeiger, nicht im Tab-Lauf). Tippen filtert, Pfeile wandern, Enter wählt, Escape schließt erst die Liste und dann den Dialog. Die Liste ist ein Popover in Kartenweiß mit Control-Ecke und Popover-Schatten, Zeilen in Tap-Höhe; die aktive liegt in Apricot-Hauch mit tiefem Orange, die gewählte trägt einen Haken. Eine Kategorie zeigt ihr Quadrat, eine Kampagne ihr rundes Abzeichen mit Symbol vor dem Namen; der Name steht immer daneben, auch im geschlossenen Feld (The Never-Colour-Alone Rule). Ein Pfad steht gedämpft vor dem Namen ("Buch schreiben ›"). Passt kein Eintrag genau auf das Getippte, bietet die letzte Zeile in tiefem Orange mit Plus "Neue Kategorie „…“ anlegen" bzw. "Neue Kampagne „…“ anlegen"; das legt sofort an und wählt. Findet die Suche nichts und gibt es nichts anzulegen, steht dort "Nichts gefunden."

### Übernommenes Warum
Hat eine Quest oder ein Daily kein eigenes Warum, gilt das der nächsten Quest darüber, live (`WhyField`); ein Daily übernimmt das seiner Kampagne, ohne eine (oder ohne Warum dort) das der Quest, die es zählt. Wählt man im Editor einen anderen Platz oder eine andere Kampagne, zeigt das Zitat sofort deren Warum. Der Editor zeigt es deshalb nie als bearbeitbaren Text: unter dem Label "Warum" steht es als ruhiges Zitat (2px-Linie in Apricot links, "Übernommen von „Buch schreiben“:" gedämpft 0.875rem, darunter der Satz in Tinte), darunter die getönte Pille "Eigenes Warum schreiben" mit Stift. Sie öffnet ein leeres Feld "Eigenes Warum" mit dem Fokus darin; das Zitat bleibt als Bezug darüber ("Ersetzt das Warum von „…“:", nun gedämpft), darunter leise "Leer gelassen gilt weiter das übernommene." und die Pille "Wieder übernehmen", die das eigene leert und den Fokus an "Eigenes Warum schreiben" zurückgibt. So kann kein Tastendruck das Warum still abkoppeln. Gespeichert wird nur, was sich änderte: unverändert nichts, ein neues eigenes als Text, "Wieder übernehmen" als leeres Warum, das wieder erbt. Ohne etwas zu erben ist es ein einfaches Feld "Warum · optional".

### Navigation
- **Tab-Leiste:** Weiß, Icon über 0.75rem-Label (700), inaktiv gedämpfte Tinte, aktiv Orange mit kräftigerem Strich. Druck federt. Ab 56rem oder bei Mausbedienung oben mit 0.9375rem-Label, bis 75rem ohne Icon und mit schmalerem Polster, danach Icon neben Label.
- **Mehr:** ein Disclosure-Button (`aria-expanded`, `aria-controls`) über einer Liste, die man mit Tab durchläuft. Nur am Handy: ein weißes Blatt von unten in voller Breite (oben Kartenecke) mit Scrim `rgb(43 29 22 / 18%)`; der erste Eintrag ist "Suchen" mit Lupe, er öffnet das Befehlsmenü mit dem Fokus im Feld (die Absicht ist klar, also auch auf dem Touchscreen), danach die Links der übrigen Ansichten; ab 56rem oder bei Mausbedienung hat jede Ansicht ihren Tab. Escape schließt und gibt den Fokus an den Button zurück, ein Klick daneben, Tab aus der Liste heraus und jeder Ansichtswechsel schließen ebenfalls.
- **Befehle:** leiser Tab nur mit der Lupe (Name im Tooltip mit "Strg+K"); öffnet das Befehlsmenü.
- **Einstellungen:** leiser Tab nur mit dem Zahnrad, ganz rechts; aktiv Orange wie jeder Tab.

### Befehlsmenü
Strg K oder "Befehle" öffnen einen Dialog nahe dem oberen Rand: Titel "Befehle", darunter das Suchfeld ("Suchen …"), solange es leer ist mit einer gedämpften Zeile (0.875rem) darunter: "Sucht in Ansichten, Befehlen, Titeln und Notizen." Dann die Einträge als Zeilen in Tap-Höhe (Tinte 700, Control-Ecke), ohne Suche gruppiert nach "Ansichten" und "Aktionen" (Gruppentitel gedämpft 0.875rem), mit Suche als eine Liste nach Treffergüte. Der aktive Eintrag liegt in Apricot-Hauch mit tiefem Orange, wie Hover in Menüs. Rechts stehen die Tasten des Eintrags als Tastenkappen.

Ab zwei Zeichen folgen, was der Server findet, in zwei weiteren Gruppen; die Befehle darüber heißen dann "Ansichten und Aktionen". "Kampagnen, Quests und Dailies": je Treffer der Titel (Tinte 700) und darunter gedämpft in 0.875rem, was es ist ("Quest · erledigt · 18. Nov."), mit dem Kampagnen-Chip. Eine offene Quest trägt rechts in derselben Zeile zwei leise Pillen in Tap-Höhe, "Stoppuhr starten" und "Zur Kampagne"; am Handy rutschen sie unter den Titel. Sie sind eigene Einträge der Liste, aktiv wie jeder andere in Apricot-Hauch. "In Notizen und Texten": wo der Text steht ("Notiz zu …", "Reflexion vom 18. Nov.") und darunter ein Ausschnitt von höchstens zwei Zeilen in gedämpfter Tinte 400. Der Treffer in Titel und Ausschnitt liegt in einem `<mark>` in der Auswahlfarbe (selection) mit kleiner Ecke, die Schrift behält ihre Farbe; im aktiven Eintrag werden Metazeile und Ausschnitt Tinte. Während der Server sucht, steht unter der Liste gedämpft "Sucht in Titeln und Notizen …", ist er nicht erreichbar "Titel und Notizen lassen sich gerade nicht durchsuchen."; die Befehle bleiben bedienbar. Findet die Suche nichts, sagt eine ruhige Fläche in Apricot-Grund "Nichts gefunden für „…“." und darunter kleiner, was sie durchsucht (unter zwei Zeichen: "Titel und Notizen werden ab zwei Zeichen durchsucht.").

### Tastenkappe (`.kbd`)
Eine Taste: mindestens 1.75rem breit und hoch, Ecke `--radius-key` (0.375rem, kantig genug für eine Taste, keine Pille), Apricot-Grund mit einer 2px-Kante in tiefem Apricot unten, Tinte 700 in 0.8125rem. Mehrere Tasten stehen mit 0.25rem Abstand nebeneinander ("Strg" "K"). Abgeschaltete Kürzel stehen in leiser Tinte, ihre Kappen blasser. Kappen erscheinen nur, wo eine Tastatur wahrscheinlich ist.

### Tastenkürzel-Liste
In der Übersicht ("?") und in Einstellungen › Tastatur dieselbe Liste: Gruppentitel (800, 1rem), darunter Zeilen mit der Aktion links und den Tastenkappen rechts, getrennt durch Haarlinien.

### Karten (der Kartenvertrag)
Jede Quest- und Daily-Karte in jeder Ansicht folgt einem Vertrag, gebaut aus `ItemRow` (Karte), `CheckRing` (Haken), `ActionMenu` (Menü), `CampaignChip` (Kampagne) und `rowMenu()` in `utils/row-actions.ts` (Reihenfolge des Menüs); Plan (`PlanEntry`), Kampagnen-Baum und Dailies halten denselben Vertrag mit eigener Form:
- **Ring**, wo man den Eintrag erledigen kann, überall mit Rückgängig im Toast (Heute, Questlog, Plan, Kalender, Kampagnen, Dailies). Eine Kampagne mit offenen Quests fragt vorher (siehe Kampagne abschließen).
- **Die ganze Karte öffnet den Editor**, ein Tipp irgendwo außer auf ihren eigenen Bedienelementen (Ring, ▶, "…", Links, Felder; `utils/card-click.ts`). Der Titel bleibt der eigentliche Button ("… bearbeiten") für Tastatur und Screenreader, die Überschrift behält den reinen Titel; die Karte selbst ist kein Button, so steckt nie ein Bedienelement im anderen. Zeiger auf der Karte: Cursor als Hand und eine leise 1.5px-Haarlinie in Apricot-Linie (nur wo es Hover gibt). Ein Klick, der eine Textauswahl beendet oder einen Zug abschließt, öffnet nichts.
- **Die ganze Karte zieht**, wo eine Ansicht sortiert oder verschiebt (Heute: Fokuskarte und Reihenfolge; Plan: Tagesspalten, "Liegen geblieben" und Questlog-Spalte, in beide Richtungen; Questlog: seine Reihenfolge; Kampagnen-Baum: Umhängen per nativem Ziehen). Es gibt keinen Griff mehr. Eine Maus zieht nach 6px Weg, ein kurzer Klick bleibt ein Klick; ein Finger hebt die Karte erst nach 300ms Halten (`delayOnTouchOnly`), bewegt er sich vorher, scrollt die Seite. Die eigenen Bedienelemente starten nie einen Zug. Ziehbare Karten lassen keinen Text markieren und kein Systemmenü aufgehen, damit das lange Drücken der Karte gehört.
- **Darunter eine Metazeile**; am Handy bleibt sie eine Zeile, der letzte Teil (meist der Kampagnen-Chip) endet mit Auslassung. Heute und die Listen des Kalenders (Monat, Tag) lassen sie am Handy umbrechen (`wrapMeta`), weil dort jeder Teil zählt; der Kampagnen-Chip rückt dann ganz in die nächste Zeile, statt auf seine Plakette zu schrumpfen, und nur ein Name, der länger als die Zeile ist, endet mit Auslassung. Bei grobem Zeiger reicht die Trefferfläche des Titel-Buttons unsichtbar eine Tap-Höhe um seine Zeile.
- **▶** auf jeder offenen Quest in jeder Ansicht mit Karten (Heute, Questlog, Kalender, Kampagnen, Dailies). Nur die kompakten Karten des Plans und die Detailkarte einer Kampagne haben keinen Platz dafür; dort steht "Stoppuhr starten" im Menü. Läuft die Stoppuhr dieser Karte, wird ▶ zu Pause (pausiert zu Weiter) mit dichterem Hauch und Ring, und die Metazeile beginnt mit "läuft" oder "pausiert" in Tinte mit einem ruhig pulsierenden Punkt; nie orange.
- **Alles andere im Menü "…"**, in einer Reihenfolge für alle Ansichten (`rowMenu`): schnelle Tage (Heute, Morgen, Nächste Woche bzw. die Tage des Bretts), "Anderer Tag …" (ein Termin: "Termin verschieben …"; ein vorbeigegangener offener Termin in Heute: "Anderer Tag …" ganz vorn), Überspringen (Daily-Läufe), Bearbeiten, Fokus-Modus (Fokuskarte), Stoppuhr starten (Karten ohne ▶), Unter-Quest hinzufügen, "In Kampagne verschieben …" (jede Quest; ein kleiner Dialog mit dem Auswahlfeld "Gehört zu" und "Verschieben", `CampaignMoveDialog`), Nach oben und Nach unten (wo sortiert wird; die Tastatur-Alternative zum Ziehen), zuletzt Löschen, abgesetzt, in jeder Ansicht. Löschen fragt wie der Editor (`DeleteItemDialog`): eine Quest mit der Vorschau, was mit ihr geht, ein Daily (auch vom Menü eines Laufs aus) als "Das ganze Daily verschwindet aus Heute und allen Tagen. Das Logbuch bleibt erhalten."; erst "Ja, löschen" ist rot, Rückgängig gibt es dafür nicht. Was nicht passt, fehlt; keine dauerhaften Text-Buttons auf der Karte.

**The Whole-Card Rule.** Eine Karte ist ein Ziel: tippen bearbeitet, halten und ziehen verschiebt, "…" bietet den Rest. Wer keine Maus und keinen Finger nutzt, erreicht alles über Titel und Menü, mit einem Tabstopp weniger je Karte als zu Zeiten des Griffs.

Je Ansicht (Menü in Reihenfolge):
- **Heute:** Ring, Titel mit Metazeile, ▶, "…" (bei einem vorbeigegangenen offenen Termin zuerst "Anderer Tag …"; Morgen, Nächste Woche, "Anderer Tag …" bzw. "Termin verschieben …", Überspringen bei Dailies, Bearbeiten, "In Kampagne verschieben …" bei Quests, Nach oben / Nach unten in der Reihenfolge, Löschen). Eine Zeile mit einer Metazeile misst rund 68px (Desktop wie Handy, solange der Titel auf eine Zeile passt). Ein Daily beginnt seine Metazeile mit dem Dailies-Icon und "Daily" (700), wie im Plan, damit es nicht wie eine Quest aussieht; läuft eine Serie, folgt ruhig "12 in Folge" (bei einem Wochenziel "3 Wochen in Folge"), ohne Serie nichts, nie eine Null. Unter der Metazeile steht leise das Warum, das eigene oder übernommene (gedämpfte Tinte, 0.9375rem, eine Zeile mit Auslassung, ganz im Tooltip); erledigte und übersprungene Zeilen lassen es weg. Am Handy tragen es nur die nächsten zwei Zeilen der Reihenfolge, Termine und Nachholen erst ab 40rem: Mit Warum misst eine Zeile rund 88px statt 68px, ein langer Tag würde sonst ein Drittel länger. Nachholen behält sein Panel mit den Chips Heute · Morgen · Anderer Tag · Überspringen. Termine stehen in derselben Liste mit ihrer Uhrzeit in der Zeitspalte, am gespeicherten Platz und untereinander nach Uhrzeit; ihre Metazeile sagt dann nicht noch "Termin" (wo keine Zeitspalte steht, etwa bei Nachholen, sagt sie es). Flexible Karten lassen sich davor, dazwischen und dahinter ablegen. Auch Termine lassen sich innerhalb der zeitlichen Reihenfolge ziehen; ein vorbeigegangener offener Termin fragt unter der Metazeile in einer leisen Zeile "Vorbei – erledigt?" (gedämpfte Tinte 600), ohne Pille auf der Karte; der Ring beantwortet es, "Anderer Tag …" steht als erster Eintrag in seinem "…". Google-Termine stehen als flache Zeilen in 55 % Weiß dazwischen, in den Spalten der Karten: Zeit, Ring, Titel mit gedämpft "Google Kalender" darunter. Der Ring hakt sie ab (nur in der App, nie in Google): Sie wandern unter "abgeschlossen", durchgestrichen und gedämpft wie eine erledigte Quest, zählen aber nicht in "1 von 7 erledigt"; derselbe Ring öffnet sie dort wieder. Abgehakt wird nur von Hand; ein vorbeigegangener Termin wird bloß leiser (80 %). Im Tageskalender daneben bleiben sie stehen.
- **Questlog:** nur Quests, an denen man arbeiten kann (keine Kampagnen, keine Questreihen mit offenen Quests; die Regel liegt beim Server). Darüber das Schnell-Anlegen ohne Tag mit ↑ / ↓ (siehe Reihenfolge des Tages): Enter legt die Quest an den Kopf oder das Ende der Reihenfolge des Questlogs. Ring, Titel, Metazeile mit Kampagnen-Chip, Warum, ▶, "…" (Heute, Morgen, Nächste Woche als Einplanen, "Anderer Tag …", das den Editor am Tag öffnet, Bearbeiten, "In Kampagne verschieben …", Nach oben / Nach unten, Löschen). Die ganze Karte zieht in die Reihenfolge des Questlogs, die bleibt und auch in der Questlog-Spalte des Plans gilt.
- **Kampagnen:** Der Baum steht nur in einer geöffneten Kampagne: Einrückung, Chevron, Ring, Titel, ▶, "…" (Bearbeiten, Unter-Quest hinzufügen, "In Kampagne verschieben …", Löschen). Die geöffnete Kampagne hat keine Zeile; ihre Detailkarte trägt "Bearbeiten" und "Abschließen" (bzw. "Wieder öffnen") als getönte Pillen nebeneinander und rechts im Kopf dasselbe "…" (Kampagne abschließen bzw. Wieder öffnen statt des Rings, Bearbeiten, Stoppuhr starten, Unter-Quest hinzufügen, "In Kampagne verschieben …", Löschen; der Fortschritt steht schon auf der Karte), und sie nimmt beim Ziehen Quests auf.
- **Kalender (Monats-Tagesliste, Tag):** offene Quests und die heute fälligen Daily-Läufe mit Ring und Rückgängig (ein Lauf, den der Kalender nur voraussieht, holt sich vor dem Haken seine Ausführung über dieselbe Schnittstelle wie Heute); ▶ auf offenen Quests und fälligen gespeicherten Läufen; Daily-Läufe mit "Daily" vorn in der Metazeile, Kampagnen-Chip am Ende; "…" mit denselben schnellen Tagen wie Heute, "Anderer Tag …", Bearbeiten, "In Kampagne verschieben …" bei Quests und Löschen (ein vorausgesehener Lauf nur Bearbeiten und Löschen des Dailys). Läufe künftiger Tage halten die Ringspalte frei.
- **Plan:** kompakte Karten der Tagesspalten (siehe Plan-Brett) mit "…" (Morgen, Nächste Woche, "Anderer Tag …", Bearbeiten, Stoppuhr starten, "In Kampagne verschieben …", Nach oben / Nach unten, Löschen); X und Leertaste erreichen die Karte, und hat ihr Titel den Fokus, verschieben die Pfeiltasten sie (hoch und runter in der Reihenfolge, links und rechts einen Tag). Ein gespeicherter Lauf eines Dailys ist dieselbe Karte mit dem Menü von Heute (die schnellen Tage seines Fensters, "Anderer Tag …", Überspringen, sobald er fällig ist, Bearbeiten mit den Notizen dieses Laufs, Stoppuhr starten, Nach oben / Nach unten, Löschen des ganzen Dailys); er zieht und wandert mit den Pfeiltasten nur innerhalb seines Fensters. Ein Lauf, den der Plan nur voraussieht, öffnet sein Daily und hat nur Bearbeiten und Löschen. Die Questlog-Spalte trägt "…" mit den gezeigten Tagen, Bearbeiten, Stoppuhr starten, "In Kampagne verschieben …", Nach oben / Nach unten und Löschen; "Liegen geblieben" dieselben Schritte wie ein Tag, aber ohne Nach oben / Nach unten.
- **Dailies:** Ring für den heutigen Lauf, Titel, Warum, Metazeile mit Stand der Woche, Serie ("12 in Folge · Rekord 21") und Kampagnen-Chip, wenn das Daily zu einer gehört, ▶, "…" (Bearbeiten, Löschen).

### Aktionsmenü
Eine gemeinsame Komponente (`ActionMenu`): ein leiser runder Auslöser "…" (Tap-Größe, Name "Aktionen für <Titel>", `aria-haspopup="menu"`, `aria-expanded`), geöffnet ein Menü mit dem Titel des Eintrags als Überschrift in Tinte. Unter 40rem ein weißes Blatt von unten (oben Kartenecke, Scrim `rgb(43 29 22 / 18%)`), ab 40rem ein Popover am Auslöser (mind. 15rem, Kartenecke), unter dem Auslöser oder, wo unten kein Platz ist, darüber. Es hängt am Ende der Seite (Teleport), damit kein scrollendes Brett es abschneidet. Einträge sind leise Buttons in Tinte mit Icon links; wo ein Kürzel dasselbe tut (T, D, W), steht es als Tastenkappe rechts (nur wo eine Tastatur wahrscheinlich ist) und als `aria-keyshortcuts`. Pfeile, Pos1 und Ende wandern, Escape und ein Tipp daneben schließen und geben den Fokus an den Auslöser zurück; ein Eintrag gibt den Fokus erst zurück und läuft dann, so kehrt ein Dialog, den er öffnet, richtig zurück. "Löschen" steht zuletzt, durch eine Haarlinie abgesetzt, ebenfalls in Tinte; erst der Bestätigungsdialog zeigt "Ja, löschen" rot.

### Dashboard-Muster
Wo eine Ansicht Zahlen auf einen Blick zeigt, stehen Karten nebeneinander statt untereinander unter Abschnittstiteln. Jede Karte trägt ihren Titel innen als kleines Label (`.card-title`: gedämpfte Tinte 700, 0.875rem, Tabellenziffern, nie Versalien), rechts daneben in `.card-head` eine leise Zahl, Legende oder ein Nebenbutton. Ein Raster, ein Abstand: 0.75rem am Handy, ab 40rem 1rem zwischen allen Karten.
- **Kennzahlen-Reihe:** gleich breite Karten (ab 40rem), je Label, Zahl groß (800, clamp 1.625–2.25rem) mit der Einheit kleiner daneben in gedämpfter Tinte (0.55em, "5 Std. 55 Min.", "92 %"), darunter eine gedämpfte Zeile. Am Handy wird die Reihe zu einer Karte: die erste Kennzahl groß oben, unter einer Haarlinie die nächsten beiden nebeneinander, eine vierte unter einer weiteren Haarlinie. Unbekanntes ist "–". Wie im Kennzahlen-Streifen der Kampagnen bricht eine Zahl nie von ihrer Einheit.
- **Diagrammkarten:** Säulen und Balken sind handgeschriebenes CSS ohne Bibliothek, mit fester oder begrenzter Höhe, Werten als Text (nie nur beim Hover), tabellarischen Ziffern und einer Text-Alternative, die alle Werte nennt. Hervorgehoben wird mit Tinte, nie mit Orange. Heute ist in einem Diagramm leise markiert: "Heute" statt des Kürzels in Tinte 800 und eine 2px-Grundlinie in Tinte unter seiner Säule, kein Rahmen; so führen die Daten, nicht die Markierung. Eine Zahl steht nur einmal: Was eine Kennzahl sagt, wiederholt keine Diagrammkarte.
- **Raster:** eine breite Diagrammkarte (etwa drei Fünftel) neben einer Spalte aus zwei kleineren Karten; die Karten einer Reihe sind gleich hoch, das große Diagramm füllt seine Karte (11–16rem). Darunter Karten über die ganze Breite. Am Handy steht alles in derselben Folge untereinander.

### Wochenrückblick
Ab 56rem bis 72rem breit (wie der Plan breiter als die Seitenspalte), darunter in Seitenbreite. Kopfzeile: Titel "Wochenrückblick" mit gedämpfter Einleitung "Wie weit die Woche deine Kampagnen gebracht hat." und rechts auf derselben Zeile die Wochenwahl: "Diese Woche" als getönte Pille (nur abseits der laufenden Woche, The Way-Back Rule; danach geht der Fokus auf den Zeitraum), runder Zurück-Button, der Zeitraum fett mit "diese Woche" / "vor 3 Wochen" gedämpft darunter, Vor-Button. Am Handy rutscht die Wochenwahl auf eine eigene Zeile, der Zeitraum mittig.

Oben das Dashboard, darunter die Einzelheiten, alles nach dem Dashboard-Muster:
1. **Kennzahlen** (Kampagnen-Stunden, Tagesschnitt, Kampagnen-Arbeit, Dailies im Wochensoll): ab 40rem zwei mal zwei Karten, ab 64rem vier in einer Reihe, damit alles am Desktop ohne Scrollen zu sehen ist. Die Kampagnen-Stunden sind die eine gehobene Karte der Ansicht (am Handy die ganze Kennzahlen-Karte): "von 20 Std. Wochenziel" (das Ziel, das in dieser Woche galt), dazu ein flacher Balken (bar, 0.5rem) mit "30 % vom Ziel" am gemeinsamen unteren Rand der Reihe. Ohne Ziel nur die Stunden. In der laufenden Woche sitzt oben rechts ein leiser runder Stift-Button "Wochenziel ändern" (ohne Ziel "Wochenziel setzen", darunter "Kein Wochenziel"); er öffnet das Formular der Einstellungen an Ort und Stelle in der Karte (Stunden, Minuten, "Gilt ab dieser Woche …", Speichern und Abbrechen, Escape schließt), der Fokus geht ins Stundenfeld und danach zurück auf den Stift. Eine vergangene Woche zeigt ihr Ziel nur. Tagesschnitt mit "über 3 Tage bisher", Kampagnen-Arbeit als Anteil ("92 %") mit "von 6 Std. gemessen"; den Anteil nennt nur diese Kennzahl. Dailies im Wochensoll als "5 von 8" (die Gesamtzahl klein wie eine Einheit) mit "fälligen Ausführungen erledigt", ohne Fälliges "–"; am unteren Rand die Perfect Week: "Wochensoll je Kategorie:" (Tinte 700) in eigener Zeile, darunter die Kategorien in einem Fluss, "Sport ✓  Lesen 2 von 3" (vor jedem Namen die Marke der Kategorie, erreicht als Tintenhaken, für Screenreader "erreicht"); jede Kategorie mit Marke, Name und Zahl ist eine Einheit, ohne Komma, durch Abstand (0.75rem) von der nächsten getrennt; die Zeile bricht nur zwischen ihnen. Alles erreicht: "Perfekte Woche!" statt der Überschrift. Einen zweiten, ausführlichen Block weiter unten gibt es nicht. Läuft im Monat der Woche eine Monats-Challenge, nennt die Dailies-Karte unter ihrer Zahl in einer ruhigen Zeile in Tinte (700, 0.875rem, gedämpftes Challenge-Icon davor), wie sie am Ende der Woche stand: "Monats-Challenge „Sport“: 11 von 12"; ohne fälligen Lauf fehlt die Zeile.
2. **Kampagnen-Stunden je Tag** neben **Stunden je Kampagne** und **Kampagnen-Arbeit gegen Sonstiges**. Säulen: sieben Spalten, Wert in h:mm oben, Säule in bar auf einer Apricot-Grundlinie, heute mit einer 2px-Grundlinie in Tinte und "Heute" (800) statt des Kürzels, ohne Rahmen; kommende Tage zeigen "–" in leiser Tinte; "Std.:Min." leise im Kopf. Balkenliste: Marke, Name und "3 Std. von 6 Std." über einer Pillen-Spur (0.5rem) in der Marke, alle Zeilen auf einer Skala, das Wochenziel als 2px-Tintenstrich mit Legende. Aufteilung: geteilter Pillenbalken, Kampagnen-Arbeit voll in bar, Sonstiges schraffiert (`.series-other`: feine Diagonalen in mark-none auf Kartenweiß, deutlich heller als bar), darunter direkt beschriftet, jede Zeit an ihrem Ende des Balkens: links "Kampagnen-Arbeit 3 Std.", rechts "Sonstiges 1 Std.", je mit Schlüssel (voll bzw. schraffiert); den Anteil sagt die Kennzahl darüber (die Text-Alternative des Balkens nennt ihn mit).

**The Pattern-And-Lightness Rule.** Zwei Reihen eines Diagramms unterscheiden sich durch Muster und Helligkeit, nie durch den Farbton allein: Kampagnen-Arbeit ist voll, Sonstiges schraffiert, und `palette.spec.ts` hält bar und mark-none für jede Art des Sehens mindestens 15 auseinander (OKLab ×100), die Streifen 20 vom Kartenweiß.
3. **Kampagnen-Stunden · letzte Wochen** über die ganze Breite: acht gestapelte Säulen, unten Kampagnen-Arbeit voll in bar, darüber Sonstiges schraffiert, 2px Kartenweiß dazwischen, nur die Spitze gerundet; Farben und Legende wie "Kampagnen-Arbeit gegen Sonstiges", die Legende rechts im Kopf. Die gezeigte Woche trägt eine 2px-Grundlinie in Tinte und fette Beschriftung, keine andere Farbe. Unter jeder Säule die Kampagnen-Zeit, leise "+0:45" Sonstiges, das Datum, die laufende Woche mit "bisher"; der Tooltip der Säule und die Text-Alternative nennen beide Teile. Der Schnitt der Kampagnen-Arbeit in den Wochen davor als gestrichelte gedämpfte Linie auf derselben Skala, sein Wert in der Legende.
4. **Fortschritt je Kampagne:** eine Karte, die Legende ("in dieser Woche", "vorher") im Kopf; Zeilen als Links zur Kampagne (wo Platz ist zwei nebeneinander), links ein gerader 5px-Streifen in der Marke als gerundeter Balken, Hover in Apricot-Grund, Druck federt, Chevron gedämpft: Titel, "9 von 12 Quests · 75 %" (das Nomen folgt der Zahl: "0 von 1 Quest", "0 von 1 Ausführung"), die Änderung fett ("+4 Quests, 62 % → 75 %"), eine Spur mit dem Stand vorher in heller Marke (40 % Marke auf Weiß) und dem Zuwachs der Woche in voller Marke, darunter die Läufe eines Daily-Ziels. Ein zurückgerechneter Stand sagt es in einer leisen Zeile.
5. **Erledigt** mit Zähler: eine Karte. Ab 64rem die Woche als sieben feste Spalten Montag bis Sonntag: Kopf mit Wochentag (800), Datum gedämpft darunter und Zähler, eine Haarlinie darunter, dann die Zeilen mit Verlaufspunkten (kleiner, 1rem); ein leerer Tag behält seinen Platz mit einem leisen "–" in leiser Tinte, heute heißt "Heute" und trägt statt der Haarlinie eine 2px-Linie in Tinte. Schmaler stehen nur die Tage mit Einträgen untereinander ("Dienstag, 17. Nov." mit Zähler). Am Handy zu Beginn zu, mit "Liste zeigen" als getönter Pille im Kopf; ab 56rem offen bis acht Einträge, darüber ebenfalls zu.
6. **Das Beste der Woche:** eine Karte, nur wenn die Woche Zeilen hat (sonst keine, nichts liest sich wie eine Lücke): Titel mit "· 3 von 5 Tagen" (in der laufenden Woche zählen die Tage bis heute), rechts "Alle ansehen" als Text-Link; darunter Montag bis Sonntag die Tage mit Zeile, der Tag ("Dienstag, 17. Nov.") als Link zu seiner Zeile in Das Beste, die Zeile in Body Large, Haarlinien dazwischen; ab 56rem der Tag (12rem) neben der Zeile.
7. **Rückblick:** drei Textflächen mit Fragen als Label (800), ab 56rem nebeneinander. Sie speichern sich von selbst wie die Notizen: kurz nach dem Tippen, beim Verlassen eines Felds, beim Verbergen der Seite und beim Wechsel der Woche (dann in die Woche, für die getippt wurde); rechts im Kartenkopf still "Speichert …" und "Gespeichert". Einen Speichern-Button gibt es nicht.

Diagramme erscheinen nur für gemessene Zeit. Eine Woche ohne gemessene Zeit und ohne Erledigtes zeigt eine Leerzustandskarte statt der Diagramme, die Kennzahlen und die letzten Wochen bleiben um sie herum, wenn frühere Wochen Zeit haben. Beim Laden halten Skelettflächen das Raster des Dashboards. Ein verfehltes Wochenziel ist eine Zahl; nirgends Warn- oder Fehlerfarbe.

### Zählregel des Tages
Heute, die Kalenderwoche, der Kalendertag und das Monatsraster zählen einen Tag gleich (`utils/day-tally.ts`):
- **erledigt:** Quests und Daily-Läufe, die an diesem Tag erledigt wurden, auch wenn sie für einen früheren Tag geplant waren.
- **geplant:** erledigt plus, was für diesen Tag selbst noch offen ist (Termine eingeschlossen, auch der heutige Lauf eines Wochenziels).
- **von früher:** was von einem früheren Tag noch offen ist; das gibt es nur heute. Es steht neben der Zahl, nicht darin.
- **übersprungen:** zählt weder als erledigt noch als geplant; ein Überspringen ist eine Entscheidung, keine Arbeit, die wartet.

Heute heißt das "1 von 7 erledigt · 1 von früher" (dazu "· 1 übersprungen", wenn es das gibt), ein vergangener Tag nennt nur "4 erledigt", ein kommender "3 geplant". Google-Termine zählen nicht mit; der Satz im Kopf einer Wochenspalte nennt sie dahinter ("· 1 Termin"). Sichtbar nennt der Kopf, was der Tag ohne Uhrzeit hält ("5 Quests · 2 Dailies · 1 von früher": erledigte und offene Quests und Daily-Läufe ohne Uhrzeit, `untimedOfHistoryDay`); Termine stehen in der Spalte selbst.

**The Same-Count Rule.** Derselbe Tag hat in jeder Ansicht dieselben Zahlen mit denselben Worten. Was von früher wartet, wird genannt, nie still in "geplant" gezählt.

### Zeit in Heute
Unter dem Datum die Zählung des Tages ("2 von 5 erledigt · 1 von früher", siehe Zählregel des Tages), darunter eine leise Zeile, gedämpfte Tinte 600, 0.875rem, Tabellenziffern, die gearbeitete Zeit und Kampagnen-Stunden in Beziehung setzt, statt sie nebeneinander zu stellen: "1 Std. 40 Min. gearbeitet, davon 1 Std. 20 Min. auf Kampagnen · Woche 4 Std. 11 Min. von 20 Std.". Ging alles auf Kampagnen: "…, alles auf Kampagnen"; nichts: nur "40 Min. gearbeitet", und die Woche sagt, was sie zählt ("Kampagnen diese Woche 4 Std. 11 Min. von 20 Std."). Heute noch nichts gearbeitet: nur die Woche. Ohne Wochenziel nur die Zahlen; ohne gemessene Zeit und ohne Ziel keine Zeile. Eine Zahl bleibt bei ihrer Einheit ("4 Std. 20 Min." bricht nie in sich, geschützte Leerzeichen), und jeder Teil beider Zeilen bleibt ganz: Umbrochen wird nur zwischen den Teilen. Mit Wochenziel steht darunter ein schmaler Tintenbalken (0.375rem, höchstens 16rem) auf tiefem Apricot für die Kampagnen-Stunden der Woche gegen das Ziel, als `progressbar` mit beiden Zahlen als Text. Nie farbig, auch nicht unter dem Ziel: Hinter dem Ziel ist der Balken nur kürzer.

### Das Beste des Tages in Heute
Am Ende der Liste des Tages, erst ab der Kartenzeit der Einstellungen (voreingestellt 20:00; vorher fehlt die Karte ganz, kein Platzhalter): eine flache weiße Karte, nie gehoben. Im Kopf "Das Beste des Tages?" (Tinte 800, 1rem) und rechts "Alle ansehen" als Text-Link in tiefem Orange. Darunter das Feld (`DayBestField`): zweizeilige Textfläche ohne Ziehgriff, Platzhalter "Was war heute das Beste? Eine Zeile reicht.", Name für Screenreader "Was war heute das Beste?". Enter speichert statt umzubrechen, das Verlassen des Felds speichert, was sich änderte, Escape verwirft; "Speichert …" und "Gespeichert" still gedämpft (0.875rem, 700) als höfliche Statuszeile darunter. Ab 240 Zeichen rechts in derselben Zeile ein Zähler in Tabellenziffern ("245 / 280", vorgelesen "Noch 35 von 280 Zeichen frei.", per `aria-describedby` am Feld); bei 280 hält das Feld an. Ist die Zeile gespeichert, wird aus der Karte ihr ruhiger Zustand: Titel ohne Fragezeichen, die Zeile in Body Large, rechts ein leiser runder Stift ("Das Beste des Tages bearbeiten"), der nach Enter den Fokus bekommt. Keine Serie, keine Zahl, keine Erinnerung in der Oberfläche: ein Tag ohne Zeile ist einfach ein Tag.

**The Evening-Only Rule.** Das Beste des Tages fragt erst, wenn der Tag sich neigt, und nie lauter als eine flache Karte am Ende der Liste.

### Monats-Challenge in Heute
Die Monats-Challenge hat in Heute keine eigene Karte. Ihr heutiger Lauf steht in der Reihenfolge des Tages wie jeder andere Eintrag, die Fokuskarte bleibt immer ganz oben. In der Metazeile des Laufs steht direkt nach "Daily" das Challenge-Icon mit dem Stand in Worten, in der gedämpften Tinte der Metazeile (700): "Monats-Challenge · Tag 2 · noch 4" bzw. "Monats-Challenge · Tag 12 · 11 von 12 geschafft · noch 18" (derselbe Stand wie in den Dailies, Tabellenziffern). Diese Metazeile bricht am Handy um, statt den Stand abzuschneiden. Ist der Lauf die Fokuskarte, steht dieselbe Zeile in deren Metazeile; erledigt oder übersprungen steht er bei "abgeschlossen" und nennt dort den neuen Stand. Im "…" des offenen Laufs führt "Zur Monats-Challenge" (Challenge-Icon) zu `#/dailies?abschnitt=challenge`. Ohne Lauf heute (etwa ein Wochenziel, das heute nicht fällig ist) zeigt Heute nichts dazu; die Challenge bleibt in den Dailies erreichbar.

**Am Ende des Tages:** Ab der Erinnerungszeit der Challenge (ohne Erinnerung ab 19:00, Berliner Zeit) rückt der offene Lauf an die zweite Stelle, direkt unter die Fokuskarte, solange er offen ist; erledigt oder übersprungen geht er zu "abgeschlossen". Ein Zeitgeber weckt die Ansicht genau zu dieser Minute. Der Lauf zieht weiter wie jede Karte, und das Ziehen speichert seinen Platz; solange er abends offen ist, steht er aber trotzdem an zweiter Stelle. Im Menü hat er dann nur "Nach oben" (an den Kopf, er wird zur Fokuskarte), die anderen Karten steigen per "Nach oben" über ihn hinweg. Ein Lauf, der von einem früheren Tag wartet (etwa der eines Wochenziels), steht tagsüber bei "Nachholen" und rückt abends ebenso unter die Fokuskarte; er hat keinen Platz in der Reihenfolge von heute, zieht deshalb nicht und hat weder "Nach oben" noch "Nach unten", nur seine Schritte wie "Heute", "Morgen" und "Überspringen".

**The Calm-Challenge Rule.** Die Challenge erinnert an den Monat, ohne zu mahnen: eine Zeile in Tinte im Lauf selbst, kein Rot, kein Countdown, keine Abzeichen, nie eine Farbe allein.

### Challenge-Zeichen
Das Daily der laufenden Challenge trägt in Heute (Zeilen und Fokuskarte; der heutige Lauf statt des Zeichens das Icon mit dem Stand in Worten, siehe Monats-Challenge in Heute), im Plan, in den Dailies und im Fokus-Modus ein kleines Zeichen (`ChallengeMark`): das Challenge-Icon (ein Monatsblatt mit Fähnchen, 0.9375rem) in der gedämpften Tinte der Metazeile, direkt nach "Daily" (Dailies: zuerst in der Metazeile, Fokus-Modus: in der Zustandszeile), `role="img"` mit dem Namen "Monats-Challenge", derselbe Text im Tooltip. Keine eigene Farbe; was es ist, sagen Form und Name.

### Das Beste (Zeitleiste)
Eine eigene Ansicht in Seitenbreite (`#/das-beste`, Taste B, in der Leiste neben dem Wochenrückblick). Kopfzeile: "Das Beste", rechts "Monat wählen" als getönte Pille mit Kalender-Icon (`aria-expanded`), davor "Heute" als getönte Pille nur abseits des laufenden Monats (The Way-Back Rule; danach Fokus auf den Titel); gedämpft "Jeden Tag eine Zeile: das Schönste oder Eindrücklichste daran."
- **Monat wählen** öffnet darunter eine flache Karte mit den Jahren (Kartentitel) und je Jahr den Monaten bis heute als Pillen in einem Raster: Monate mit Zeilen sind getönte Links mit Kürzel und Zahl ("Nov. 12", vorgelesen "November 2026, 12 Einträge"), der gezeigte Monat Tinte auf Weiß mit Tintenring; Monate ohne Zeile nur leise Tinte, kein Link.
- **Heute vor einem Jahr:** gab es diesen Tag, eine flache Karte oben: Kartentitel, gedämpft "Sonntag, 23. Nov. 2025", die Zeile in Body Large.
- **Heute ohne Zeile:** im laufenden Monat eine flache Karte mit dem Feld "Das Beste von heute"; nach dem Speichern steht die Zeile oben in der Liste und hat den Fokus.
- **Monate:** Überschrift (Title, 800) mit dem Monat und rechts gedämpft "12 von 30 Tagen" (im laufenden Monat die Tage bis heute), haftend am oberen Rand auf Apricot-Grund (unter der oberen Leiste ab 56rem oder mit Maus). Darunter eine weiße Listenkarte, Zeilen mit Haarlinien: links ein Datumsblock (2.5rem: Tageszahl 1.25rem 800 über dem Wochentagskürzel gedämpft), rechts die Zeile in Body Large. Die ganze Zeile ist ein Button ("Mittwoch, 18. Nov.: … Bearbeiten"), Hover in Apricot-Hauch mit einem leisen Stift; ohne Hover steht der Stift immer da. Ein Tipp macht aus der Zeile an Ort und Stelle das Feld (Fokus darin); Enter oder Verlassen speichert, Escape gibt den Fokus an die Zeile zurück, eine geleerte Zeile verschwindet samt Zählung. Tage ohne Zeile stehen nicht da, Monate ohne Zeile auch nicht.
- **Aus der Suche:** `?tag=` öffnet den Monat des Tages, scrollt zur Zeile, gibt ihr den Fokus und markiert sie mit einem 3px-Tintenstrich links (nie nur Farbe).
- **Weiter:** ältere Monate laden, wenn das Ende in Sicht kommt, und über "Ältere Monate laden" (getönte Pille); am Anfang steht gedämpft "Hier fängt es an."
- **Leer:** ohne jede Zeile fehlt "Monat wählen"; Leerzustand und Feld sind eine ruhige flache Karte: Kartentitel "Das Beste von heute", ein gedämpfter Satz ("Eine Zeile über den schönsten oder eindrücklichsten Moment, nur für dich. …"), das Feld (sein Label nur für Screenreader). Der Platzhalter zeigt leise Beispiele, alle vier Sekunden das nächste ("Zum Beispiel: ein Gespräch", "… etwas, das gut geschmeckt hat", "… ein Moment draußen"); bei reduzierter Bewegung bleibt das erste. Keine Zählung, keine Serie.

### Fokuskarte (Signature)
Die eine große, gehobene Karte oben auf Heute: Titel als Headline; wie jede Karte öffnet ein Tipp auf Titel oder Karte den Editor, und sie zieht als Ganzes in der Reihenfolge. Darunter (bei einem Termin nach seiner Zeitspanne) Warum-Satz in Body Large und Metazeile mit Kategoriemarke, Minuten, Kampagnen-Chip, Zielstand eines Dailys (nach dem Chip; ist das Ziel die Kampagne des Chips, nur die Zahl: "9 von 24 bis 20.01.2027", nie der Name zweimal) und, wenn ihre Stoppuhr läuft, "läuft" bzw. "pausiert". Ein Daily nennt "Daily" mit Icon zuerst in der Metazeile. Darunter die Aktionen, angeführt von der Stoppuhr: der große Primär-Button mit Icon und Wort für den nächsten Schritt (▶ "Starten", ⏸ "Pausieren", ▶ "Fortsetzen"; 3.25rem hoch, Control-Ecke; ab 40rem höchstens 18rem breit; ohne fälligen Lauf ruhig wie jeder nicht verfügbare Primär-Button), dann "Erledigt" als getönte Pille mit Haken und Wort, Fokus-Modus als runder getönter Icon-Button (Name und Tooltip "Fokus-Modus") und "…" wie bei den Zeilen, dazu Fokus-Modus und nur "Nach unten". Ab 40rem stehen alle in einer Zeile. Am Handy hat der Primär-Button seine eigene Zeile über die ganze Breite; "Erledigt", Fokus-Modus und "…" folgen darunter links, wo der ruhende Plus-Button rechts sie nie verdeckt.

**Kopf von Heute am Handy:** Zählung und Zeitzeile stehen als zwei ruhige Zeilen ohne Abstand dazwischen (0.875rem, die Zählung zuerst in Tinte 700: "1 von 8 erledigt · 1 von früher", darunter "Kampagnen diese Woche 1 Std. 10 Min."), damit die Liste früher beginnt und keine Zeile mitten im Sinn bricht; "Auf morgen" ‹ › stehen in der obersten Zeile, das Datum darunter (siehe Andere Tage).

**The Turn Rule.** Nach dem Sortieren zeigt die Fokuskarte den ersten offenen Eintrag der gespeicherten Reihenfolge, auch einen Termin. Für einen unsortierten Tag gilt die Uhrzeitregel: Die Fokuskarte zeigt, was jetzt dran ist (`currentItem` in `utils/today-agenda.ts`, dieselbe Regel im Fokus-Modus): ein Termin (Quest oder Daily mit Uhrzeit) von seinem Beginn bis zu seinem Ende, also Beginn plus geplanter Dauer, ohne Dauer 30 Minuten; überschneiden sich zwei, der zuletzt begonnene. Sonst der erste Eintrag ohne Uhrzeit in der Reihenfolge, das Nächste, woran man arbeiten kann. Jeder andere Termin steht in der Liste des Tages, an seinem Platz in der Tagesreihenfolge; ein unerledigter vergangener Termin bleibt dort leiser (80 % Deckkraft) und fragt ruhig "Vorbei – erledigt?", "Anderer Tag …" zuerst in seinem "…", nie als Warnung. Bleiben an einem unsortierten Tag nur Termine, von denen keiner läuft, sagt eine ruhige Karte "In der Reihenfolge ist nichts mehr offen." und nennt den nächsten Termin. Die Karte wechselt von selbst, solange die Seite offen ist: Ein Zeitgeber wartet genau bis zum nächsten Beginn oder Ende, statt die Uhr abzufragen; nach dem Aufwachen eines Geräts holt die Ansicht nach. Als Fokuskarte zeigt ein Termin unter dem Titel seine Zeitspanne groß in Tinte (Kalender-Icon, "10:00–10:45", 1.125rem, 800), behält "Erledigt" und ▶ (ein Meeting zu messen ist legitim) und "…" mit "Termin verschieben …"; der Fokus-Modus fehlt, denn dort gibt es für Termine weder "Später" noch eine Reihenfolge, und auch die Fokuskarte lässt sich zwischen flexiblen Einträgen verschieben.

### Fokus-Ansicht
Eine Quest allein auf dem Grund, mittig, ohne Tab-Leiste und ohne Stoppuhr-Leiste: Kampagnen-Chip (Symbol und Name auf eigenem Weiß), Titel als Headline, Warum-Satz gedämpft, darunter die Stoppuhr als größte Schrift der App (800, clamp 4–7rem, Tabellenziffern; solange sie nicht läuft in leiser Tinte). Darunter Zustand ("Bereit", "Läuft", "Pausiert", "Soll erreicht") mit Soll, heute schon gearbeiteter Zeit und bei einem Termin seiner Zeitspanne ("Termin 10:00–10:30"). Steht ein fester Termin in den nächsten 15 Minuten an, folgt eine ruhige Zeile in Tinte, 700, mit gedämpftem Kalender-Icon: "Gleich um 15:30: Zahnarzt"; vorher nichts, nie in Warnfarben. Hält die Stoppuhr eine andere Quest über den Beginn hinaus im Blick, heißt die Zeile "Seit 15:30: Zahnarzt". Dann genau eine Primäraktion mit Icon (▶ Starten, ⏸ Pausieren, ▶ Fortsetzen) neben "Erledigt", leise darunter "Später" und "Überspringen". Fokus-Sperre: Soft · Hardcore (Segmentwahl mit einem Satz dazu) steht über den Buttons nur, wenn eine Sperre etwas sperrt (Sperrliste nicht leer; im Browser auch, denn die Sperre wirkt dann auf dem Handy); eine laufende Sperre nennt ihre Zeile dort. Sperrt sie nichts, steht unter "Später" nur eine leise, zentrierte Zeile ohne Ansage, gedämpfte Tinte 0.875rem: "Fokus-Sperre: Sperrliste leer · Einrichten" (Link zu Einstellungen › Fokus-Sperre) und im Browser zusätzlich "Fokus-Sperre: wirkt auf dem Handy in der Android-App". Fehlt dem Handy eine Berechtigung, sagt es dort kompakt und zentriert "Fokus-Sperre wirkt noch nicht." mit Satz und Button (`FocusBlockSetupHint`, nicht fett). Darunter die Notizen der Quest bzw., bei einem Daily-Lauf, "Notizen zu diesem Lauf", selbstspeichernd wie im Editor. Was danach kommt, nennt die Ansicht nicht. Was im Blick steht, folgt der Turn Rule der Fokuskarte; nur eine laufende Stoppuhr hält ihren Eintrag im Blick, danach kommt ein fälliger Termin dran. Ist die Reihenfolge leer und wartet noch ein Termin, heißt es "Nichts in der Reihenfolge" mit dem nächsten Termin, nicht "Alles erledigt". Oben links führt ein Link zurück zu Heute.

### Stoppuhr-Leiste
Weiße Karte. Ab 56rem oder mit Maus haftet sie oben unter der Leiste; am Handy (und auf Touch-Tablets) ist sie unten angedockt, direkt über der Tab-Leiste wie bei einem Musikplayer, und ihre Höhe samt Abstand steht als `--timer-bar-height` am Wurzelelement (ohne Leiste und in der breiten Stufe 0). Zustand und Titel links, die gearbeitete Zeit in Tinte mit "von n Min." darunter, rechts runde getönte Icon-Buttons (Pause/Weiter, Soll ändern, Erledigen, Beenden). Sie zählt hoch, ab der schon geloggten Zeit ihrer Quest; ist das Soll erreicht, sagt eine ruhige Zeile, dass die Stoppuhr weiterläuft, und einmal der Hinweis-Toast. Ein Tipp auf die Leiste, außer auf ihre Buttons, öffnet den Fokus-Modus; Zustand und Titel sind dafür ein Link ("<Titel>: Fokus-Modus öffnen").

Unter 40rem ist sie eine Zeile (rund 60px): Zustand klein über dem Titel (beide mit Auslassung), die Zeit (1.25rem), rechts im Daumenbereich Pause/Weiter und ein "…" ("Weitere Aktionen der Stoppuhr") mit Soll ändern, Erledigen und Beenden. Die Zeile zum erreichten Soll wird dort nur vorgelesen; der Zustand oben sagt es in einem Wort.

### Reihenfolge des Tages
Fokuskarte und die Einträge darunter sind eine sortierbare Liste. Jede Karte zieht als Ganzes (Maus und Stift nach 6px, Finger nach 300ms Halten); die Tastatur nimmt "Nach oben" und "Nach unten" im Menü, der Fokus bleibt danach auf dessen Button. Auch ein Druck auf den Titel hebt die Karte; ein kurzer Tipp darauf öffnet weiter den Editor. Hat der Finger lange genug gehalten, hebt sich die Karte sofort unter ihm (3 % größer, Popover-Schatten, Rand in Tinte) und das Handy vibriert kurz, noch bevor er sich bewegt; so ist ohne Farbe klar, dass sie jetzt wandert. Beim Ziehen bleibt am alten Platz eine 35 % deckende Lücke, die gezogene Zeile hebt der Kartenschatten. Wer an den Kopf rückt, wird zur Fokuskarte. Abends steht der offene Lauf der Monats-Challenge direkt unter der Fokuskarte, unabhängig von seinem gespeicherten Platz (siehe Monats-Challenge in Heute). Darüber steht das Schnell-Anlegen: ein Feld und gleich daneben zwei kleine Umschalter im Segment-Look, ↑ und ↓ (je 2rem breit, Namen "Oben einfügen" und "Unten einfügen", `aria-pressed`), die entscheiden, wo neue Quests in die Reihenfolge kommen; die Wahl gilt je Gerät für jedes Schnell-Anlegen, auch im Plan und im Questlog (dort für dessen Reihenfolge), und braucht keine eigene Zeile. Der Plan zeigt sie nur einmal, im Kopf (`InsertPlaceToggle`), damit seine Spalten das Feld ganz behalten. "Auf morgen" im Kopf verschiebt nach einer Rückfrage alles Offene samt Nachholen, Termine mit ihrer Uhrzeit; die Rückfrage nennt, wie viele wandern, und darunter gedämpft, was bleibt und warum ("„Lesen“ bleibt: Sein Zeitraum endet heute.", "… Die Stoppuhr läuft noch."); eine einzelne Karte wandert, indem man sie auf "Auf morgen" zieht (siehe Ablageziel). Bei grobem Zeiger messen ↑ und ↓ je eine volle Tap-Fläche.

### Plan-Brett
Das Brett beginnt mit heute: ganz links die Questlog-Spalte, dann, nur wenn es etwas gibt, "Liegen geblieben", dann heute und so viele folgende Tage, wie passen (siehe Layout); vergangene Tage gibt es nicht. Jede Spalte ist eine flache Fläche in 35 % Weiß mit Kartenecke; heute trägt den 2px-Tintenrahmen des Kalenders und "Heute" in der Überschrift. Kopf einer Tagesspalte: Wochentag (800) und Datum in gedämpfter Tinte, darunter leise "3 offen · 1 Std. 30 Min." (Label, tabellarisch). Darunter zuerst das Schnell-Anlegen als halbtransparentes Feld ohne Rahmen ("Quest hinzufügen …", wo das nicht ganz ins Feld passt "Hinzufügen …", nie mitten im Wort abgeschnitten) über die ganze Spaltenbreite; die Umschalter ↑ / ↓ stehen einmal im Kopf des Plans vor den Tagespfeilen, mit dem sichtbaren Wort "Neue" (gedämpfte Tinte 700, 0.875rem) davor und einer feinen senkrechten Linie danach von ihnen abgesetzt, damit sie nicht wie Navigation wirken, und gelten für jedes Schnell-Anlegen des Bretts (siehe Reihenfolge des Tages; Enter legt oben oder unten an), dann die offenen Einträge in der Reihenfolge des Tages, zuletzt Erledigtes durchgestrichen in gedämpfter Tinte. Die Zählzeile bricht nur zwischen ihren Teilen ("3 offen" · "1 Std. 30 Min."). Ein leerer Tag sagt ruhig "Noch frei.".

**Liegen geblieben** (`PlanOverdue`): dieselbe Fläche ohne Datum und ohne Schnell-Anlegen, Kopf mit einem runden Chevron-Button ("Liegen geblieben ausblenden" / "einblenden"), "Liegen geblieben" und Zähler, darunter gedämpft "Auf einen Tag ziehen oder über „…“ verschieben."; sie hält, was Heute unter "von früher" nachholen lässt (Quests und Daily-Läufe, dieselbe Regel), das früheste zuerst, die Quests mit "seit 15. Nov." in der Metazeile. Ihre Quests ziehen auf einen Tag oder ins Questlog, ihre Läufe auf einen Tag ihres Fensters; die Spalte selbst nimmt nichts an und sortiert nicht. Zugeklappt bleibt eine Leiste von 2.75rem mit Chevron, senkrechtem Titel und Zähler. Ohne eigene Wahl ist sie offen; wer sie auf- oder zuklappt, behält das auf dem Gerät (`plan:overdue`).

Einträge sind kompakte weiße Zeilen mit Control-Ecke: Titel (700, 0.9375rem; in den schmalsten Spalten, Zeile unter 8.25rem, 0.875rem) über der ganzen Breite, darunter der Kampagnen-Chip in einer Zeile, dessen Name mit Auslassung endet, dann die Metazeile (Uhrzeit, Soll, "seit 15. Nov." für Liegengebliebenes; jeder Teil bleibt ganz) und rechts daneben "…", auch wenn es keine Metazeile gibt: Ein Button neben dem Titel ließe einer Desktop-Spalte für ein deutsches Wort zu wenig Platz. Die Karte zieht als Ganzes in die Reihenfolge oder auf einen anderen Tag; ein Tipp öffnet den Editor, "…" hält die übrigen Schritte (siehe Karten). Mit dem Fokus auf ihrem Titel bewegen die Pfeiltasten sie wie das Ziehen: hoch und runter um einen Platz, links und rechts ans Ende des gezeigten Tags davor oder danach (nie in die Vergangenheit); der Fokus bleibt auf der Karte, eine Live-Region sagt, wo sie nun steht. Die Karten der Questlog-Spalte und von "Liegen geblieben" nehmen keine Pfeiltasten. Ist die Karte breit genug (Container ab 15rem, also mobil), steht "…" neben Titel und Metazeile, der Chip wieder am Ende der Metazeile.

**The Whole-Word Rule.** Titel im Plan brechen zwischen Wörtern (`overflow-wrap: break-word`, nie `anywhere`); nur ein Wort, das länger ist als die ganze Zeile, bricht in sich. Silbentrennung (`hyphens: auto`, nur Wörter ab zehn Zeichen) hilft, wo das Gerät ein deutsches Wörterbuch hat, aber die Spaltenbreiten verlassen sich nie darauf: Chromium unter Windows hat keines. Nach drei Zeilen endet ein Titel mit Auslassung; Tooltip und Name für Screenreader tragen ihn ganz. Daily-Läufe sind weiße Karten wie Quests, mit Dailies-Icon und "Daily" vorn in der Metazeile, danach die laufende Serie ("4 in Folge"); ein gespeicherter offener Lauf zieht in der Reihenfolge und auf einen anderen Tag seines Fensters (vom heutigen Tag bis zu seinem letzten Tag, wie "Morgen" auf Heute). Fällt ein Lauf außerhalb seines Fensters, kehrt er zurück, und eine ruhige Zeile über dem Brett sagt "„Laufen“ kann höchstens bis Freitag, 21. Nov. warten." (gedämpfte Tinte 600, kein Alarm). Der Kampagnen-Streifen gilt wie auf Heute; die Quest einer Kampagne selbst wiederholt ihren Namen nicht. Kopfzeile der Ansicht: die gezeigten Tage als Seitentitel ("20.–23. Nov."), rechts "Vorige Tage" und "Nächste Tage" als runde Icon-Buttons, die um so viele Tage weitergehen, wie gezeigt sind (zurück nie vor heute; an heute ist der Zurück-Button aus), und davor, nur abseits von heute, "Heute" als getönte Pille (siehe The Way-Back Rule). Die Adresse hält den ersten gezeigten Tag (`#/plan?ab=…`). Beim Laden halten Skelettflächen die Spalten des Bretts mit der Questlog-Spalte; sie werden beschnitten, nie seitwärts gescrollt.

**Am Handy** (unter 40rem) bleibt es das Brett, aber jede Spalte ist so breit wie der Bildschirm und rastet ein (`scroll-snap-type: x mandatory`): Questlog, "Liegen geblieben", dann eine Woche ab dem ersten Tag. Das Questlog ist dort eine gewöhnliche erste Spalte, sie haftet nicht und klappt nicht zu, ebenso "Liegen geblieben". Darüber haftet eine Leiste aus Chips, eine je Spalte: "Questlog · Liegen geblieben · Heute · Mi · Do …" (vorgelesen mit Datum, "Mittwoch, 25. Nov."). Ein Tipp bringt die Spalte, und der Chip der Spalte im Blick trägt `aria-current`: Weiß mit Tintenrahmen und 800 statt der Apricot-Linie, nie nur eine Farbe. Der Plan öffnet auf Heute (ab einem späteren Tag auf diesem). Gezogen wird wie überall nach langem Drücken; nahe am Rand gleitet das Brett unter der Karte zur nächsten Spalte, solange sie getragen wird, rastet es nicht. Die Schnell-Anlegen-Felder schreiben am Handy und bei grobem Zeiger in 16px, damit nichts heranzoomt.

**Questlog-Spalte** (immer, ganz links, auch am Handy): eine Fläche wie eine Tagesspalte (35 % Weiß auf deckendem Grund, Kartenecke), Kopf mit Questlog-Icon, "Questlog", Zähler und einem runden Chevron-Button zum Zuklappen; darunter das Schnell-Anlegen ohne Tag (dasselbe halbtransparente Feld wie in den Tagen; ↑ / ↓ im Kopf des Plans: an den Kopf oder das Ende des Questlogs), gedämpft "Auf einen Tag ziehen oder über „…“ einplanen." und die offenen Quests ohne Tag, an denen man arbeiten kann (wie das Questlog: keine Kampagnen, keine Questreihen mit offenen Quests), in der Reihenfolge des Questlogs als dieselben kompakten Karten mit Kampagnen-Streifen und Chip. Sie ziehen als Ganzes auf einen Tag oder an einen anderen Platz der Spalte; eine Quest vom Brett, die man hier ablegt, verliert ihren Tag und steht, wo sie abgelegt wurde. "…" nennt jeden gezeigten Tag ("Heute, 18. Nov.", "Donnerstag, 19. Nov." …), dann Bearbeiten, Stoppuhr starten und Nach oben / Nach unten, die Tastatur- und Tipp-Alternative. Abgelegt steht die Quest sofort an ihrem Platz; scheitert das Speichern, kehrt alles zurück. Zugeklappt bleibt eine Leiste in Tap-Breite mit Chevron, senkrechtem "Questlog" und Zähler. Ohne eigene Wahl ist sie offen, sobald die Brettbreite für die offene Spalte und einen Tag reicht (12 + 0.5 + 14 = 26.5rem), damit die Tage zuerst Platz haben; wer sie auf- oder zuklappt, behält das auf dem Gerät. Scrollt das Brett seitwärts, haftet sie am linken Rand.

### Kampagnen-Streifen und Kampagnen-Chip
Ein Eintrag, der zu einer Kampagne gehört, trägt links einen 5px breiten Streifen in der Marke der Kampagne (ihre gespeicherte Farbe, sonst die aus dem Titel) und nennt sie im Kampagnen-Chip (`CampaignChip`): eine Pille (1.375rem hoch) auf eigenem Kartenweiß mit 1px-Apricot-Linie, vorn eine runde Plakette (1.0625rem) in der Marke mit dem Symbol der Kampagne in on-action (ohne Symbol das Kampagnen-Icon), dahinter der Name in gedämpfter Tinte 700, 0.8125rem. Ein langer Name endet mit Auslassung; Tooltip und Screenreader ("Kampagne Buch schreiben") tragen ihn ganz. Weil die Pille ihr eigenes Weiß mitbringt, steht die Marke immer auf surface, auch auf der gehobenen Fokuskarte und auf dem Grund des Fokus-Modus. Derselbe Chip steht in Heute (Zeilen und Fokuskarte), Plan, Questlog, den Listen des Kalenders, im Fokus-Modus und in der Erledigt-Liste des Wochenrückblicks; "Teil von: …" gibt es nicht mehr. Die Quest einer Kampagne selbst trägt ihren Streifen, aber keinen Chip. Einträge ohne Kampagne bleiben ohne Streifen und Chip.

### Eintrag mit Haken-Ring (Signature)
Zeit | Ring | Inhalt | ▶ | "…". Nur Termine und Dailies mit Uhrzeit zeigen eine Zeit. Der Ring (`CheckRing`) ist 1.875rem, 2.5px Orange; erledigt füllt er sich orange und der Haken springt mit `check-pop` (Skalierung von 0.4, --spring) ein, der Titel wird durchgestrichen und gedämpft. Übersprungen: gestrichelter Ring in leiser Tinte. Derselbe Ring trägt Questlog (Erledigtes unter "n erledigt" eingeklappt), Kampagnen und die Tageslisten des Kalenders. Jede Zeile hält links Platz für den Kampagnen-Streifen, damit Ringe mit und ohne Streifen fluchten.

### Kampagnen-Kachel
Über den Kacheln steht der Kennzahlen-Streifen (`CampaignStats`): eine flache weiße Karte mit vier Zellen, getrennt durch Haarlinien, am Handy zwei kompakte Zeilen zu zwei Zellen mit kurzen Labels ("Diese Woche", "Insgesamt", "Aktiv", "Abgeschlossen"; vorgelesen das volle), ab 40rem vier nebeneinander: "Kampagnen-Stunden diese Woche", "Kampagnen-Stunden insgesamt", "Kampagnen aktiv", "Kampagnen abgeschlossen", je Label (`.card-title`) und Zahl (800, 1.5rem bis 2rem, Einheit klein und gedämpft daneben); was nicht geladen ist, ist "–". Eine Anzahl von null bleibt stehen, aber leise (gedämpfte Tinte, 700): eine Tatsache, keine Lücke. Zahl und Einheit bleiben zusammen: "43 Std. 20 Min." bricht, wenn die Zelle zu schmal ist, nur zwischen "43 Std." und "20 Min.", und die Zelle wird höher. Darunter die Kacheln; einen Baum gibt es in der Übersicht nicht, die Quests einer Kampagne stehen auf ihrer Seite.

Jede Kachel: weiße Karte mit dem 5px-Kampagnenstreifen links: runde Plakette in der Marke (Tap-Größe) mit dem Symbol in Weiß (ohne Symbol das Kampagnen-Icon), Titel (800, bricht nach The Whole-Word Rule nur zwischen Wörtern) als Button, dessen Fläche die ganze Karte deckt; Fokus als Ring um die Karte; rechts im Kopf "…" (`ActionMenu`, über der Fläche des Titels) mit "Bearbeiten" und, solange noch etwas offen ist (eine Quest oder ein laufendes Daily-Ziel), "Kampagne abschließen". Darunter, wenn Quests darunter stehen, wie weit sie ist: "4 von 8 Quests" fett, "erledigt" gedämpft, und ein flacher Tintenbalken (0.375rem) auf tiefem Apricot (Fortschritt des Servers wie auf ihrer Seite, nie sie selbst); dann "Als Nächstes: **Titel** · heute" (gedämpft, Titel in Tinte 700; "morgen", ein kurzes Datum oder ohne Tag nichts) mit dem ▶ der Stoppuhr davor (`ItemPlayButton`, ohne mögliche Stoppuhr gesperrt): unter den offenen Quests, an denen man arbeiten kann, zuerst die für heute geplanten (früheste Uhrzeit zuerst), dann Liegengebliebenes (das früheste zuerst), dann der nächste geplante Tag, zuletzt die Reihenfolge ihrer Seite (`nextQuest`). Titel und Tag bleiben zusammen ("· 27.11." steht nie allein in der letzten Zeile; Zeilen mit `text-wrap: pretty`). Sind alle Quests erledigt, läuft aber ein verlinktes Daily-Ziel noch (nicht erreicht, Zeitraum nicht vorbei), zählt es als offen: gedämpft "Noch offen: **Laufen gehen 9 von 24**". Erst wenn nichts mehr offen ist, steht dort gedämpft "Alle Quests erledigt.". Zwei Balken stehen so in einer Kachel, Quests und Woche; jeder hat seine Zeile in Worten darüber. Darunter der Wochenstand in Tabellenziffern ("3 Std. 30 Min. von 6 Std." fett, "diese Woche" gedämpft; die Zeile bricht nur zwischen "3 Std. 30 Min.", "von 6 Std." und "diese Woche", nie mitten in einer Angabe), bei Wochenziel ein flacher Tintenbalken (0.375rem) auf tiefem Apricot, der bei Übererfüllung einfach voll ist, dann der Verlauf der letzten acht Wochen als feine Linie in der Marke über einer Apricot-Grundlinie (fest 2.5rem hoch), darüber das kurze Label "8 Wochen" (gedämpft 700, 0.8125rem), als Text-Alternative "Letzte 8 Wochen: ab 28.09. 2 Std., …, diese Woche 4 Std.", dann "Insgesamt …" gedämpft und zuletzt, erst wenn alle Quests erledigt sind, "Abschließen" als getönte Pille mit Haken (abgeschlossene Kampagnen: "Wieder öffnen"), die über der Fläche des Titel-Buttons liegt und wie der Ring fragt (siehe Kampagne abschließen); vorher steht es im "…". Über den Kacheln die Segmentwahl Aktiv · Abgeschlossen. Nach den aktiven Kacheln steht die gestrichelte Kachel "Neue Kampagne" (1.5px gestrichelt in line-strong, Plus und Text in tiefem Orange 700, Hover in Apricot-Hauch), die das Kampagnen-Formular öffnet wie der Plus-Button. Der Plus-Button legt in der Übersicht eine Kampagne an, in einer geöffneten Kampagne eine Quest darunter ("Neue Quest in „Buch“", Warum und Kategorie übernommen). Hat eine geöffnete Kampagne noch keine Quests, sagt eine leise Zeile unter "Quests der Kampagne": "Noch keine Quests. Der Plus-Button legt die erste an."

### Kampagnen-Detailkarte
Die geöffnete Kampagne ist eine flache Karte mit ihrem Streifen (die gehobene bleibt frei, The One-Lifted-Card Rule). Von oben nach unten, jede Zahl einmal:
- **Kopf:** Plakette mit Symbol, Titel (1.375rem, 800; gedämpft "Abgeschlossen" darunter, wenn sie es ist), rechts "…" mit den Aktionen der Kampagne. Die geöffnete Kampagne ist die Seite: Ihr Titel ist die Überschrift (h1), der Kopf "Kampagnen" mit Untertitel entfällt, darüber steht nur "‹ Alle Kampagnen".
- **Ihr Warum** direkt darunter in Body Large, gedämpft, höchstens 60ch: wozu die Kampagne da ist. Ohne Warum keine Zeile.
- **Diese Woche** (Gruppe unter einer Haarlinie, Titel als `.card-title`): "1 Std. 10 Min. von 6 Std." fett mit "Kampagnen-Stunden" gedämpft, bei Wochenziel ein flacher Tintenbalken (0.5rem), übererfüllt einfach voll; darunter die Kopfzeile "letzte 8 Wochen" links und "insgesamt 20 Std. 20 Min." rechts über dem Verlauf als feine Linie in der Marke (Text-Alternative mit allen Wochen). Ohne Kampagnen-Stunden (nicht geladen) fehlt die Gruppe.
- **Fortschritt** (Gruppe unter einer Haarlinie), nur wenn Quests darunter stehen: "1 von 4 Quests" in Tinte 700, mit "· 30 von 195 Min.", wenn der Balken Minuten zählt, darüber nichts weiter; dann der flache Tintenbalken und das Burnup. Erst ab zwei Tagen Verlauf zeigt das Burnup die Segmentwahl Erledigt · Noch offen und Anzahl · Minuten, die Linien (höchstens 30rem breit), die Legende und "Stand 18.11., seit 29.10." (bei Minuten mit den Zahlen, die der Balken nicht nennt); an einem Tag steht statt alledem einmal "Der Verlauf beginnt heute. Ab morgen zeigt hier eine Linie, wie es vorangeht."
- **"Bearbeiten" und "Abschließen"** (bzw. "Wieder öffnen") als getönte Pillen nebeneinander zuletzt; "Abschließen" nur, wenn nichts mehr offen ist (dieselbe Regel wie auf der Kachel, `readyToComplete`), sonst steht es nur als "Kampagne abschließen" im "…" des Kopfs; am Handy hält die Zeile rechts Platz für den Plus-Button frei und bricht lieber um. Am Handy rückt jede Ebene des Baums 0.625rem statt 1rem ein; der Editor heißt hier "Kampagne bearbeiten", "Abschließen" fragt wie der Ring.
- **Quests der Kampagne** unter der Karte: offene zuerst in ihrer Reihenfolge, erledigte (jede mit dem, was unter ihr liegt) darunter zugeklappt hinter "N erledigt" (leiser Pillen-Button in gedämpfter Tinte 700 mit Chevron, wie im Questlog). Titel brechen nach The Whole-Word Rule (`overflow-wrap: break-word`, `hyphens: manual`), also "Wohnungsübergabe-/Protokoll" am Bindestrich, nie mitten im Wort.

### Farbe und Symbol wählen
Im Bearbeiten-Dialog einer obersten Quest hinter dem Aufklapper "Kampagne (Farbe, Symbol, Wochenziel)", der offen beginnt, sobald eins davon gesetzt ist, und zugeklappt die Wahl nennt ("Beere · Füller · 6 Std. pro Woche"); beim Anlegen einer Kampagne offen. Farben in der gemeinsamen Palette (`MarkPicker`, auch für Kategorien): runde Muster (2rem in Tap-Fläche), gewählt mit weißem Haken und Tintenring; "Automatisch aus dem Titel" als Ring in der abgeleiteten Marke vorn (bei Kategorien "Automatisch: eine freie Farbe", die Marke, die der Server ihr dann gibt). Zuerst die acht Kernfarben unter "Für alle gut unterscheidbar", darunter "Weitere Farben"; jedes Muster nennt seinen Namen im Tooltip und für Screenreader. Symbole als Kacheln in Control-Ecke mit Apricot-Linie, gewählt Tinte auf Weiß. Unter jeder Gruppe steht die Wahl in Worten ("Beere", "Füller"), jede Option hat einen gesprochenen Namen. Darunter "Wochenziel in Stunden" als Zahlfeld in halben Stunden.

### Kampagnen-Zeile
Weiße Karte je Quest: Einrückungslinie, Chevron zum Auf- und Zuklappen (sonst Platzhalter in Tap-Breite; am Handy hält nur eine Zeile, die aufklappen kann, diese Spalte frei, ein Blatt gibt die Breite dem Titel), Haken-Ring, Titel als Button (wie die ganze Karte), Metazeile mit Kategoriemarke. Nur Quests mit Unter-Quests zeigen Fortschritt als flachen Balken mit Zähler; er zählt nur die Quests darunter, nie die Quest selbst ("1/3" bei drei Quests, eine erledigt; "30/90 Min.", wenn jede darunter eine Dauer hat). Rechts ▶ für offene Quests und der Auslöser des gemeinsamen Aktionsmenüs (Bearbeiten, Unter-Quest hinzufügen, Verschieben, Löschen). Die Zeilen stehen nur in einer geöffneten Kampagne; eine Zeile, die man auf eine andere zieht, wandert unter sie.

### Kampagne abschließen
Der Ring einer Kampagne (oberste Quest), unter der noch Quests offen sind, fragt im üblichen Dialog: Titel "Kampagne abschließen?", gedämpft "3 Quests in „Buch“ sind noch offen. Sie bleiben offen; die Kampagne steht danach unter „Abgeschlossen“.", dann "Kampagne abschließen" als Primär-Button und "Abbrechen". Das stimmt mit dem Modell überein: Erledigen betrifft nur die Kampagne selbst, die Quests darunter behalten Zustand und Tag. Ohne offene Quests darunter fragt nichts. Danach sagt der Toast "„Buch“ abgeschlossen" mit Rückgängig. Gilt in Kampagnen ("Abschließen" auf der Kachel und der Detailkarte, "Kampagne abschließen" im "…" der Detailkarte), Heute und im Plan (X); das Questlog führt keine Kampagnen, und der Kalender kennt die Kampagne seiner Zeilen nicht und fragt nicht. Beim Ziehen wird das Ziel mit 2px gestrichelter gedämpfter Tinte umrandet.

### Daily-Karte
Weiße, flache Karte: vorn der Haken-Ring für den heutigen Lauf, wo einer fällig ist oder heute erledigt wurde (gefüllt; antippen öffnet ihn wieder), mit Rückgängig im Toast wie auf Heute; Dailies ohne heutigen Lauf halten die Ringspalte frei, pausierte haben keine. Dann Titel (als Button zum Bearbeiten), Warum-Satz in gedämpfter Tinte (das eigene, sonst das übernommene seiner Kampagne oder der Quest, die das Daily zählt), Metazeile mit dem Stand der Woche zuerst in Tinte, dann Kategoriemarke, dem Rhythmus in Klartext und zuletzt dem Kampagnen-Chip. Der Stand kommt aus derselben Lesart der Woche wie der Kalender: ein Wochenziel zählt ("2 von 3 diese Woche"), ein Zeitplan nennt heute ("heute fällig", "heute erledigt", "heute übersprungen") oder den nächsten Tag dieser Woche ("morgen fällig", "Freitag fällig", sonst "diese Woche nicht mehr fällig"). Nie farbig; lädt die Woche nicht, fehlt nur der Stand. Nach dem Stand die Serie: "12 in Folge · Rekord 21" (ein Wochenziel zählt Wochen: "3 Wochen in Folge · Rekord 5 Wochen"); eine gerissene Serie ist eine Zahl wie jede andere ("0 in Folge · Rekord 21"), nie eine Warnung, und ohne je einen erledigten Lauf steht nichts da. Pausierte Dailies gedämpft und ohne Stand. Die Kopfzeile der Ansicht folgt dem Seitenmuster: der Einleitungssatz steht unter dem Titel, nicht daneben. Der Verlauf der letzten 14 Tage scrollt, wo er nicht passt, in sich (nie die Seite) und beginnt am rechten Ende, heute und gestern im Blick; dann ist er ein Tabstopp, den die Pfeiltasten scrollen.

Die Dailies stehen nach Kategorie gruppiert, in der Reihenfolge der Einstellungen: je Gruppe eine Überschrift (`.section-title`) mit der Kategoriemarke vor dem Namen und dem Zähler, dann "Ohne Kategorie", zuletzt "Pausiert" mit dem Satz "Pausierte Dailies stehen nicht in Heute.". Darüber eine Filterzeile aus zwei kompakten Auswahlen nebeneinander (am Handy untereinander, wenn es eng wird), je mit Label davor in gedämpfter Tinte 700: "Kategorie" (Alle, jede Kategorie, Ohne Kategorie) und "Kampagne" (Alle, jede Kampagne, zu der ein Daily gehört, Ohne Kampagne). Der Filter steht in der Adresse (`#/dailies?kategorie=…&kampagne=…`); bleibt nichts übrig, sagt ein Leerzustand "Keine Dailies für diesen Filter." mit "Alle zeigen". Einmal über der ersten Karte (zwischen Gruppentitel und Liste) erklärt eine leise Legende in gedämpfter Tinte 700, 0.8125rem, die Zeichen des Verlaufs: "Letzte 14 Tage:" und je Zustand das Zeichen des Verlaufs selbst (`HistoryDayMark`, dieselbe Komponente wie im Streifen) mit seinem Wort: erledigt, verpasst, übersprungen, noch offen, kein Eintrag. Ohne ein einziges Daily steht statt der Liste ein Leerzustand: Titel "Dein erstes Daily", ein Satz, wozu Dailies da sind, drei getönte Pillen mit Ideen ("Wasser trinken", "10 Min. lesen", "Spazieren gehen"), die "Neues Daily" mit diesem Titel öffnen, und "Daily anlegen" als Primär-Button.

### Monats-Challenge in den Dailies
Ganz oben in den Dailies, vor dem Filter, ein Abschnitt "Monats-Challenge" (Abschnittstitel mit gedämpftem Challenge-Icon, Adresse `#/dailies?abschnitt=challenge`, dort bekommt der Titel den Fokus). Die Challenge dieses und die des nächsten Monats sind je eine flache weiße Karte: oben gedämpft der Monat ("November 2026"), darunter der Titel des Dailys (800), rechts "…" ("Challenge beenden" bei der laufenden, zuletzt "Löschen"), darunter der Stand in Tinte 700 (läuft: wie in Heute; kommt noch: "Ab 1. Dez. · 31 Läufe fällig"; geschafft: Haken-Icon und "Geschafft · 30 von 30"; darunter: "90 % geschafft (27 von 30)"; beendet: "Beendet am 14. Nov. · 1 von 2 geschafft") und derselbe schmale Balken in Tinte. Ist das Daily gelöscht, sagt eine gedämpfte Zeile, dass das Ergebnis bleibt. Eine laufende oder kommende Challenge hat die Zeile "Täglich erinnern" mit dem Zeitfeld (voreingestellt 19:00) und dem Schalter, beides speichert sofort, still "Gespeichert.". Beenden und Löschen fragen in einem kleinen Dialog: "Ja, beenden" als Primär-Button neben "Weiterlaufen lassen", "Ja, löschen" rot neben "Nicht löschen".

Ohne Challenge in diesem Monat steht eine flache Karte mit einem gedämpften Satz und "Challenge starten" als Primär-Button; ab dem 16. (solange der nächste Monat frei ist) wird der nächste Monat die Hauptaktion: "Der November hat nur noch 6 Tage – wähle eins für Dezember." (die Tage samt heute), "Challenge für Dezember festlegen" als Primär-Button und darunter "Doch noch für November" als getönte Pille. Läuft eine, folgt ab dem 16. unter ihr "Challenge für Dezember festlegen" als getönte Pille. Der Dialog "Monats-Challenge starten" (`MonthChallengeDialog`) fragt der Reihe nach: Monat als Segmentwahl (dieser, der nächste; darunter gedämpft "Gezählt wird ab heute, 23. Nov.: 8 Tage."), Erinnerung (Schalter "Täglich erinnern", Zeitfeld, gedämpfte Erklärung), Daily als Segmentwahl "Vorhandenes Daily | Neues Daily", dann die Auswahl der aktiven Dailies mit "Challenge starten" oder das Formular "Neues Daily" mit "Daily anlegen und Challenge starten"; die Aktionen haften wie im Editor am unteren Rand.

"Frühere Challenges" (gedämpfter Untertitel 800) listen die vergangenen Monate, neueste zuerst, in einer weißen Karte zwischen Haarlinien: Monat gedämpft, Titel des Dailys, rechts das Ergebnis in Tinte 700 mit Tabellenziffern: "Geschafft" mit Haken-Icon oder "90 %" mit "(27 von 30)" gedämpft daneben. Unter 30rem rückt der Monat über die Zeile.

### Kalender
Kopfzeile in zwei Zeilen statt einer Wand aus Steuerelementen: oben der Zeitraum als Titel-Button, der den Datumswähler öffnet, rechts daneben der Filter als leiser Icon-Button (siehe Chips); darunter links die Segmentwahl Monat · Woche · Tag (am Handy so breit, wie Vor/Zurück übrig lassen), rechts Vor und Zurück als runde getönte Icon-Buttons. "Heute" erscheint als getönte Pille vor den Pfeilen nur, wenn der gezeigte Zeitraum heute nicht enthält; nach dem Tippen geht der Fokus auf den Titel, der den neuen Zeitraum nennt (The Way-Back Rule). Die Tab-Folge entspricht der Sicht: Titel, Filter, Modus, Heute, Zurück, Vor. So stehen, solange heute gezeigt wird, sechs Bedienelemente und ein leises Icon vor dem Inhalt statt acht.
- **Monat:** Raster aus Tagen in Control-Ecke, heute mit 2px-Tintenrahmen innen, gewählt weiß mit Kartenschatten. Unter jeder Zahl ruhige Punkte (0.4375rem): gefüllt für Erledigtes, Ring für Offenes, ein kurzer Strich in leiser Tinte für Termine (eigene Quests mit Uhrzeit, offen oder erledigt, und Termine aus Google Kalender); darunter die Zeit im Logbuch als Zahl in gedämpfter Tinte (700, 0.8125rem; "2 Std. 15 Min.", mobil "2:15 h"), keine Heatmap. Eine Legende in Label-Größe erklärt alles. Die Liste des gewählten Tages steht in zwei Gruppen, "Quests" und "Dailies" mit Zähler (die Daily-Läufe des Tages: erledigte mit "Erledigt um 07:15", übersprungene und offene, auch an vergangenen Tagen), und folgt dem Kartenvertrag: offene Quests mit Ring (Rückgängig im Toast), Karte öffnet den Editor, "…" mit Morgen, Nächste Woche (und Heute für Liegengebliebenes), "Anderer Tag …" und Bearbeiten.
- **Woche:** sieben Tagesspalten Montag bis Sonntag auf einer gemeinsamen Stundenachse links (je ein kompakter Tageskalender, siehe Tageskalender), ein Brett, das nach unten durch die Stunden scrollt und beim Öffnen auf jetzt (laufende Woche) bzw. dem ersten Eintrag steht; Köpfe und Stunden haften. Jeder Spaltenkopf ist ein Button, der den Tag öffnet: Wochentag (800) und Datum, darunter die gearbeitete Zeit in Tinte und gedämpft, was der Tag ohne Uhrzeit hält ("5 Quests · 2 Dailies"; 700, 0.8125rem); für Screenreader nennt er den Tag im Satz nach der Zählregel ("1 von 7 erledigt · 1 von früher, 2 Std. im Logbuch"; "Nichts geplant · 45 Min. gemessen"). Heute: Spalte in 35 % Weiß, eine 2px-Tintenlinie unter dem Kopf (`aria-current="date"`) und die Jetzt-Linie, deren Uhrzeit in der Stundenspalte steht. Logbuch-Blöcke öffnen und ziehen in der Woche wie im Tag. Am Handy, wo die sieben Spalten nicht nebeneinander passen, beginnt die laufende Woche seitlich mit heute gleich neben der Stundenspalte (auch nach dem Blättern zurück in sie), jede andere Woche mit Montag; der Titel nennt weiter die ganze Woche, und der Kopf von heute sagt über dem Wochentag "Heute" (800, 0.8125rem). Nach unten öffnet die Woche auf einer vollen Stunde, damit keine halbe Stundenzahl unter den Köpfen klebt. Die Wochenziele stehen darunter, das Erledigte zuerst: neben dem Namen "2 von 4 erledigt · noch 2" (erreicht ohne "noch"); Wochenquote und Perfect Week gehören in den Wochenrückblick, nicht in die Kalenderwoche.
- **Tag:** links die Tagesreflexion, direkt darunter "Das Beste des Tages" als eigene Karte mit demselben Feld wie in Heute (für heute und vergangene Tage), darunter leise die Zählung des Tages (gedämpfte Tinte 600, Tabellenziffern), dann "Offen / geplant", "Von früher", "Erledigt", "Übersprungen" (dieselben Zeilen wie im Monat) und Wochenziele. Offenes steht wie auf Heute: Termine nach Uhrzeit, der Rest in der Reihenfolge des Tages (die Regel liegt beim Server, `day-order.ts`); was von früher wartet, hat seine eigene Gruppe wie Nachholen. Erledigtes steht in der Folge, in der es erledigt wurde, auch an vergangenen Tagen. Rechts (mobil darunter) der Tageskalender des Tages mit Kopf "Logbuch" und Summe ("Logbuch 1 Std. 40 Min."; künftige Tage "Termine") und "Zeit nachtragen" als leisem Button mit Plus.

### Tageskalender
Eine Spalte je Tag (`DayCalendar`), in der Geplantes und Gemessenes auf einer Stundenachse stehen, statt in zwei Spuren nebeneinander; Heute, der Kalender-Tag und jede Spalte der Kalenderwoche nutzen sie. Fläche in 35 % Weiß mit Kartenecke, Stundenlinien in Apricot-Linie, Uhrzeiten in leiser Tinte links (4rem je Stunde); die Achse reicht von 6 Uhr (oder der vollen Stunde eines früheren Eintrags) bis Mitternacht und scrollt in sich, beim Öffnen auf jetzt, sonst auf den ersten Eintrag; schmaler als ihre Spalte (Kalender-Tag mobil, Heutes "Logbuch") steht sie in voller Höhe und scrollt mit der Seite.
- **Termine** (Quests und Dailies mit Uhrzeit, offen oder erledigt) als Blöcke in 55 % Weiß mit Haarlinie, Titel (700, 0.8125rem) und Zeit; Google-Termine ebenso, ohne Linie, mit "· Google", nur lesend. Bearbeitet werden Termine in ihrem Editor.
- **Erledigtes ohne Uhrzeit** als schmale Marke (1.5rem, Pille in 55 % Weiß) zur Zeit des Abhakens: der gefüllte Punkt der Verlaufszeile mit weißem Haken und der Titel, vorgelesen als ein Satz "Titel, erledigt um 05:37" (der sichtbare Titel ist für Screenreader verborgen); ein Zustand, kein Bedienelement.
- **Logbuch-Abschnitte** als weiße Blöcke mit dem 5px-Kampagnenstreifen (ohne Kampagne mark-none), Titel, Zeiten und Kampagnen-Chip (The Never-Colour-Alone Rule); die sichtbare Höhe entspricht der tatsächlichen Laufzeit, aber nie weniger als eine Zeile ihres Labels.
- **Kurze Abschnitte** bleiben lesbar, ohne dass die Schrift schrumpft oder die Zeilenhöhe gequetscht wird (`logLabelMode` in `utils/logbook.ts`): Ab einer halben Stunde (2rem) stehen Titel und Zeiten in zwei Zeilen; darunter steht eine Zeile in normaler Größe, "Lesen · 25 Min." (Titel 700, 0.8125rem; Länge gedämpft, 0.75rem), der Titel kürzt mit Auslassung. Unter einer Zeilenhöhe (1.375rem, rund 21 Minuten) wird der Block trotzdem eine Zeile hoch gezeichnet; statt des Randstreifens trägt er dann einen kleinen Pegel in Kampagnenfarbe (4px breit, frei von der runden Ecke), so hoch wie seine echten Minuten, so bleibt die wahre Länge sichtbar. Damit eine Folge kurzer Abschnitte nicht übereinander liegt, belegt jeder in der Spalte mindestens diese Zeile: Was sich so überschneidet, steht nebeneinander wie überlappende Termine, und dann nennt jede Zeile nur ihren Titel (die Länge steht im Tooltip, im Vorlesetext und im Dialog). Ein so kurzer Block ist zu niedrig für zwei Ränder: links zieht der Anfang, rechts das Ende, die Mitte nimmt einen Tipp in Fingerhöhe. Termine brauchen das nicht: Sie sind ohnehin mindestens eine Tap-Höhe hoch und tragen dort Titel und Zeit. Ein Tipp öffnet "Abschnitt korrigieren" (Start, Ende, "Speichern", "Löschen", "Abbrechen"). Oberer und unterer Rand ziehen (Maus, Stift und Finger; ein kleiner Strich in leiser Tinte zeigt sie beim Hover): der Rand rastet auf 5 Minuten, der Block nennt dabei live seine Zeiten und hebt sich mit dem Kartenschatten, nie über den anderen Rand hinaus und nie in die Zukunft; Loslassen speichert, Escape bricht ab, eine Statuszeile sagt danach die neuen Zeiten. Der Dialog ist der Weg der Tastatur; der Rand eines Abschnitts vom Vortag zieht nicht.
- **Überlappendes** steht nebeneinander; **jetzt** ist auf heute eine 2px-Tintenlinie mit Punkt über die Spalte, ihre Uhrzeit steht in Tinte 800 in der Stundenspalte.
- **Zeit nachtragen:** "Zeit nachtragen" im Kopf oder ein Tipp auf freie Zeit öffnet denselben Dialog für einen neuen Abschnitt (Eintrag, Von, Bis; ab der getippten Viertelstunde für eine halbe, nie in die Zukunft). "Löschen" nimmt den Abschnitt sofort aus der Spalte, der Toast sagt "Abschnitt „Lesen“ gelöscht" mit Rückgängig; solange zeigt der Kopf "Logbuch" ohne Summe.
- In der Woche ist die Spalte kompakt: ohne Kopf und eigene Stunden, die teilt die Woche links; der Kampagnen-Chip fällt dort weg, der Streifen und der Name im Label bleiben. Kurze Abschnitte zeigen dort nur ihren Titel in einer Zeile, beim Ziehen ihre Zeiten.

### Verlaufszeile
Nur lesend: statt des antippbaren Rings ein kleiner gefüllter Punkt (1.25rem) in gedämpfter Tinte mit weißem Haken; übersprungen gestrichelt in leiser Tinte. Ein Zustand, kein Bedienelement, daher nie orange.

### Fortschrittsbalken
Pillen-Spur in tiefem Apricot, Füllung flache Tinte, Breitenwechsel 240ms --ease-out. Gilt für Quests mit Unter-Quests und die Woche gegen das Wochenziel im Kopf von Heute (0.375rem). Der Balken der Kampagnen-Stunden im Wochenrückblick (0.5rem) füllt mit bar.

### Undo-Toast
Gemeinsame Komponente für Heute, Questlog, Plan, Kalender, Kampagnen und Dailies: jede Erledigung mit dem Ring (oder X) und das Löschen eines Logbuch-Abschnitts. Tintenfarbene Pille über Tab-Leiste und Plus-Button, weiße Schrift 600, rechts ein weißer Pillen-Button "Rückgängig" in tiefem Orange. Erscheint mit 0.75rem Aufstieg in 240ms und bleibt fünf Sekunden. Ein Löschen wartet hinter dem Toast: Erst wenn er abläuft, ein neuer ihn ersetzt, die Ansicht wechselt oder die Seite schließt, geht es zum Server; "Rückgängig" zeigt das Gelöschte nur wieder. Die Leiste der Stoppuhr ("Erledigen") und der Fokus-Modus ("Erledigt") haben keinen Toast; dort folgt die nächste Quest.

### Hinweis-Toast
Dieselbe Tintenpille wie der Undo-Toast, für etwas, das von selbst geschieht: das erreichte Soll der laufenden Stoppuhr ("Soll erreicht: Kapitel schreiben · 25 Min. Die Stoppuhr läuft weiter."). Kommt aus `TimerProvider` und steht daher auf jeder Ansicht, auch im Fokus-Modus; eine Stufe über dem Platz des Undo-Toasts, damit beide zugleich Platz haben. Rechts ein weißer Pillen-Button "OK" in tiefem Orange; er verschwindet nach zehn Sekunden von selbst. Keine Warnfarbe, kein Ton aus der App; die Systemmeldung kommt vom Gerät.

### Einzelkarte: Anmeldung und Boot-Fehler
Eine ruhige, gehobene weiße Karte mittig auf dem Grund. Anmeldung: Wortmarke (runde Scheibe in logo-disc mit Tinten-Icon, Name in Title; hell der Apricot-Hauch, dunkel eine ruhige warme Stufe mit 3:1 zur Karte), Headline, gedämpfte Einleitung, Felder, ein einziger voller Primär-Button über die ganze Breite. "Passwort vergessen?" steht als kleiner Link rechts in der Label-Zeile des Passworts (Abstand wie beim E-Mail-Feld, unsichtbare Tap-Fläche von 2.75rem nach oben; im DOM nach dem Feld, damit Tab von E-Mail zu Passwort geht). Unter dem Button nur zwei leise Zeilen: gedämpft "Noch kein Konto?" mit dem Link "Konto erstellen", darunter klein "Bestätigung erneut senden", und das nur, nachdem eine Anmeldung an der unbestätigten E-Mail scheiterte. Fehler stehen in Alltagsworten über dem Button (was los ist und was man tun kann), nie als Text des Servers. Boot-Fehler: zentriert "Keine Verbindung zum Server" (1.375rem, 800), gedämpfte Erklärung (max. 34ch) und ein Primär-Button zum erneuten Versuch, ohne Rot.

### Lade- und Leerzustände
Skelett aus 55 %-weißen Kartenflächen (Basis 4.25rem; Fokus 13rem, Einträge 4.5rem), pulsierend zwischen voller und halber Deckkraft (1.6s). Leerzustand als weiße Karte, zentriert, fetter Titel plus gedämpfter Satz.

**Willkommen in Heute** (`TodayWelcome`): Ein ganz neues Konto (noch keine Quest und kein Daily) sieht an einem leeren Tag statt "Für heute ist nichts geplant." eine weiße Karte, links gesetzt: "Hier steht dein Tag." (800), ein gedämpfter Satz, dann Quest, Daily, Kampagne und Questlog je mit dem Icon ihrer Ansicht (gedämpft), Name (800) und einem Satz in gedämpfter Tinte (ab 40rem zweispaltig). Darunter "Zum Ausprobieren:" (gedämpft 700, 0.875rem) und drei getönte Pillen mit Titel und Art in Worten ("Wasser trinken Daily", "Spazieren gehen Daily", "Einkaufen Quest für heute"); ein Tipp füllt nur den Titel vor (eine Quest ins Schnell-Anlegen, ein Daily in "Neues Daily"), angelegt wird erst mit Enter oder "erstellen". Zuletzt die eine Hauptaktion "Erste Quest anlegen" als Primär-Pille mit Plus, am Handy über die ganze Breite; ab 64rem fehlt sie, dort ist "Neue Quest" im Kopf diese Aktion. Keine Punkte, keine Abzeichen, kein Drängen; ein Konto mit Inhalt behält an einem leeren Tag den ruhigen Satz.

## Do's and Don'ts

### Do:
- **Do** Farben, Ecken, Abstände, Tap-Größen und Bewegung ausschließlich über die Tokens in `frontend/src/style.css` beziehen; eine neue Farbe bekommt einen Wert für Hell und für Dunkel.
- **Do** neue Farbpaare in `frontend/src/theme.spec.ts` aufnehmen, damit beide Themen ihren Kontrast halten.
- **Do** neue Ansichten aus den gemeinsamen Bausteinen (Seite, Buttons, Felder, Segmentwahl, Chips, Karte, Leerzustand, Hinweis, Skelett) zusammensetzen.
- **Do** jede Nebenaktion als getönte Pille (action-tint, Schrift action-strong) bauen und pro Kontext höchstens einen orange gefüllten Primär-Button setzen.
- **Do** Zeilenaktionen in einem Menü "Aktionen für …" bündeln: unteres Blatt auf dem Handy, Popover ab 40rem.
- **Do** antippbare Elemente mit `--press` drücken und über `--spring` (420ms) zurückfedern lassen.
- **Do** Tap-Ziele von mindestens 2.75rem halten, auch auf dem Desktop; bei grobem Zeiger auch Segmentwahl, ↑/↓ im Schnell-Anlegen, die Werkzeuge der Notizen (die Zeile bricht um) und Logbuch-Blöcke (unsichtbare Trefferfläche, das Bild bleibt).
- **Do** Kategorien mit `categoryMark(name, color)` als kleine Marke zeigen, nie als eingefärbte Fläche, und Kampagnen mit Streifen und `CampaignChip`; nie Farbe allein.
- **Do** neue Kartenmenüs mit `rowMenu()` bauen, damit die Reihenfolge überall gleich bleibt.
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
