# Streaks: a Daily's series (Serie)

How many due runs of a habit in a row were done, and the longest such
series ever. The UI calls it "Serie" and shows numbers only: "12 in Folge ·
Rekord 21" in the Dailies list, "12 in Folge" on a run's row in Heute, Plan
and the Fokus-Modus (left out while it is 0). A broken series is a number
like any other, never a warning.

## The rule (`backend/src/habits/streaks.ts`, `habitStreak`)

Computed in the backend from all of a habit's occurrences and schedule
versions, as of now (Europe/Berlin days). Every occurrence becomes one unit,
sorted by its slot (`scheduledDate`); the series counts `done` units in a
row, a `missed` unit breaks it, a `neutral` one does neither.

| Occurrence | Unit |
|---|---|
| `completed` | done, at its slot, even when it was done late |
| `skipped` by hand ("Überspringen") | neutral |
| `skipped` by the scheduler (its window closed) | missed |
| `pending`, window still open (today's run, a run carried over) | neutral: today's open run breaks nothing |
| `pending`, window over (not reconciled yet) | missed |
| `cancelled` (schedule change, weekly goal reached, already done today) | neutral |

Both skips store `status: skipped` with the day it happened in
`resolvedDate`, so the day tells them apart (also for runs stored before the
rule existed): a person can only skip while the run is still actionable,
before `expiresAt(version, scheduledDate)` (`changeStatus` refuses later), so
`resolvedDate` lies before the day the window closes; the scheduler skips a
run on or after that day (`occurrence-lifecycle.ts` `endedSlot`). A missed
run of the "carry over" policy is therefore missed only once its next slot
arrived, a run of the "skip" policy the day after its slot.

**Weekly goals** ("n× pro Woche", `weekly_target`) count weeks instead of
runs. A week (Monday to Sunday) with at least as many completions as its
goal is `done` (completions by `resolvedDate`); a past week below the goal
is `missed`; the running week below the goal is neutral, and so is a week
the goal only covered in part (its version began after that Monday or ended
before the next one). A week without any run (the Daily was paused) is no
unit. Skipping a single day of a weekly goal changes nothing.

A change of rhythm keeps the series: units of every version are sorted
together. Paused stretches are gaps without units. `unit` says what the
numbers count: `weeks` while the rhythm in force (else the first one) is a
weekly goal, otherwise `runs`.

## API

`streak: { current: number; best: number; unit: 'runs' | 'weeks' }` on

- every habit response (`GET /habits`, `GET /habits/:id`, create, update and
  schedule changes; a new habit has `{ 0, 0 }`),
- every habit item of `GET /day-planner/today`,
- every habit entry of `GET /day-planner/plan` (forecast runs too).

`loadStreaks(manager, habitIds, now)` reads the versions and the few
occurrence columns the rule needs for all habits at once; the readers call
it once per request. The frontend words it in `utils/streak.ts`
(`streakLine`, `streakSummary`).
