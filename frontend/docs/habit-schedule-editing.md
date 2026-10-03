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

After successful saving, `changed` causes `TodayView` to close the editor and reload
its planner. A failed request leaves the editor open without falsely reporting
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
- Creation succeeds → dialog closes, a confirmation is shown, the view reloads.
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

The jsdom test setup polyfills only the missing `showModal`/`close` methods; production
uses the browser's native dialog implementation. Component and view tests cover choice,
direct Todo-Dump creation, all three schedule types, success/refresh, validation,
cancellation, API failure retention, and in-flight duplicate/close prevention.
