# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Der Projektinhaber und wenige Bekannte. Sie planen damit ihren eigenen Alltag: Aufgaben, Gewohnheiten und längerfristige Ziele. Später ist eine öffentliche Nutzung möglich, aber nicht beschlossen. Registrieren kann sich jede Person mit bestätigter E-Mail-Adresse; die Anmeldung bietet es als Nebenweg an.

Die App ist zugleich ein Lernprojekt für sauberes TypeScript und Architekturentscheidungen.

## Product Purpose

Ein Habit- und Aufgaben-Tracker, der den Alltag nicht als starre Checkliste behandelt. Er verbindet, was jemand erreichen will, mit dem, was er heute tut, und zeigt ehrlich, wie es lief.

Erfolg heißt: Die App wird täglich benutzt, weil sie das Planen leichter macht, nicht weil sie Pflicht ist.

## Positioning

Vier Dinge zusammen, die andere Tracker meist getrennt halten:

- **Ziele und Habits verbunden:** Todos bilden Zielhierarchien; ein Ziel kann ein Habit mit Zeitraum und Sollmenge verlinken, etwa 20 Läufe bis Dezember.
- **Flexible Tagesplanung:** Todos und Habit-Läufe lassen sich verschieben, der Rest des Tages lässt sich mit Vorschau neu planen, Google Kalender ist in beide Richtungen angebunden.
- **Reflexion und Warum:** Todos und Habits tragen ein persönliches Warum; dazu kommen Tagesreflexion, Wochenquote und Perfect Week je Kategorie.
- **Zeit erfassen:** Timer und echte Arbeitszeit stehen neben der geplanten Zeit.

## Operating Context

Vor allem am Handy, als PWA oder Test-APK, häufig unterwegs und in kurzen Momenten: abhaken, Timer starten, verschieben. Der Desktop ergänzt das, etwa für größere Planung im Aufgabenbaum oder Kalender.

Oberflächensprache ist Deutsch.

## Capabilities and Constraints

- Ansichten: Heute, Todo-Dump, Aufgabenbaum, Habits, Kategorien, Verlauf (Tag, Woche, Monat), Kalender, Einstellungen.
- Fachbegriffe: Habit (Gewohnheit mit veränderbarem Zeitplan) und Ausführung (einzelner Lauf eines Habits) sind zu unterscheiden; Ziele und Teilziele sind Todos.
- Technik: Vue 3, NestJS, PostgreSQL; Android über Capacitor als Hülle um die Web-App.
- Offen: ob und wann die App öffentlich wird.

## Evidence on Hand

Es gibt keine Nutzerzahlen, Testimonials oder Fallstudien. Fachliche Dokumentation liegt in `docs/`.

## Product Principles

1. Planung passt sich dem Tag an, nicht umgekehrt.
2. Jede Aufgabe und Gewohnheit darf zeigen, wozu sie dient.
3. Auswertungen sind ehrlich und nachvollziehbar, nicht beschönigend.
4. Häufige Handgriffe gehen am Handy schnell und mit einer Hand.
