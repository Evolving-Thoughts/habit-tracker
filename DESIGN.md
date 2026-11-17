---
name: Habit-Tracker
description: Warmer, ruhiger Tagesplaner für Aufgaben, Gewohnheiten und Ziele, gebaut für eine Hand am Handy.
colors:
  ground: "#fde4d0"
  ground-deep: "#f9d3b5"
  surface: "#ffffff"
  line: "#f1cfb4"
  ink: "#2b1d16"
  ink-muted: "#6b4d3d"
  ink-soft: "#8f6a55"
  action: "#c2410c"
  action-strong: "#9a330a"
  action-tint: "#fff1e8"
  action-tint-hover: "#ffe2cf"
  on-action: "#ffffff"
  success: "#2e7d4f"
  danger: "#b42318"
  danger-tint: "#fff0ec"
  mark-moss: "#6d8b5a"
  mark-slate: "#4f7c99"
  mark-heather: "#9a6b9e"
  mark-ochre: "#b08a3e"
  mark-sage: "#5f8f87"
  mark-walnut: "#8c6b55"
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
---

# Design System: Habit-Tracker

<!-- Aufgenommen aus dem ausgelieferten Code: App-Hülle (Tab-Leiste, Mehr-Menü, Dialoge, Boot-Fehler), Heute, Todo-Dump, Aufgabenbaum, Habits, Kalender (ersetzt Kalender und Verlauf), Kategorien, Einstellungen und Anmeldung. Alle Ansichten beziehen Farben, Ecken und Abstände aus den Tokens und setzen sich aus den gemeinsamen Bausteinen am Ende von frontend/src/style.css zusammen. -->

## Overview

**Creative North Star: "Der warme Küchentisch"**

Ein Ort, an dem man morgens kurz den Tag auslegt: warmer Apricot-Grund, darauf weiße Karten mit großen weichen Ecken, eine runde, freundliche Schrift in komfortablen Größen. Das System ist ruhig und flach; Tiefe entsteht aus dem Wechsel zwischen warmem Grund und weißer Karte, nicht aus Schatten oder Verläufen.

Genau eine kräftige Farbe, ein gebranntes Orange, trägt die ganze Bedienung. Sie erscheint nur auf dem, was man antippen kann: Haken, Primär-Button, aktiver Tab, Plus-Button. Alles andere spricht in warmer Tinte. Kategorien bekommen kleine, gedämpfte Farbmarken, die nie orange sind, damit Orange immer "hier tippen" bedeutet.

Bewegung ist taktil: Antippbares gibt beim Druck leicht nach und federt beim Loslassen kurz über. Liegengebliebenes und Fehler werden ohne Alarmfarbe gezeigt; die Oberfläche bietet an, statt zu mahnen.

**Key Characteristics:**
- Warmer Apricot-Grund, weiße Karten, warme braune Tinte statt Grau.
- Eine Aktionsfarbe, ausschließlich auf Antippbarem.
- Große weiche Ecken (Karte 1.375rem, Control 0.875rem, Pillen).
- Nunito Variable, kräftige 700/800-Gewichte für Titel und Labels, tabellarische Ziffern für Zeiten und Zählungen.
- Flach mit einem einzigen leisen Kartenschatten; Druck federt.
- Mobile zuerst: Tap-Ziele ab 2.75rem, feste Tab-Leiste unten, ab 56rem Leiste oben.
- Ein gemeinsamer Bausatz (Seite, Buttons, Felder, Segmentwahl, Chips, Karte, Zustände) für jede Ansicht.

## Colors

Ein warmes, einstimmiges Apricot-Umfeld mit einer gebrannten Orange-Stimme und sechs leisen Erdtönen für Kategorien.

### Primary
- **Gebranntes Orange** (action): Haken-Ring und gefüllter Haken, Primär-Button "Erledigt", "Alle nachholen", Dialog-Submit, Plus-Button, aktiver Tab, eingeschalteter Schalter. Außerdem `accent-color` und `caret-color`.
- **Tiefes Orange** (action-strong): Hover des Primär-Buttons, Text auf getönten Buttons, Links, Fokusring (3px, Abstand 2px).
- **Apricot-Hauch** (action-tint): Fläche der sekundären, getönten Buttons (Überspringen, Bearbeiten, Verschieben, Timer, Dialog-Schließen), Hover der leisen Buttons, ruhige Fläche des deaktivierten Primär-Buttons, Grund der Wortmarke.
- **Dichter Apricot-Hauch** (action-tint-hover): Hover des getönten Timer-Buttons; eine Stufe dichter als der Hauch, nie als Ruhefläche.
- **Auf Aktion** (on-action): Schrift und Icons auf Orange.

### Secondary
- **Kategoriemarken** (mark-moss, mark-slate, mark-heather, mark-ochre, mark-sage, mark-walnut): kleine Quadrate (0.625rem, Ecke 0.2rem) vor dem Kategorienamen. Kategorien speichern keine Farbe; der Name wird per FNV-1a-Hash stabil auf eine der sechs Marken abgebildet, damit sich auch häufige Namen über alle sechs verteilen.

### Neutral
- **Apricot-Grund** (ground): Seitenhintergrund, Scrollbar-Spur, Hover im Filtermenü.
- **Tiefer Apricot** (ground-deep): eingelassene Fläche des Nachholen-Panels, Spur der Segmentwahl und Spur aller Fortschrittsbalken.
- **Kartenweiß** (surface): Karten, Leerzustände, Tab-Leiste, Dialoge, Menüs, gewähltes Segment und gewählter Chip, Buttons, die direkt auf dem Grund liegen ("Neu planen", Nachholen-Chips). Halbtransparent (55 %) für Kalendertermine, den Arbeitszeit-Umschalter und Ladeskelette.
- **Apricot-Linie** (line): Haarlinien zwischen Listenzeilen (Nachholen, Kategorien, Kalenderzeilen, Menütrenner), Einrückungslinie im Aufgabenbaum, Feld- und Chiprahmen (1.5px), Tab-Leisten-Kante, Unterstreichung von Text-Links.
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

**The Ink-Choice Rule.** Auswahl ist keine zweite Farbe: gewähltes Segment und gewählter Chip sind Tinte auf Weiß, Fortschritt ist ein flacher Tintenbalken auf tiefem Apricot.

## Typography

**Display Font:** Nunito Variable (mit ui-rounded, system-ui, Segoe UI, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** keine eigene; Ziffern über `font-variant-numeric: tabular-nums`

**Character:** Eine einzige runde, humanistische Familie, selbst gehostet über @fontsource-variable/nunito. Hierarchie entsteht aus Gewicht (400 / 600 / 700 / 800) und Größe, nicht aus einer zweiten Schrift.

### Hierarchy
- **Display** (800, clamp 1.75–2.25rem, 1.1, -0.02em, balanciert): Wochentag und Datum oben auf "Heute" und der Seitentitel jeder Ansicht (dort mit 6vw-Mittelwert). Die Wochenquote im Kalender steht als Zahl noch größer (800, clamp 2.25–3rem, 1).
- **Headline** (800, clamp 1.5–1.875rem, 1.15, -0.015em): Titel der Fokuskarte und der Anmeldekarte.
- **Title** (800, 1.125rem): Abschnittstitel ("Tagesablauf", "Irgendwann heute", Einstellungs-Abschnitte), Titel im Leerzustand, Wortmarke; Dialog- und Boot-Fehlertitel 1.375rem im selben Gewicht.
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

Mobil steht unten eine feste Tab-Leiste (4.25rem plus Safe Area) mit vier Zielen und "Mehr", das ein Popover über der Leiste mit Scrim öffnet; der Body hält per Polsterung Abstand zur Leiste. Ab 56rem wird die Leiste zur oberen Leiste (3.5rem hoch, Innenbreite 64rem), alle Ziele sichtbar, Langnamen statt Kurznamen, kein "Mehr". Der Plus-Button sitzt mobil über der Leiste rechts, auf breiten Schirmen neben der Seitenspalte; Dump, Aufgabenbaum und Habits legen über denselben Plus-Button an. Unter 32rem werden Karten- und Dialogpolster auf 1rem reduziert. Ab 40rem wird das Aktionsmenü vom unteren Blatt zum Popover am Auslöser.

Einträge sind ein Raster aus Zeitspalte (2.75rem), Haken-Spalte (Tap-Breite) und Inhalt; Kalendertermine halten dieselbe Flucht, ohne Haken. Im Aufgabenbaum rückt jede Ebene ein, eine 1px-Apricot-Linie führt zur Elternzeile. Tap-Ziele messen mindestens 2.75rem, große Ziele 3rem, der Primär-Button 3.25rem.

## Elevation & Depth

Weitgehend flach. Tiefe entsteht durch Tonwechsel: weiße Karte auf Apricot, eingelassenes Panel in tieferem Apricot, halbtransparentes Weiß für nicht abhakbare Termine. Ein einziger leiser, warmbrauner Kartenschatten hebt pro Ansicht höchstens eine ruhende Karte: die Fokuskarte auf Heute, die Quotenkarte in der Kalenderwoche, die Anmeldekarte, die Boot-Fehlerkarte. Sonst hebt er nur einen Auswahlzustand (gewählter Tag im Monatsraster). Alles Schwebende (Tab-Leiste, Popover, Filtermenü, Aktionsmenü, Dialog, Toast, Plus-Button) bekommt einen weichen, diffusen Schatten in warmem Braun.

### Shadow Vocabulary
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

Icons stammen aus einer eigenen Strichfamilie (AppIcon): 24px-Raster, Strich 2, runde Enden und Ecken, `currentColor`. Aktive Tabs heben den Strich auf 2.4, der Haken im Primär-Button auf 2.6, im Ring auf 3. In Buttons messen Icons 1.125rem.

## Components

Alle Ansichten setzen sich aus dem gemeinsamen Bausatz in `frontend/src/style.css` zusammen: Seite (`.page`, `.page-header`, `.page-title`, `.page-lead`, `.section-title`, `.count`), Buttons (`.btn` und Varianten), Felder und Auswahl (`.field`, `.input`, `.segmented`, `.chips` / `.chip`), Flächen und Zustände (`.card`, `.empty-state`, `.alert`, `.form-error`, `.skeleton`, `.visually-hidden`). Neue Ansichten komponieren diese Bausteine, statt Buttons und Felder einzeln zu stylen.

### Buttons
Weich, griffig, federnd.
- **Shape:** Pille in Tap-Höhe, Schrift 700, 0.9375rem, Icon 1.125rem links. Nur der große Primär-Button ("Erledigt", Anmelden) hat die Control-Ecke 0.875rem und 3.25rem Höhe.
- **Tinted (Basis):** Apricot-Hauch, Schrift tiefes Orange. Die Standardform jeder Nebenaktion, auch in allen Dialogen.
- **Primary:** Orange voll, weiße Schrift 800. Ein Primär-Button pro Kontext; als Pille für Sammelaktionen ("Alle nachholen") und Dialog-Submit.
- **On Ground:** Weiß auf dem Apricot-Grund, Schrift tiefes Orange ("Neu planen", Nachholen-Chips).
- **Quiet:** ohne Fläche in gedämpfter Tinte; beim Hover Apricot-Hauch und tiefes Orange. Für "Abbrechen", Menüeinträge und Nebenwege.
- **Danger:** Fehlerhauch mit Fehlerrot, nur für die endgültige Löschbestätigung.
- **Icon:** quadratisch in Tap-Größe, ohne Polster.
- **Link:** tiefes Orange, unterstrichen in Apricot-Linie, Tap-Höhe; für Wechsel wie "Passwort vergessen?" und "Konto erstellen" auf der Anmeldung.
- **Hover / Focus:** Primär wird tiefes Orange (160ms, --ease-out); Fokus ist ein 3px-Ring in tiefem Orange.
- **Press:** `scale(0.97)` beim Drücken (90ms), Rückfederung über `--spring` (420ms). Haken drücken auf 0.86, Timer auf 0.92.
- **Disabled:** Nebenbuttons verlieren die Fläche und werden leise Tinte. Ein noch nicht verfügbarer Primär-Button wird ruhig: Apricot-Hauch mit leiser Tinte, Cursor `not-allowed`; während er arbeitet, Cursor `progress`.

### Chips
- **Segmentwahl:** Pillen-Spur in tiefem Apricot (0.25rem Innenabstand), Optionen in gedämpfter Tinte 700; die gewählte ist Weiß mit Tinte und leiser Auflage. Für Modi wie Monat · Woche · Tag.
- **Filter-Chip:** Pille mit 1.5px-Apricot-Linie, gedämpfte Tinte; gewählt Weiß mit Tintenrahmen und Tinte. Im Kalender öffnet ein solcher Chip das Filtermenü (weiß, Control-Ecke, Kartenschatten, Einträge mit Hover in Apricot-Grund).

### Cards / Containers
- **Corner Style:** 1.375rem.
- **Background:** Weiß; Termine 55 % Weiß; Nachholen-Panel tiefer Apricot.
- **Shadow Strategy:** höchstens eine gehobene Karte pro Ansicht (siehe Elevation).
- **Border:** keine; Zeilen in Listenkarten trennt eine Haarlinie (Kategorien, Kalenderzeilen).
- **Internal Padding:** Basis 1rem; Fokus 1.5rem (unten 1rem), Quote 1.5rem, Einträge 0.5–1rem.
- **Einstellungen:** jede Gruppe eine flache Karte mit Abschnittstitel; der Schalter für Benachrichtigungen ist eine Zeile mit kleiner Pillen-Spur (3 × 1.75rem) in Tap-Fläche, aus leise Tinte, an Orange, weißer Daumen federt über.

### Inputs / Fields
- **Style:** Label darüber in gedämpfter Tinte 700, 0.875rem. Feld weiß, 1.5px Apricot-Linie, Ecke 0.875rem, Tap-Höhe, Polster 0.75rem, Schrift 1rem 400; Textflächen mit Rundum-Polster und vertikal ziehbar.
- **Focus:** 3px-Ring in tiefem Orange, Abstand 2px; Caret orange.
- **Error:** Formularfehler als Satz in Fehlerrot 700, 0.9375rem; Ladefehler als Hinweisfläche (Fehlerhauch, Tinte, Kartenecke) mit Wiederholen-Button.
- **Gespeichert:** stille Rückmeldung als gedämpfter Text neben dem Feld (Kategorien, Tagesreflexion), kein Toast.

### Navigation
- **Tab-Leiste:** Weiß, Icon über 0.75rem-Label (700), inaktiv gedämpfte Tinte, aktiv Orange mit kräftigerem Strich. Druck federt. Mehr-Menü als weißes Popover mit Kartenecke und Scrim `rgb(43 29 22 / 18%)`. Ab 56rem oben, Icon neben Label, alle Ziele sichtbar.

### Aktionsmenü
Ein Menü "Aktionen für …" pro Zeile statt verstreuter Buttons. Unter 40rem ein weißes Blatt von unten (oben Kartenecke, Scrim `rgb(43 29 22 / 18%)`), ab 40rem ein Popover am Auslöser (mind. 15rem, Kartenecke); beide mit dem Titel des Eintrags als Überschrift in Tinte. Einträge sind leise Buttons in Tinte mit Icon links. "Löschen" steht zuletzt, durch eine Haarlinie abgesetzt, ebenfalls in Tinte; erst der Bestätigungsdialog zeigt "Ja, löschen" rot.

### Fokuskarte (Signature)
Die eine große Karte oben auf Heute: Titel als Headline, Warum-Satz in Body Large, Metazeile mit Kategoriemarke, Uhrzeit, Minuten und Zielstand, darunter "Erledigt" (Primär), Timer (runder getönter Icon-Button) und getönte Nebenaktionen. Direkt darunter, außerhalb der Karte, die Zeile "Danach" mit dem nächsten Eintrag.

### Eintrag mit Haken-Ring (Signature)
Zeit | Ring | Inhalt. Der Ring ist 1.875rem, 2.5px Orange; erledigt füllt er sich orange und der Haken springt mit `check-pop` (Skalierung von 0.4, --spring) ein, der Titel wird durchgestrichen und gedämpft. Übersprungen: gestrichelter Ring in leiser Tinte. Derselbe Ring trägt den Todo-Dump (Timer neben dem Titel, Erledigtes unter "n erledigt" eingeklappt) und den Aufgabenbaum.

### Aufgabenbaum-Zeile
Weiße Karte je Aufgabe: Einrückungslinie, Chevron zum Auf- und Zuklappen (sonst Platzhalter in Tap-Breite), Haken-Ring, Titel als Button, Metazeile mit Kategoriemarke. Nur Elternaufgaben zeigen Fortschritt als flachen Balken mit Zähler. Rechts der Auslöser des Aktionsmenüs. Beim Ziehen wird das Ziel mit 2px gestrichelter gedämpfter Tinte umrandet.

### Habit-Karte
Weiße, flache Karte: Titel (als Button zum Bearbeiten), Warum-Satz in gedämpfter Tinte, Metazeile mit Kategoriemarke und dem Rhythmus in Klartext. Pausierte Habits gedämpft.

### Kalender
Kopfzeile mit Segmentwahl Monat · Woche · Tag, Vor/Zurück und dem Zeitraum als Titel-Button, der einen Datumswähler öffnet; der Filter ist ein Menü-Chip.
- **Monat:** Raster aus Tagen in Control-Ecke, heute mit 2px-Tintenrahmen innen, gewählt weiß mit Kartenschatten. Unter jeder Zahl ruhige Punkte (0.4375rem): gefüllt für Erledigtes, Ring für Offenes, ein kurzer Strich in leiser Tinte für Termine; eine Legende in Label-Größe erklärt sie.
- **Woche:** Quotenkarte mit großer Zahl ("3 von 12"), Label und flachem Tintenbalken auf tiefem Apricot; darunter Habit-Zeilen mit Haarlinien und eine weiße Karte pro Tag.
- **Tag:** beginnt mit der Tagesreflexion, dann Termine (55 % Weiß), Geplantes, Verlaufszeilen und die Arbeitszeit hinter einem halbtransparenten Umschalter.

### Verlaufszeile
Nur lesend: statt des antippbaren Rings ein kleiner gefüllter Punkt (1.25rem) in gedämpfter Tinte mit weißem Haken; übersprungen gestrichelt in leiser Tinte. Ein Zustand, kein Bedienelement, daher nie orange.

### Fortschrittsbalken
Pillen-Spur in tiefem Apricot (0.625rem in der Quote), Füllung flache Tinte, Breitenwechsel 240ms --ease-out. Gilt für Wochenquote und Elternaufgaben.

### Undo-Toast
Gemeinsame Komponente für Heute und Dump. Tintenfarbene Pille über Tab-Leiste und Plus-Button, weiße Schrift 600, rechts ein weißer Pillen-Button "Rückgängig" in tiefem Orange. Erscheint mit 0.75rem Aufstieg in 240ms.

### Einzelkarte: Anmeldung und Boot-Fehler
Eine ruhige, gehobene weiße Karte mittig auf dem Grund. Anmeldung: Wortmarke (runder Apricot-Hauch mit Tinten-Icon, Name in Title), Headline, gedämpfte Einleitung, Felder, ein einziger voller Primär-Button über die ganze Breite, darunter leise Text-Links. Boot-Fehler: zentriert "Keine Verbindung zum Server" (1.375rem, 800), gedämpfte Erklärung (max. 34ch) und ein Primär-Button zum erneuten Versuch, ohne Rot.

### Lade- und Leerzustände
Skelett aus 55 %-weißen Kartenflächen (Basis 4.25rem; Fokus 13rem, Einträge 4.5rem), pulsierend zwischen voller und halber Deckkraft (1.6s). Leerzustand als weiße Karte, zentriert, fetter Titel plus gedämpfter Satz.

## Do's and Don'ts

### Do:
- **Do** Farben, Ecken, Abstände, Tap-Größen und Bewegung ausschließlich über die Tokens in `frontend/src/style.css` beziehen.
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
- **Don't** Verläufe, harte versetzte Schatten oder schwarze Schatten einsetzen.
- **Don't** Überfälliges rot färben oder als Warnblock oben stapeln; Nachholen ist ein Angebot in tiefem Apricot.
- **Don't** Rot für Löschwege vor der endgültigen Bestätigung verwenden; "Löschen" im Menü ist Tinte.
- **Don't** eine zweite Farbe für Auswahl einführen; gewählt heißt Tinte auf Weiß.
- **Don't** Konfetti oder Spielelemente als Bestätigung zeigen; die Bestätigung ist der gefüllte Ring und der Toast mit Rückgängig.
- **Don't** Überzeilen in Versalien über Titel setzen; Kontext steht in der Metazeile.
