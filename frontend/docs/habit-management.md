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
- The pencil opens the existing `PlannerItemEditor` for that habit's ID.
- Reactivation, metadata edits, dated schedule changes, and confirmed deletion
  retain the editor's established API contracts and validation behavior.
- Successful creation, saving, or deletion reloads the list.
- Cancel does not write or reload. Failed saves keep the editor open.
- Other editing/creation controls are disabled while an editor is open, preventing
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
