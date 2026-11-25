# Habit-Tracker: Hinweise für Claude

## Änderungen an der Oberfläche

Gilt für neue Bildschirme und jede sichtbare Änderung, nicht für reine Logik, Tests oder Tippfehler.

1. Nutze den Skill `impeccable` (`.claude/skills/impeccable`). PRODUCT.md und DESIGN.md gehen jedem eigenen Geschmack vor. DESIGN.md ist sehr lang: Lies den Überblick, die benannten Regeln und die Abschnitte der Komponenten, die der Bildschirm nutzt, nicht jedes Mal das ganze Dokument.
2. Bei einem neuen Bildschirm oder Ablauf zuerst `shape`: Welche Entscheidung trifft die Person hier, welche Zustände gibt es (erster Start, leer, lädt, Fehler, sehr viel Inhalt), was ist die eine Hauptaktion. Erst dann Code.
3. Nimm die vorhandenen Komponenten und Tokens aus DESIGN.md und `frontend/src/style.css`. Eine neue Komponente nur, wenn keine passt, und dann in DESIGN.md nachtragen.
4. Lies vor jeder Änderung an der Oberfläche `reference/craft-floor.md` des Skills.
5. Fertig ist es erst nach dem Anschauen im Browser: bei 375 px und bei Desktop-Breite, hell und dunkel, jeder betroffene Zustand. Behebe, was ein Blick zeigt, gesammelt und schau dann noch einmal hin.
6. Zum Schluss `critique` und `audit` auf den geänderten Bildschirm. Was davon offen bleibt, nennst du im Abschluss.
