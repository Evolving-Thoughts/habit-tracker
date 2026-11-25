# Todo hierarchy — T2 and T3 reference implementation

## Scope and UI decision

The selected UI is **A: an expandable tree list**; it now lives in the
**Kampagnen** view (`CampaignsView.vue`). The other views are Heute, Fokus,
Kalender, Plan, Questlog, Dailies, Wochenrückblick and Einstellungen. Every Todo,
including a parent, retains its own completion checkbox, schedule, duration,
optional time of day (see `day-order.md`) and timer eligibility. There is no separate Goal entity.

T2 delivers hierarchy creation, progress, independent completion, atomic moves,
root moves and timer/planner integration. T3 adds editing and confirmed subtree
soft-deletion. The other quest editors use the same deletion-preview contract.
No sibling sorting, archive/restore, Habit contribution or new time-accounting
rules are introduced. The existing one-active-timer-per-user rule remains in place.

## Learning guide: understand before copying

1. Sketch a tree containing an explicitly completed parent with open children.
   Explain why its checkbox and subtree progress can disagree without being a bug.
2. Read `todo-hierarchy.ts` (`TodoTree`). Work out the parent-plus-five-children
   example on paper: the denominator is five, the children only; the parent's
   own completion is not progress. Then add durations to every node.
3. Trace `TodosService.update`: the ancestor-chain query, `assertCanPlace`,
   own-property changes and the timer release on completion. Identify the
   invariant protected by each check before reading the corresponding test.
4. Try implementing an iterative postorder traversal independently. Compare it
   with the reference only after it handles a deep chain and a branching tree.
5. Read the deletion preview and predict what happens if another device adds a
   child after the dialog opens. Reproduce the HTTP 409 in the browser tests.

The complete runnable reference is the repository source, not the disposable UI
prototype. The main files are the Todo entity/DTOs, `TodosService`,
`todo-hierarchy.ts` (pure tree rules), `todo-hierarchy.queries.ts` (recursive
ancestor/subtree reads), `CampaignsView.vue`, `useTodoDeletion.ts`,
`TodoDeletionSummary.vue` and their tests.

## Architecture and invariants

### Adjacency list instead of a second domain model

`todos.parentId` is nullable and references `todos.id` with a non-cascading,
restricting foreign key. Existing records have a null parent and remain roots.
Ownership and live-parent checks are enforced on the server. Requests cannot
point to themselves, descendants, another user's Todos or soft-deleted parents.
The frontend's filtered move choices are convenience, not authorization.

Re-parenting goes through the ordinary `PATCH /todos/:id` with `parentId`
(a positive id or null): the server checks the parent's live ancestor chain
(no cycle, no self, no descendant, owned and live), moves the whole subtree
and, when a campaign goes below another todo, clears its weekly goal, colour
and icon (`NO_CAMPAIGN_FIELDS`). The frontend offers it in three places with
one picker (`ParentPicker.vue` on `utils/parent-choice.ts`): "Gehört zu" in
the quest editor and in "Neue Quest", "In Kampagne verschieben …" in every
quest card's menu (`CampaignMoveDialog.vue`) and dragging in the Kampagnen
tree. The picker lists campaigns and every open quest below them as a path
("Buch schreiben › Kapitel 2"), never the quest itself or its subtree; typing
a name that does not exist offers "Neue Kampagne „…“ anlegen", which creates a
top-level todo in the colour its title picks (so it is a campaign at once) and
chooses it. Choosing a place shows its reason as the inherited Warum (live,
never copied) and, while the quest has no category, preselects the place's
category or else its campaign's.

### Atomic mutation and concurrency

Every Todo mutation runs in the per-user unit of work (`UserUnitOfWork`), which
locks the owning user row first — the same lock order as timers, habits and push.
Consequently two inverse moves cannot both commit, and a timer duration update
cannot overwrite an older copy of a Todo that was moved concurrently.

A Todo's completion is its own: nothing completes or reopens other nodes.
Adding or reopening a child, or moving an open subtree below a completed parent,
leaves that parent completed with its original `completedAt`, so its entry in
the history stays where it was. The parent's progress shows the open work below
it. Repeated completion preserves the original timestamp. Completing a Todo stops
its timer in the same transaction (see `timers/timer-target.ts`).

Because completing a campaign leaves its quests open, the frontend asks first
when a top-level todo with open todos below it is completed by its ring (or
X): "Kampagne abschließen?", "3 Quests in „Buch“ sind noch offen. Sie bleiben
offen; die Kampagne steht danach unter „Abgeschlossen“." The count is the
server's (`todoCount - doneCount` of its progress); without open todos below
nothing asks. `useCampaignCompletion` and `CampaignCompletionDialog` do this,
through `useTicks` (the one place for ring, undo toast and this question), in
the Kampagnen view (the tree is at hand: "Abschließen" on a campaign's tile
once all its quests are done, else "Kampagne abschließen" in the tile's "…";
"Abschließen" on its detail card, and "Kampagne abschließen" in the card's "…"), Heute
and the Plan's X (they read `GET /todos/hierarchy` once, only for a row that
is itself a campaign; a failed read asks nothing). The Questlog lists no
campaigns (see below) and never asks. The calendar's rows do not name their
campaign and do not ask. Every completion by ring, including the Kampagnen
view, offers the undo toast.

### The Questlog: what one can work on

`GET /todos/backlog` (`todo-agenda.ts`: `backlogTodos`, the pure rule
`workableBacklog`) is the one definition of the Questlog; the Questlog view and
the Plan's Questlog column only show it, in the order the user sorted it
(`backlogPosition`, see `day-order.md` › The Questlog's order). A todo is in it when it is open, has
no day, and

- has no open todo below it: a Questreihe is worked on through its quests; one
  whose quests are all done is a step again and returns;
- is not a campaign: a top-level todo with todos below it (open or done) or a
  colour, icon or weekly goal is planned through its quests, even while it has
  none. A campaign that is one only by its look or goal is therefore in
  neither the Questlog nor anywhere to tick off by accident; it waits in the
  Kampagnen until it gets quests.

A plain top-level todo without todos below it and without those fields is a
loose quest: it lives in the Questlog (or on its day) and not in the
Kampagnen. The rule reads the user's live todos once (id, parent, done) beside
the open undated ones, so it costs one more light query, not one per todo.

### The Kampagnen view

The overview shows campaigns only, as tiles (`campaignTiles`, using
`isCampaign` from `utils/todo-hierarchy.ts`, the frontend twin of
`TodoAncestry.campaignOf`, plus roots the quest hours count), without a tree.
An opened campaign is its detail card and, below it, the tree of its quests
(`visibleHierarchy` with `under`), so the campaign is not repeated as a
root row with the same progress bar. The card takes the campaign's actions
("Bearbeiten", "Abschließen" and "…") and accepts drops; a row dropped on
another row goes below it. Every row there has a parent, so the row menu
has no "Fortschritt anzeigen"; the campaign's burnup stands on its card. Moving a quest to
the top says what it becomes. In the picker (`CampaignMoveDialog.vue`,
`PlannerItemEditor.vue`) the top-level choice reads "Keine (eigene Kampagne)"
when the quest has quests below it, otherwise "Keine (lose Quest)"; only
children are checked. While dragging in the tree, the drop zone reads "Hier
ablegen, um daraus eine eigene Kampagne zu machen." when the quest has quests
below it or already is a campaign, otherwise "Hier ablegen, um die Quest aus
der Kampagne zu lösen. Sie steht dann im Questlog oder an ihrem Tag." A loose
quest then leaves the tree. A new top-level quest that is no campaign yet is
announced as such ("… sobald sie Unter-Quests, eine Farbe, ein Symbol oder ein
Wochenziel hat").

### Progress and deep trees

`GET /todos/hierarchy` reads the owner's live todos in one query and computes
progress from that list bottom-up in O(n) time and space. Campaign, inherited
why and habit goals come from separate queries afterwards (`TodoAncestry`,
`habitGoals`), without a shared transaction, so a concurrent change can show
up in one part and not yet in another. A Todo whose parent is missing counts as a root,
so one bad row cannot hide the whole tree; a stored cycle is reported as a 500.
Create, move and delete do not load the whole tree: they read only the parent's
ancestor chain or the affected subtree with recursive queries on the parent index.

**Progress counts the todos below a node, never the node itself.** A campaign
with three quests, one done, is "1/3", not "1/4": the campaign's own
completion is its own, not a step towards it. Intermediate nodes (a
Questreihe) count once in their parent's progress and have their own progress
over the todos below them. A todo without todos below has no progress
(`todoCount` 0) and shows none. `TodoProgress` carries `todoCount` and
`doneCount` (todos below and done ones) besides the shown unit:
all durations below present: completed planned minutes / total planned minutes
(the node's own duration does not matter); any missing duration below:
completed count / total count, with the known duration sum as a minimum
estimate. The same definition runs the burn-up and `goal_snapshots`
(`goal-scope.ts` `scopesByRoot`) and the weekly review. The frontend only
shows it (`utils/todo-hierarchy.ts`: `hasProgress`, `progressText`,
`progressWords`, `openBelow`).

Traversal uses explicit queues/stacks, not recursively nested calls or recursive
Vue components. There is no configured functional depth limit. Visual indentation
is capped after six levels to preserve usable width; the actual level remains
visible and navigation is not capped. Deletion binds the subtree ids as one array
parameter, so its SQL size does not grow with the subtree.

Executed checks include 20,000 levels for the pure backend/frontend algorithms
and 2,000 levels through PostgreSQL load, preview and deletion (about 197 ms in
one local run). These are representative regression checks, not a general SLA or
proof that arbitrarily large accounts are practical. The UI currently loads the
whole user's tree; pagination/virtualization would require further load testing.

### Preview-bound deletion

1. `GET /todos/:id/deletion-preview` returns all affected live Todos and their
   attached timers, including running/paused states, plus a SHA-256 snapshot token.
   Reading a preview makes no persistent change.
2. The user reviews the list and explicitly confirms.
3. `DELETE /todos/:id` accepts `{ "confirmationToken": "..." }`.
4. Under the same per-user lock, the server computes the current snapshot again.
   If the subtree, relevant properties or timer state changed, it returns **409**.
   The user must request and review a fresh preview.
5. Otherwise all attached timers are deleted (via `timer-target.ts`), their pending delivery
   records follow existing FK cascades, and the entire Todo subtree is soft-deleted.
   Any failure rolls all changes back. No visible orphan children remain.

The token is a stale-state check, not a credential or substitute for ownership.
It is never stored as a password. A repeat after successful deletion returns
404 and makes no additional changes. Every delete requires a token: a request
without one is rejected with 400. The frontend's `useTodoDeletion` composable is
the one place that loads a preview and sends its token.

Soft deletion retains Todo records and their original `completedAt`. The existing
history reader uses `withDeleted()`, so previous completion entries remain visible.
No immutable journal or historical snapshot semantics were added. Already sent
external push notifications cannot be retracted by deleting their source timer.

## Campaign fields

A todo without parent may carry a weekly goal of quest minutes
(`weeklyTargetMinutes`), a `color` and an `icon` (keys from
`todos/campaign-style.ts`). Setting one on a todo with a parent is a 400;
moving a todo below another one clears all three in the same update, so a
campaign that becomes a Questreihe loses its look and goal. The check
constraint `CHK_todos_campaign_fields` holds the rule in the database. A
top-level todo counts as a campaign once it has todos below it or carries one
of these fields (`TodoAncestry.campaignOf`). See `quest-hours.md`.

## Inherited why

A todo without its own `why` shows the reason of its nearest ancestor that
states one. A habit without its own takes, in this order: the reason of the
campaign it names (`habits.campaignId`, or what that todo inherits if it has
moved below another), else the reason of the todo whose habit goal counts it
in a period covering today (or what that todo inherits). A named campaign
without any reason falls through to the goal.

Inheritance is live, not a copy: `todos.why` stays null for an inheriting todo,
so a changed reason reaches everything below it. The rule is one pure function,
`inheritedWhy` in `todo-hierarchy.ts`; `TodoAncestry` (`todo-ancestry.ts`)
reads the user's live todos and the campaigns their habits name once per
request (id, parent, reason, title, habit goal) and answers every lookup from
that (`inheritedHabitWhy`, `habitWhy`, `habitCampaign`).

- `TodoResponseDto` and `HabitResponseDto` carry the own `why` and
  `inheritedWhy: { text, fromId, fromTitle } | null`, so an editor can show both.
- `TodoResponseDto` also names its `campaign: { id, title, color, icon } | null`
  from the same snapshot (`TodoAncestry.campaignOf`), so the Questlog and the
  Plan's Questlog column draw the campaign stripe like Heute does.
- Day planner and history items carry one `why`: the reason to show.
- The frontend's `WhyField` quotes the inherited text instead of offering it
  as editable text, so no keystroke can turn it into a copy. "Eigenes Warum
  schreiben" opens an empty field; what is typed there becomes the own reason
  (left empty, or equal to the inherited text, it sends no `why` and keeps
  inheriting). "Wieder übernehmen" clears an own reason: the editor then sends
  an empty `why`, and `PATCH` with an empty `why` returns to inheriting. The
  editor sends `why` only when it changed.

Known limit: an entry below a reasoned ancestor cannot have "no reason at all".

## Database schema

The schema comes only from versioned migrations in
`backend/src/database/migrations/`, which run at startup (`migrationsRun`; no
`synchronize`). They create `parentId`, its index and the restrictive FK.

## API additions

- Optional `parentId: positive integer | null` on existing POST/PATCH Todo requests.
- `parentId` added to ordinary Todo responses (null for roots).
- `GET /todos/hierarchy`: flat owner-scoped Todo list with per-node `progress`.
- `GET /todos/:id/deletion-preview`: complete affected Todo/timer list and token.
- `DELETE /todos/:id`: requires `{ "confirmationToken": "..." }` from the preview.

Existing Todo GET/PATCH, authentication, Today, history and timer contracts remain
otherwise unchanged. Hierarchy summaries are not inserted as extra planner rows.

## Run and verify

Use the root README for PostgreSQL, Mailpit and application configuration. Start
backend and frontend normally after installing both lockfiles with `npm ci`.
The reference is self-contained source; it does not include dependencies or secrets.

Backend:

```sh
npm run build
npm test -- --runInBand
npx eslint "{src,test}/**/*.ts"
npm run test:e2e -- --runInBand
```

API tests require the dedicated `habit_tracker_test` database and the configured
local DB/Mailpit settings; they must never run against application data. Follow
`docs/e2e-and-ci.md` for the dedicated browser database, Mailpit and test commands.

Frontend:

```sh
npm ci
npm test
npm run build
npm run typecheck:e2e
npx playwright install chromium
npm run test:e2e
```

Executed verification for this change:

- Backend: 132 unit tests; 160 PostgreSQL/API tests.
- Frontend: 276 component/utility tests plus production build and E2E typecheck.
- Browser: 71 passed, 1 deliberately skipped (touch drag-and-drop; mobile uses the
  tested move dialog). Includes existing auth, timers, Today, Dump, Habits,
  history, push and PWA regression cases.
- Visual inspection at desktop and 390px widths: tree, create/move/delete dialogs,
  empty/error states. Synthetic preview data was used; behavioral browser tests
  used the real API and isolated PostgreSQL database.
- One earlier unit run hit an intermittent existing randomly generated VAPID-key
  fixture failure; the complete rerun passed without changes to push production code.

Not verified: production deployment/restore, arbitrary-scale performance,
external-device push delivery, or third-party calendar integration. Merge and
production deployment remain manual review decisions.
