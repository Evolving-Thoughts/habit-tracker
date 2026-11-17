# Notes of a quest

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
- Dailies have no notes.

## Rules

- `backend/src/todos/todo-notes.ts` (`cleanNotes`) is the one definition of what
  a notes document may contain. Unknown nodes, marks and attributes are dropped;
  a link is kept only with an `http(s)` or `mailto` target. A document without
  any text is stored as `null`. Anything that is not a document, or is larger
  than `NOTES_MAX_LENGTH`, is rejected with 400.
- What the toolbar of `RichTextEditor.vue` offers and what `cleanNotes` keeps
  belong together: a new format needs both, otherwise it is lost on saving.
- Notes belong to the owner of the todo like everything else; the endpoints
  answer 404 for a todo of another user.

## Frontend

- `RichTextEditor.vue` is the editor: a block-type select, a toolbar (one tab
  stop, arrow keys move within it) and a row for entering a link. Markdown
  shortcuts work while typing (`# `, `- `, `[ ] `, `> `, ` ``` `). Escape leaves
  the field (Tab indents lists); Ctrl+Enter is left to the view around it. It is
  loaded lazily, as its own chunk, when notes are shown.
- `QuestNotes.vue` binds it to one todo: it loads the notes and saves them by
  itself 800 ms after the last change, and at once when the view is left or the
  app goes into the background. A failed save keeps the text and offers
  "Erneut speichern". There is no save button, also inside the edit dialogs:
  "Abbrechen" there does not undo notes.
- Shown in the Fokus-Modus (for quests), in the edit dialog of a quest
  (`PlannerItemEditor.vue`) and in the edit dialog of the Questlog.
