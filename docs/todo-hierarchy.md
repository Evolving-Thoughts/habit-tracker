# Todo hierarchy — T2 and T3 reference implementation

## Scope and UI decision

The selected UI is **A: an expandable tree list** in the new **Aufgabenbaum** view.
The Today, Todo-Dump, Habits and History views remain available. Every Todo,
including a parent, retains its own completion checkbox, schedule, duration,
fixed/flexible flag and timer eligibility. There is no separate Goal entity.

T2 delivers hierarchy creation, progress, independent completion, atomic moves,
root moves and timer/planner integration. T3 adds editing and confirmed subtree
soft-deletion. Existing Today/Dump editors use the same deletion-preview contract.
No sibling sorting, archive/restore, Habit contribution or new time-accounting
rules are introduced. The existing one-active-timer-per-user rule remains in place.

## Learning guide: understand before copying

1. Sketch a tree containing an explicitly completed parent with open children.
   Explain why its checkbox and subtree progress can disagree without being a bug.
2. Read `todo-hierarchy.ts` (`TodoTree`). Work out the parent-plus-five-children
   example on paper: the denominator is six, not five. Then add durations to every node.
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
ancestor/subtree reads), `TodoHierarchyView.vue`, `useTodoDeletion.ts`,
`TodoDeletionSummary.vue` and their tests.

## Architecture and invariants

### Adjacency list instead of a second domain model

`todos.parentId` is nullable and references `todos.id` with a non-cascading,
restricting foreign key. Existing records have a null parent and remain roots.
Ownership and live-parent checks are enforced on the server. Requests cannot
point to themselves, descendants, another user's Todos or soft-deleted parents.
The frontend's filtered move choices are convenience, not authorization.

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

### Progress and deep trees

`GET /todos/hierarchy` reads one owner-scoped snapshot, then computes progress
bottom-up in O(n) time and space. A Todo whose parent is missing counts as a root,
so one bad row cannot hide the whole tree; a stored cycle is reported as a 500.
Create, move and delete do not load the whole tree: they read only the parent's
ancestor chain or the affected subtree with recursive queries on the parent index. Parent and intermediate nodes each count once.
All durations present: completed planned minutes / total planned minutes.
Any missing duration: completed Todo count / total Todo count. The known duration
sum is then displayed as a minimum estimate.

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

## Database upgrade — additive, never reset

For a fresh local learning setup, follow the existing README to create the
application baseline; development schema synchronization includes `parentId`.
For an existing database with synchronization disabled:

1. Back up the database and verify the restore procedure in a separate environment.
2. Install dependencies using the existing lockfile and configure `backend/.env`
   using `.env.example`; do not put real secrets in the repository.
3. Stop old application processes so no old code writes concurrently during upgrade.
4. From `backend`, run:

```sh
npm ci
npm run migration:run
```

5. Deploy/start the updated backend and frontend using the existing project workflow.

`npm run migration:run` builds the backend and applies every pending migration in
`dist/migrations` with the app's own database settings (`database.options.ts`).
The versioned `TodoHierarchy1792620000000` migration adds only the nullable column,
index and restrictive FK. It does not clear records or assign existing parents.
It is idempotent for already synchronized development schemas and is recorded in
`app_migrations`. The migration requires the existing application baseline; it is
not a replacement for the broader initial schema/deployment work tracked elsewhere.
It refuses automatic destructive rollback rather than silently dropping hierarchy
data. No `docker compose down -v`, schema reset or production deployment is needed.

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
