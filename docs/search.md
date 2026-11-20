# Search

The command menu (`keyboard.md` › Search in titles and texts) finds, besides
views and commands, entries by title and notes by their text. Everything
lives in `backend/src/search/`.

## `GET /search?q=`

`q` is trimmed and its inner whitespace collapsed; it must then have 2 to 100
characters (400 otherwise). It is matched as one phrase, anywhere in the
text, ignoring case and, where the database has the `unaccent` extension,
accents and "ß"/"ss" ("uberarbeiten" finds "Überarbeiten"). `%`, `_` and `\`
are taken literally. Only the signed-in person's rows are read; soft-deleted
todos and dailies and the runs of a deleted daily are left out.

```json
{
  "query": "kapitel",
  "titles": [
    {
      "kind": "quest",
      "id": 7,
      "title": "Kapitel 2 überarbeiten",
      "highlight": { "start": 0, "end": 7 },
      "done": false,
      "scheduledDate": "2026-11-18",
      "campaign": { "id": 3, "title": "Buch", "color": "navy", "icon": "book" }
    }
  ],
  "texts": [
    {
      "kind": "quest-notes",
      "id": 7,
      "label": "Notiz zu Kapitel 2 überarbeiten",
      "snippet": "… erst das Kapitel über Drachen kürzen …",
      "highlight": { "start": 15, "end": 22 },
      "date": null,
      "habitId": null
    }
  ]
}
```

- **titles** (at most 8): campaigns (`kind: "campaign"`, whether done or
  not; `campaign` names itself), quests (`"quest"`, open ones and those
  completed in the last 30 days) and dailies (`"daily"`). Which top-level
  todo is a campaign, and which campaign a quest or daily works towards,
  `TodoAncestry` decides, as everywhere else. Order: a match at the start of
  a word first, open before done, then campaign, quest, daily.
- **texts** (at most 8, newest first): `quest-notes` (`id` is the todo),
  `run-notes` (`id` the occurrence, `habitId` its daily, `date` the run's
  day: resolved, else moved, else scheduled), `reflection` (`date` the day)
  and `week-review` (`date` the Monday; the label names the answer that
  holds the match). `snippet` is about 80 characters around the match, cut
  at word boundaries with "…"; `highlight` is the match inside it (null when
  it cannot be placed, e.g. a match that only exists across two blocks).
- `label` is ready to show ("Reflexion vom 18. Nov.", "Wochenrückblick
  16.–22. Nov. · Was ändere ich?"); a date outside the current year carries
  its year. `highlight` offsets are UTF-16 offsets, as JavaScript counts.

There is no rate limit beyond the session: the endpoint only reads, and the
menu waits 200 ms after typing and aborts outdated requests.

## How notes are searched

Notes are stored as the editor's JSON document (`quest-notes.md`), never as
HTML, so there are no tags to strip. The query reads their text straight
from the `jsonb`: `jsonb_path_query(notes, 'strict $.**.text', '{}', true)`
yields every text node in document order (silently, so a malformed row
cannot fail the search), and two joins of them are compared, one without
separator (a word split by a mark, "**Kap**itel", stays one word) and one
with spaces (words of adjacent blocks stay apart). No copy of the text is
stored, so nothing has to be kept in step with the notes; with a handful of
users a sequential scan per search is cheap. Should it ever not be, a
trigram index on a stored plain-text column is the next step.

The service then rebuilds the plain text in TypeScript (`notesPlainText`:
blocks and line breaks become spaces, marks are joined), finds the match
with the same folding (`findMatch`: per character NFD without diacritics,
"ß" as "ss", lower case, with a map back to the original offsets) and cuts
the snippet (`snippetAround`). Reflections and weekly-review answers are
plain text and go through the same helpers. The helpers are unit-tested in
`search-text.spec.ts`; `test/search.e2e-spec.ts` covers the endpoint.

## `unaccent`

Migration `SearchUnaccent` runs `CREATE EXTENSION IF NOT EXISTS unaccent`
inside a `DO` block that only logs a notice when the extension cannot be
created (no rights, not installed). The service checks `pg_extension` once
and compares `lower(unaccent(x))` when it is there, `lower(x)` otherwise.
The official PostgreSQL images ship the extension.
