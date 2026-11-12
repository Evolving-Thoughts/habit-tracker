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
  icon-button-timer:
    backgroundColor: "{colors.action-tint}"
    textColor: "{colors.action-strong}"
    rounded: "50%"
    size: "{spacing.tap}"
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
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "{spacing.tap}"
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

<!-- Aufgenommen aus der ausgelieferten Ansicht "Heute" und der App-Hülle (Tab-Leiste, Mehr-Menü, Dialoge). Todo-Dump, Aufgabenbaum, Habits, Kategorien, Verlauf, Kalender und Einstellungen tragen noch alte, fest verdrahtete Stile und sind ausdrücklich nicht Teil dieses Systems: Migration ausstehend. -->

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

## Colors

Ein warmes, einstimmiges Apricot-Umfeld mit einer gebrannten Orange-Stimme und sechs leisen Erdtönen für Kategorien.

### Primary
- **Gebranntes Orange** (action): Haken-Ring und gefüllter Haken, Primär-Button "Erledigt", "Alle nachholen", Dialog-Submit, Plus-Button, aktiver Tab. Außerdem `accent-color` und `caret-color`.
- **Tiefes Orange** (action-strong): Hover des Primär-Buttons, Text auf getönten Buttons, Links, Fokusring (3px, Abstand 2px).
- **Apricot-Hauch** (action-tint): Fläche der sekundären, getönten Buttons (Überspringen, Bearbeiten, Verschieben, Timer, Dialog-Schließen).
- **Auf Aktion** (on-action): Schrift und Icons auf Orange.

### Secondary
- **Kategoriemarken** (mark-moss, mark-slate, mark-heather, mark-ochre, mark-sage, mark-walnut): kleine Quadrate (0.625rem, Ecke 0.2rem) vor dem Kategorienamen. Kategorien speichern keine Farbe; der Name wird per Hash stabil auf eine der sechs Marken abgebildet.

### Neutral
- **Apricot-Grund** (ground): Seitenhintergrund, Scrollbar-Spur.
- **Tiefer Apricot** (ground-deep): eingelassene Fläche des Nachholen-Panels.
- **Kartenweiß** (surface): Karten, Tab-Leiste, Dialoge, Buttons, die direkt auf dem Grund liegen ("Neu planen", Nachholen-Chips). Halbtransparent (55 %) für Kalendertermine und Ladeskelette.
- **Apricot-Linie** (line): Haarlinien zwischen Nachholen-Zeilen, Feldrahmen (1.5px), Tab-Leisten-Kante.
- **Warme Tinte** (ink): Fließtext, Titel, die Jetzt-Linie, der Undo-Toast.
- **Gedämpfte Tinte** (ink-muted): Metazeilen, Zeiten, Fortschritt, inaktive Tabs, erledigte Titel.
- **Leise Tinte** (ink-soft): nur deaktivierte und laufende Zustände, gestrichelter Ring für Übersprungenes.
- **Fehlerrot / Fehlerhauch** (danger, danger-tint): ausschließlich echte Fehlermeldungen, nie für Überfälliges.
- **Erfolgsgrün** (success): als Token vorhanden, in der ausgelieferten Ansicht nicht sichtbar verwendet.

### Named Rules
**The Orange-Means-Tap Rule.** Die Aktionsfarbe steht nur auf Antippbarem. Statusanzeigen, Linien, Überschriften und Kategorien sind nie orange; die Jetzt-Linie ist Tinte.

**The Warm-Ink Rule.** Es gibt kein neutrales Grau. Jeder Text- und Linienton ist ein warmes Braun aus der Tinten- oder Apricot-Familie.

**The No-Guilt Rule.** Liegengebliebenes liegt in tiefem Apricot, nicht in Rot. Rot gehört Fehlern des Systems, nicht Versäumnissen der Person.

## Typography

**Display Font:** Nunito Variable (mit ui-rounded, system-ui, Segoe UI, sans-serif)
**Body Font:** Nunito Variable
**Label/Mono Font:** keine eigene; Ziffern über `font-variant-numeric: tabular-nums`

**Character:** Eine einzige runde, humanistische Familie, selbst gehostet über @fontsource-variable/nunito. Hierarchie entsteht aus Gewicht (400 / 600 / 700 / 800) und Größe, nicht aus einer zweiten Schrift.

### Hierarchy
- **Display** (800, clamp 1.75–2.25rem, 1.1, -0.02em, balanciert): Wochentag und Datum oben auf "Heute".
- **Headline** (800, clamp 1.5–1.875rem, 1.15, -0.015em): Titel der Fokuskarte.
- **Title** (800, 1.125rem): Abschnittstitel ("Tagesablauf", "Irgendwann heute"); Dialogtitel 1.375rem, Leerzustand 1.25rem im selben Gewicht.
- **Body Large** (1.0625rem): Warum-Satz der Fokuskarte (max. 60ch), Eintragstitel (700), Primär-Button (800).
- **Body** (400, 1rem, 1.45): Fließtext; Fortschritt und "Danach" in 600.
- **Label** (700, 0.875rem, tabellarische Ziffern): Uhrzeiten, Metazeilen, "Jetzt". Metazeile der Fokuskarte 0.9375rem.
- **Nav Label** (700, 0.75rem): Tab-Beschriftung mobil; ab 56rem 0.9375rem.

### Named Rules
**The Tabular-Time Rule.** Jede Uhrzeit, Minutenangabe und Zählung ("10/35 Min.", "1 von 4") setzt tabellarische Ziffern.

**The Weight-Not-Case Rule.** Betonung kommt über 700/800, nie über Versalien oder Sperrung. Inline-Labels wie "Danach" stehen fett im Satz, nicht als Überzeile.

## Layout

Eine zentrierte Spalte: `min(100% - 2rem, 46rem)`. Abstandsraster in sechs Stufen (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2rem); Karten im Abstand 0.5rem, Abschnitte 2rem, Fokus zu Nachholen 1.5rem.

Mobil steht unten eine feste Tab-Leiste (4.25rem plus Safe Area) mit vier Zielen und "Mehr", das ein Popover über der Leiste mit Scrim öffnet; der Body hält per Polsterung Abstand zur Leiste. Ab 56rem wird die Leiste zur oberen Leiste (3.5rem hoch, Innenbreite 64rem), alle Ziele sichtbar, Langnamen statt Kurznamen, kein "Mehr". Der Plus-Button sitzt mobil über der Leiste rechts, auf breiten Schirmen neben der Seitenspalte. Unter 32rem werden Karten- und Dialogpolster auf 1rem reduziert.

Einträge sind ein Raster aus Zeitspalte (2.75rem), Haken-Spalte (Tap-Breite) und Inhalt; Kalendertermine halten dieselbe Flucht, ohne Haken. Tap-Ziele messen mindestens 2.75rem, große Ziele 3rem, der Primär-Button 3.25rem.

## Elevation & Depth

Weitgehend flach. Tiefe entsteht durch Tonwechsel: weiße Karte auf Apricot, eingelassenes Panel in tieferem Apricot, halbtransparentes Weiß für nicht abhakbare Termine. Ein einziger leiser, warmbrauner Kartenschatten hebt nur die Fokuskarte; alles Schwebende (Tab-Leiste, Popover, Dialog, Toast, Plus-Button) bekommt einen weichen, diffusen Schatten in warmem Braun.

### Shadow Vocabulary
- **Kartenschatten** (`box-shadow: 0 1px 2px rgb(107 50 18 / 6%), 0 6px 18px rgb(107 50 18 / 7%)`): nur die Fokuskarte; Basis des Mehr-Popovers.
- **Leistenkante** (`box-shadow: 0 -1px 0 var(--color-line), 0 -8px 24px rgb(107 50 18 / 8%)`): mobile Tab-Leiste; oben nur `0 1px 0 var(--color-line)`.
- **Popover** (`box-shadow: var(--shadow-card), 0 12px 32px rgb(107 50 18 / 16%)`): Mehr-Menü.
- **Dialog** (`box-shadow: 0 12px 40px rgb(43 29 22 / 22%)`, Backdrop `rgb(43 29 22 / 40%)`).
- **Toast** (`box-shadow: 0 8px 24px rgb(43 29 22 / 30%)`).
- **Plus-Button** (`box-shadow: 0 4px 14px rgb(154 51 10 / 28%)`).

### Named Rules
**The One-Lifted-Card Rule.** Auf einer Seite trägt nur die eine Fokuskarte den Kartenschatten. Listenkarten liegen flach.

**The Warm-Shadow Rule.** Schatten sind weich, diffus und warmbraun getönt, nie schwarz, nie hart versetzt.

## Shapes

Großzügig gerundet in drei Stufen: Karten, Panels, Dialoge und Popover 1.375rem; Primär-Buttons, Felder und Hinweise 0.875rem; sekundäre Buttons, Chips und Toast als Pille. Runde Icon-Buttons (Timer, Dialog-Schließen, Haken) sind Kreise in Tap-Größe. Der Plus-Button ist ein weiches Quadrat (3.5rem, Ecke 1.125rem). Rahmen kommen fast nicht vor; nur Felder tragen eine 1.5px-Apricot-Linie, Nachholen-Zeilen trennt eine 1px-Haarlinie.

Icons stammen aus einer eigenen Strichfamilie (AppIcon): 24px-Raster, Strich 2, runde Enden und Ecken, `currentColor`. Aktive Tabs heben den Strich auf 2.4, der Haken im Primär-Button auf 2.6, im Ring auf 3.

## Components

### Buttons
Weich, griffig, federnd.
- **Shape:** Primär 0.875rem, alle übrigen als Pille.
- **Primary:** Orange voll, weiße Schrift 800, 1.0625rem, 3.25rem hoch, Icon links. Ein Primär-Button pro Kontext ("Erledigt").
- **Primary Pill:** Orange, Tap-Höhe; für Sammelaktionen ("Alle nachholen") und Dialog-Submit.
- **Tinted (Sekundär):** Apricot-Hauch, Schrift tiefes Orange 700. Die Standardform jeder Nebenaktion, auch in allen Dialogen.
- **On Ground:** Weiß auf dem Apricot-Grund, Schrift tiefes Orange ("Neu planen", Nachholen-Chips).
- **Hover / Focus:** Primär wird tiefes Orange (160ms, --ease-out); Fokus ist ein 3px-Ring in tiefem Orange.
- **Press:** `scale(0.97)` beim Drücken (90ms), Rückfederung über `--spring` (420ms). Haken drücken auf 0.86, Timer auf 0.92.
- **Disabled / läuft:** leise Tinte, Cursor `progress`.

### Cards / Containers
- **Corner Style:** 1.375rem.
- **Background:** Weiß; Termine 55 % Weiß; Nachholen-Panel tiefer Apricot.
- **Shadow Strategy:** nur die Fokuskarte (siehe Elevation).
- **Border:** keine.
- **Internal Padding:** Fokus 1.5rem (unten 1rem), Einträge 0.5–1rem.

### Inputs / Fields
- **Style:** Weiß, 1.5px Apricot-Linie, Ecke 0.875rem, Tap-Höhe, Polster 0.75rem.
- **Focus:** 3px-Ring in tiefem Orange, Abstand 2px; Caret orange.

### Navigation
- **Tab-Leiste:** Weiß, Icon über 0.75rem-Label (700), inaktiv gedämpfte Tinte, aktiv Orange mit kräftigerem Strich. Druck federt. Mehr-Menü als weißes Popover mit Kartenecke und Scrim `rgb(43 29 22 / 18%)`. Ab 56rem oben, Icon neben Label, alle Ziele sichtbar.

### Fokuskarte (Signature)
Die eine große Karte oben: Titel als Headline, Warum-Satz in Body Large, Metazeile mit Kategoriemarke, Uhrzeit, Minuten und Zielstand, darunter "Erledigt" (Primär), Timer (runder getönter Icon-Button) und getönte Nebenaktionen. Direkt darunter, außerhalb der Karte, die Zeile "Danach" mit dem nächsten Eintrag.

### Eintrag mit Haken-Ring (Signature)
Zeit | Ring | Inhalt. Der Ring ist 1.875rem, 2.5px Orange; erledigt füllt er sich orange und der Haken springt mit `check-pop` (Skalierung von 0.4, --spring) ein, der Titel wird durchgestrichen und gedämpft. Übersprungen: gestrichelter Ring in leiser Tinte.

### Zeitachse mit Jetzt-Linie
Termine und Einträge in Zeitfolge; Vergangenes auf 80 % Deckkraft. Die Jetzt-Linie ist "Jetzt" in Label-Stil plus 2px-Linie in Tinte.

### Undo-Toast
Tintenfarbene Pille über Tab-Leiste und Plus-Button, weiße Schrift 600, rechts ein weißer Pillen-Button "Rückgängig" in tiefem Orange. Erscheint mit 0.75rem Aufstieg in 240ms.

### Lade- und Leerzustände
Skelett aus 55 %-weißen Kartenflächen (Fokus 13rem, Einträge 4.5rem), pulsierend zwischen voller und halber Deckkraft. Leerzustand als weiße Karte, zentriert, Title plus gedämpfter Satz.

## Do's and Don'ts

### Do:
- **Do** Farben, Ecken, Abstände, Tap-Größen und Bewegung ausschließlich über die Tokens in `frontend/src/style.css` beziehen.
- **Do** jede Nebenaktion als getönte Pille (action-tint, Schrift action-strong) bauen und pro Kontext höchstens einen orange gefüllten Primär-Button setzen.
- **Do** antippbare Elemente mit `--press` drücken und über `--spring` (420ms) zurückfedern lassen.
- **Do** Tap-Ziele von mindestens 2.75rem halten, auch auf dem Desktop.
- **Do** Kategorien mit `categoryMark()` als kleine Marke zeigen, nie als eingefärbte Fläche.
- **Do** Icons aus der Strichfamilie in AppIcon ergänzen (24px, Strich 2, runde Enden).
- **Do** Uhrzeiten und Zählungen mit tabellarischen Ziffern setzen.

### Don't:
- **Don't** Orange auf nicht antippbare Elemente legen (Überschriften, Linien, Status, Kategorien).
- **Don't** Grau verwenden; Text und Linien bleiben in der warmen Tinten- und Apricot-Familie.
- **Don't** Verläufe, harte versetzte Schatten oder schwarze Schatten einsetzen.
- **Don't** Überfälliges rot färben oder als Warnblock oben stapeln; Nachholen ist ein Angebot in tiefem Apricot.
- **Don't** Konfetti oder Spielelemente als Bestätigung zeigen; die Bestätigung ist der gefüllte Ring und der Toast mit Rückgängig.
- **Don't** Überzeilen in Versalien über Titel setzen; Kontext steht in der Metazeile.
- **Don't** die alten Stile aus Todo-Dump, Aufgabenbaum, Habits, Kategorien, Verlauf, Kalender oder Einstellungen als Vorlage nehmen; sie sind zur Migration vorgemerkt.
