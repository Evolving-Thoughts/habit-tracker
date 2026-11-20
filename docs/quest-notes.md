# Notes of a quest and of a daily's run

## Model

A todo can carry rich-text notes: headings, bold/italic/strike/underline,
inline code, links, bullet, numbered and check lists, quotes, code blocks and
dividers.

- They are stored as the editor's own document (Tiptap/ProseMirror JSON) in
  `todos.notes` (`jsonb`, nullable). The server never renders them, so there is
  no HTML to sanitise anywhere.
- The column is `select: false`. Lists of todos, the hierarchy and the day
  planner never carry notes; they are read and written only through
  `GET /todos/:id/notes` and `PUT /todos/:id/notes` (`{ notes: document | null }`).
- A single run of a daily (an occurrence) has notes of its own, the same
  document in `habit_occurrences.notes` (`jsonb`, nullable, `select: false`;
  migration `DailyCampaignAndRunNotes`): `GET /habit-occurrences/:id/notes`
  and `PUT /habit-occurrences/:id/notes`, same body and answer
  (`OccurrenceNotesService`). Ownership goes through the run's daily
  (`ownedOccurrences`); a run of another user, of a deleted daily or one that
  does not exist is 404. A run the calendar only foresees has no row yet and
  so no notes. The daily itself has none.

## Rules

- `backend/src/todos/todo-notes.ts` (`cleanNotes`) is the one definition of what
  a notes document may contain. Unknown nodes, marks and attributes are dropped;
  a link is kept only with an `http(s)` or `mailto` target. A document without
  any text is stored as `null`. Anything that is not a document, or is larger
  than `NOTES_MAX_LENGTH`, is rejected with 400.
- What the toolbar of `RichTextEditor.vue` offers and what `cleanNotes` keeps
  belong together: a new format needs both, otherwise it is lost on saving.
- Notes belong to the owner of the todo or run like everything else; the
  endpoints answer 404 for one of another user. Both kinds go through the
  same `cleanNotes` and the same DTO (`SetNotesDto`).

## Frontend

- `RichTextEditor.vue` is the editor: a block-type select, a toolbar (one tab
  stop, arrow keys move within it) and a row for entering a link. Markdown
  shortcuts work while typing (`# `, `- `, `[ ] `, `> `, ` ``` `). Escape leaves
  the field (Tab indents lists); Ctrl+Enter is left to the view around it. It is
  loaded lazily, as its own chunk, when notes are shown.
- `QuestNotes.vue` binds it to one target, `{ kind: "todo" | "occurrence", id }`
  (`api/todo-notes.api.ts`): it loads the notes and saves them by
  itself 800 ms after the last change, and at once when the view is left or the
  app goes into the background. A failed save keeps the text and offers
  "Erneut speichern". There is no save button, also inside the edit dialogs:
  "Abbrechen" there does not undo notes.
- Shown in the Fokus-Modus (a quest's, or the run's when the current item is
  a daily run, titled "Notizen zu diesem Lauf"), in the edit dialog of a quest
  (`PlannerItemEditor.vue`, also from the Questlog) and in the edit dialog of
  a daily when it was opened from a stored run (Heute, Kalender; the Dailies
  view passes today's run where there is one).
