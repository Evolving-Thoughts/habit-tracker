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
