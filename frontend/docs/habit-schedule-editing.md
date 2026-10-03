# Habit schedules in the frontend

A habit's identity (`title`, `isActive`) is independent of its versioned schedule.
The editor reads `currentSchedule` and `upcomingSchedule` from `GET /habits/:id`.
It shows both separately; a habit may have no current schedule yet.

## Editing

- Title/activity changes use `PATCH /habits/:id` and contain only changed metadata.
- Schedule changes require selecting **Zeitplan ändern** and use
  `POST /habits/:id/schedule-changes` with `{ effectiveFrom, schedule }`.
- **Geplanten Zeitplan bearbeiten** prefills the upcoming rule and its effective date.
- The effective date defaults to today's calendar date in `Europe/Berlin`.
  Today takes effect at save time; a future day takes effect at midnight in that zone.
- Calendar dates remain `YYYY-MM-DD` in the API. Display text uses `DD.MM.YYYY`.
  The native date picker follows the browser/device locale; its stored value is ISO.
- Each rule sends only its own fields. Weekly targets do not send
  `missedOccurrencePolicy`, `weekdays`, or `intervalDays`.
- A submitted schedule change can replace an existing upcoming version. This is
  stated in the editor. Simply editing metadata never replaces a schedule.
- The backend owns occurrence reconciliation and preserves historical completions
  and skips. The frontend does not regenerate occurrences itself.

## Two requests, not an atomic transaction

If both metadata and schedule change, both are validated before any request.
Metadata is saved first. If that succeeds but the schedule request fails, the
editor explicitly reports partial success and remains open with the user's inputs.
The saved metadata becomes the new comparison baseline, so retrying submits only
what still needs to be saved. A metadata failure prevents the schedule request.

After successful saving, `changed` causes the view to reload its list/planner and then
close the editor. The dialog remains locked until that refresh has settled. A failed request leaves the editor open without falsely reporting
success. Deletion still requires a separate confirmation.

## Verification

```sh
npm test
npm run build
```

Component tests cover schedule-type switches, future dates, current/upcoming/null
versions, metadata-only saves, validation, failures/retries, and duplicate submit
prevention. API tests verify the request methods, paths, and payloads. TodayView
integration tests verify planner refresh after saving and error retention.

## Creating entries

The persistent Todo form is replaced by an on-demand native `<dialog>`:

- In **Today**, the shared `+` button opens a **Todo / Habit** choice.
- In **Todo-Dump**, the same button opens the Todo form directly.
- Creation succeeds → the view refreshes, then the dialog closes and a confirmation is shown.
- Cancel or Escape closes the dialog without a request. While a request is pending,
  cancel, close, and navigation are disabled to avoid losing in-flight form state.
- A failed request leaves the entered values and error visible so the user can retry.
- The native browser dialog makes the background inert and traps keyboard focus;
  the component focuses the first title input (or choice) and restores the opener.

`CreateHabitForm` sends `{ title, startDate?, schedule }` to `POST /habits`.
Omitting `startDate` lets the backend default it to today's date in Europe/Berlin.
An explicit date remains ISO internally; the explanatory text is formatted in German.
Intervals, fixed weekdays (Monday first), and weekly targets share the same typed
schedule contract as the editor. Inactive rule fields are never included in requests.

The jsdom test setup polyfills the missing `showModal`/`close` methods and scrolling; production
uses the browser's native dialog implementation. Component and view tests cover choice,
direct Todo-Dump creation, all three schedule types, success/refresh, validation,
cancellation, API failure retention, and in-flight duplicate/close prevention.

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
