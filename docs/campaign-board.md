# Kampagnen-Board: the board of a campaign

## Model

Every campaign (a top-level todo, see `todo-hierarchy.md`) can be shown as a
Kanban board of its quests. The columns are derived, never stored:

- **To-Do**: open, no day (`scheduledDate` null), not in progress.
- **Geplant**: open, has a day, not in progress.
- **In Arbeit**: open and in progress (below).
- **Erledigt**: completed.

Three fields on `todos` hold what cannot be derived:

- `setAsideAt` (timestamptz, null): when the quest was last put back out of
  In Arbeit. Only work after it counts. Reopening a completed quest sets it
  too (`reopen`), so the quest is not in progress until it is worked on
  again.
- `startedAt` (timestamptz, null): when the user last took the quest into
  In Arbeit by hand (`POST /todos/:id/start-work`). It counts like work, so
  several quests can be in progress at once without a stopwatch.
- `blocked` (boolean, default false): the user's "Geblockt" marker. Starting
  or resuming a stopwatch on the quest clears it, and so does completing it,
  each in the same transaction. A completed quest cannot be blocked (409).

Migration `1797100000000-KanbanSetAside` adds all three.

## In Arbeit

An open quest is in progress when

- a running or paused stopwatch is attached to it, or
- it has a work log whose `endedAt` is after `setAsideAt`, or any work log at
  all while `setAsideAt` is null, or
- it was taken into In Arbeit by hand (`startedAt`) after `setAsideAt`, or at
  any time while `setAsideAt` is null.

A log that ends exactly at `setAsideAt` does not count: it is the stopwatch
the set-aside itself stopped. A log entered later by hand counts only if it
ends after the set-aside.

The rule is one pure function, `isInProgress` in
`backend/src/todos/campaign-board.ts`. `inProgressTodoIds` beside it answers
it for the whole hierarchy with two queries (open stopwatches, and the latest
`endedAt` per todo), not one per todo.

## Moving a quest

Every write that moves a quest between the columns is a pure transition
beside `isInProgress` in `campaign-board.ts`: it takes the quest's board
fields (and `now`) and returns the fields it changes, or the refusal
`{ refused: 'completed' }`.

- `setAside(quest, blocked, now)`: `setAsideAt` now, `blocked` as given.
- `takeIntoWork(quest, now)`: `startedAt` now, lifts "Geblockt".
- `resumeWork(quest)`: a stopwatch started or resumed lifts "Geblockt".
- `complete(quest)`: lifts "Geblockt".
- `reopen(quest, now)`: `setAsideAt` now, for a quest that was completed.
- `markBlocked(quest, blocked)`: the marker by hand; `quest.completed` is
  the completion the quest will have after the same change.

`setAside`, `takeIntoWork` and `markBlocked` refuse a completed quest; the
others cannot be refused. "Geblockt" ends in one place (`liftBlocked`).

`backend/src/todos/quest-commands.ts` applies and stores them, a refusal
as a 409: `saveQuest` (completion, reopening and the marker of
`PATCH /todos/:id`, also for the Google sync), `setQuestAside` (also ends
the stopwatch through `releaseTimers`), `takeQuestIntoWork` and
`resumeQuestWork` (called by `TimersService` on start and resume; it writes
only `blocked`). Callers hold the per-user unit of work.

## API

- `TodoResponseDto` carries `blocked: boolean` and `setAsideAt: string | null`
  (ISO) on every todo response.
- `GET /todos/hierarchy` adds `inProgress: boolean` to each todo.
- `POST /todos/:id/set-aside` with `{ blocked: boolean }` sets `setAsideAt` to
  now and `blocked` as sent, and stops a running or paused stopwatch on the
  quest (`releaseTimers`; its work stays logged). It answers the updated todo
  response. A completed quest is a 409, someone else's todo a 404 and a body
  without a boolean `blocked` (or with other fields) a 400. It runs in the
  per-user unit of work like every todo write.
- `POST /todos/:id/start-work` (empty body) sets `startedAt` to now and
  clears `blocked`; no stopwatch starts. A completed quest is a 409, someone
  else's todo a 404.
- `PATCH /todos/:id` accepts `blocked: boolean` to mark or unmark a quest.

## Frontend

- `utils/campaign-board.ts` holds the pure rules: the column of a quest
  (`columnOf`), which quests are cards (`campaignCards`: quests of the
  campaign without children), the order per column, what a drop does
  (`dropAction(from, to)`) and what a whole move means (`planBoardMove`, below).
- `CampaignBoard.vue` (in the campaign detail of `CampaignsView.vue`, behind
  the choice "Liste · Board", remembered per device as `campaign:view`) and
  `CampaignBoardColumn.vue` draw it. A drop on Geplant asks for the day, on
  Erledigt completes with the undo toast, on To-Do removes the day, on In
  Arbeit takes the quest into work by hand (`start-work`). Out of In Arbeit a dialog asks "Als geblockt markieren?";
  either answer calls `POST /todos/:id/set-aside`, closing it leaves the card.
  The same steps are in each card's menu. A quest whose stopwatch runs shows
  in In Arbeit at once; when the stopwatch ends the board emits `changed`
  (like a quick add), the view reloads, and the server says whether it
  stays.
- Quick add on To-Do and Geplant (`QuickAddQuest` with `parent`) creates the
  quest below the campaign with its category; in Geplant for today.
- On a phone the board shares the Plan's pieces: `.snap-board`,
  `ColumnChips` and `useSnapColumns`. A card carried to within 40px of the
  screen edge brings exactly the next column, and again only after it left
  the edge or stayed 700ms. SortableJS's own gliding is switched off for
  snap boards (`scrollFn` in `useSortable`).
- Several cards move together. `CampaignBoard` keeps the marked todo ids (a
  `Set`, pruned when a card leaves the board; done cards stay markable).
  `CampaignBoardColumn` marks in a capture-phase click handler: Ctrl/Meta
  plus click, or, while something is marked, a plain click from a touch
  press (`pointerType` of the `pointerdown`, not the viewport); the card's
  own controls keep their click, the title counts as the card. A long touch
  press released without moving comes from `useSortable`'s `onHold` (held
  in `onChoose`, let go in `onUnchoose` without `onStart`; the click that
  follows is swallowed via `noteDragEnd`). A drop of a marked card builds
  one step per marked card from its own `dropAction` (cards already in the
  target are skipped), asks "Als geblockt markieren?" once if any step sets
  aside and the day once if any step plans, then writes the steps one after
  another through the single-card paths (`write`, `complete`). Every card
  shows in its new column at once; the status line then says how many
  landed (`movedGroupLine`, via `landedLine`). No answer, no write. The
  marks clear when the group's writes start (a marked card moved alone: at
  once), with "Auswahl aufheben" and with Escape. Keyboard users have no
  multi-select yet.
- Every move, single or group, by drop, menu or key, is planned by
  `planBoardMove(request, answers, now)`: the request is the drop (card, target
  column, the cards and marked ids at that moment), a menu step (target
  column, maybe a day) or "Zurückstellen …". It answers null (nothing
  moves), the next question with the quests it is about (blocked first,
  then the day; each only while a step still waits for it), or the finished
  plan: per card its step (`complete`, or `move`/`start` with its ordered
  `BoardWrite`s), the changes shown at once, the group's status line and
  when the marks clear. `CampaignBoard` keeps the dialogs, the focus, the
  marks and the runner that sends the planned writes.
