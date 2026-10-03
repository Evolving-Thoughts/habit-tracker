# Habit management

The **Habits** navigation view lists habit definitions using `GET /habits`.
It intentionally does not use the planner or occurrence endpoints: a habit must
remain editable even when it is paused, not due today, or starts in the future.
The backend already excludes soft-deleted habits from its normal repository reads.

## What the view shows

- **Aktiv** and **Pausiert** groups use `isActive`, not today's due status.
  An enabled habit with a future start therefore belongs in Aktiv but has a
  **Geplant** badge until it has a currently valid version.
- Current and upcoming schedule versions are shown separately with German dates.
- Null versions are handled explicitly (future-only or no schedule).
- Schedule summaries use a shared formatter in `src/utils/habit.ts`, also used
  by the existing editor. Weekdays are displayed Monday first.

## Reused capabilities

- The `+` button opens `CreateItemDialog` directly in Habit mode.
- The pencil opens `EditItemDialog`, which embeds the existing `PlannerItemEditor` for that habit's ID.
- Reactivation, metadata edits, dated schedule changes, and confirmed deletion
  retain the editor's established API contracts and validation behavior.
- Successful creation, saving, or deletion reloads the list.
- Cancel does not write or reload. Failed saves keep the editor open.
- Native modal dialogs make the background inert while editing or creating, preventing
  an accidental switch that discards an unsaved form. Loading also disables actions.
- A failed refresh preserves the previously loaded list and displays an error.

Management works on definitions, not completion records: completing/skipping an
occurrence remains an action in Today. No recurrence calculation or version
activation logic is duplicated in this frontend view.

## Verification

```sh
npm test
npm run build
```

The view tests cover active/paused grouping, future-only and null schedules,
creation with a future date, reactivation, editing upcoming rules, confirmed
deletion, cancellation, errors, and reload behavior. Navigation, API contract,
direct Habit dialog mode, and summary formatting have focused tests as well.

For a live backend check:

1. Create a future-start Habit from the Habits `+` button; it should remain visible
   in this view before it becomes due in Today.
2. Open its pencil, edit the upcoming schedule, and save.
3. Pause and reactivate a Habit via the editor's **Habit aktiv** checkbox.
4. Delete a Habit with confirmation and verify it disappears from the list.
5. Switch between Today, Todo-Dump, and Habits; all creation flows should still work.

## Modal editing and persistent creation button

Today, Todo-Dump and Habits open editing **above the list**, not inline.
`ModalDialog.vue` owns the native top-layer dialog, accessible title, initial focus,
Escape/close protection while busy, and page scroll lock. `EditItemDialog.vue`
embeds the shared editor; Todo-Dump keeps its existing edit form inside the same
modal shell. There are no scheduling/API changes in this UI block.

- Opening captures the current scroll position and fixes the background body there.
  Long dialogs scroll independently; outside clicks do not discard the form.
- The title input is focused after asynchronous loading. Ordinary changes/errors
  do not repeatedly steal focus. Creation also uses the same shell.
- A successful write keeps the dialog locked during the list refresh, preventing
  duplicate submissions. It closes only when the current DOM is ready.
- On closing, body styles and scroll are restored, then focus returns with
  `preventScroll` to the edited row's current pencil. `useListFocus` resolves by
  stable identity, not an old DOM node. If a row disappears, it uses the next
  available neighbour (previous for the last row), or `+` for an empty list.
  When deletion shortens the page, the browser clamps scroll to its new maximum.
- Creation returns focus to its opener. Background navigation and buttons are
  inert through the native modal implementation.
- `CreateButton.vue` is fixed to the viewport's bottom-right, with safe-area insets,
  a 56px target and a centered symmetric SVG plus. It remains in the same viewport
  position at both ends of a long list. Bottom page padding lets the last row scroll
  clear of the button.

Tests cover scroll/style restoration, asynchronous initial focus, focus after a
refreshed row/deletion, busy close/submit guards and creation refresh. Real Chromium
checks with mocked HTTP responses additionally verify native modal state, actual
scroll restoration (including shorter-list clamping), fixed-button geometry and
390px / 1100px layouts. jsdom does not verify native focus trapping, and these checks
are not live-backend E2E tests. Please also test mobile keyboard/safe-area behavior
on your actual device.
