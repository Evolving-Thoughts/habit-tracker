# The weekly review (Wochenrückblick)

One page per week that looks back: how many quest hours went where, how far
each campaign moved, what was done, the week's quota and perfect week, and
three short answers the user writes. It counts input as the rest of the app
does (see `quest-hours.md`): a missed goal is a number, never a warning.

## Model

`week_reviews` (`backend/src/week-review/week-review.entity.ts`, migration
`1795400000000-WeekReviews`): per user and week, the Monday as `week`
(`date`) and three optional answers `wentWell`, `wentBadly`, `changeNext`
(each up to 10,000 characters, like the daily reflection). `UQ_week_reviews_user_week`
keeps one row per user and week. A review without any answer has no row.

Everything else on the page is read from what exists: the Logbuch, the
todos, the habit runs and `goal_snapshots`.

## Reads

The view loads two reads side by side; neither carries what the other has.

- `GET /quest-hours?week=` (`quest-hours.md`): minutes per day, per campaign
  with its weekly goal, the overall goal and the eight-week trend.
- `GET /week-review?week=YYYY-MM-DD` (`week` must be a Monday, validated like
  `GET /quest-hours`, both through `common/week-query.dto.ts`):

```ts
{
  startDate, endDate, today,
  campaigns: {
    campaign: { id, title, color, icon },
    start: Standing,          // when the week began
    end: Standing,            // when it ended; today in the running week
    dailyGoals: { todoId, habitId, habitTitle, target, before, after }[],
  }[],
  weekQuota: { completed, total, percentage } | null,
  perfectWeek: { perfect, categories: { id, name, target, completed, reached }[] } | null,
  days: { date, items: { type, id, title, status, resolvedAt, deleted, campaign }[] }[],
  answers: { wentWell, wentBadly, changeNext },   // nulls without a review
}
Standing = { doneCount, totalCount, percentage, source: 'snapshot' | 'live' | 'reconstructed' }
```

It is one `REPEATABLE READ` snapshot that writes nothing (not even a goal
snapshot), scoped to the signed-in user.

## Rules

Pure functions in `backend/src/week-review/week-review.ts`, each with a spec.

- **Active campaign** (`isActiveIn`): a top-level todo that is a campaign by
  the usual rule (`TodoAncestry.campaignOf`: todos below it, or a weekly
  goal, colour or icon), or a lone one whose daily goal runs in the week;
  it existed before the week ended and was not completed before it began. A
  campaign completed during the week is still listed.
- **Progress** counts like the burn-up and `goal_snapshots`
  (`scopesByRoot`): every live todo of the campaign, the campaign itself
  included; done against all. The percentage is whole, 0 without any quest.
- **Start of the week**: the latest snapshot dated in the seven days before
  Monday (a snapshot holds the last state of its day). Without one, the
  state is read back from the live todos (`scopesAt`): those created before
  Monday 00:00 Berlin, done when completed before then. That read-back cannot
  see deleted todos or a completion that was reopened, which is why a
  snapshot wins; the answer says `source: 'reconstructed'`, and the view
  adds one quiet line saying so.
- **End of the week**: the live todos for the running week (`source: 'live'`);
  for a past week the latest snapshot dated in the week, else read back at
  the end of Sunday. A week still ahead shows the live state on both sides,
  so it changes by nothing.
- **Daily goals**: every todo of the campaign (the campaign included) that
  counts a daily in a period touching the week. `before` and `after` are its
  completed runs up to Sunday before and up to the week's Sunday
  (`countedRuns` in `todos/habit-goal.ts`, also used by the hierarchy's goal
  progress).
- **Order**: most quests done this week first, then by title.
- **Done list** (`doneDays`): completed quests on the day they were completed
  and resolved runs, completed on the day they were done, skipped on the day
  they were due (the calendar's rules, `completedTodos` and
  `resolvedOccurrences`, deleted ones included and marked). Each names its
  campaign as the planner does today.
- **Quota and perfect week**: `loadWeekQuota` (`history/week-quota.ts`) and
  `perfectWeekOf` (`history/perfect-week.ts`), the same functions the
  calendar's week uses.

## Write: `PUT /week-review/:week`

`{ wentWell?, wentBadly?, changeNext? }`, each a string up to 10,000
characters or null; an unknown field is 400. It replaces all three answers
in the user's unit of work: answers are trimmed, an empty one is stored as
null, and when all three are empty the row is deleted. The week must be a
Monday that has begun; a week ahead is 400. The answer is the stored
`{ wentWell, wentBadly, changeNext }`.

## Frontend

- `views/WeekReviewView.vue` at `#/rueckblick`, the week in `?woche=<Monday>`
  (the current week has the plain address) with the Plan's switcher (Vorige
  Woche, Diese Woche, Nächste Woche) and the range plus "diese Woche",
  "vorige Woche", "vor 3 Wochen" below the title. On the phone it sits behind
  Mehr after Plan; on wide screens it is in the right-hand group of the bar
  (`tabWhenWide` stays off, see `DESIGN.md` for the bar's compact icons).
- Both reads load with `useLoader`. While either loads, three bones of the
  sections' size hold the place. A failed read shows its error with a retry
  above the sections of the other read; an empty week is only claimed when
  both arrived.
- Sections, each a component: `ReviewFigures` (Kennzahlen: quest hours
  against the overall goal with percent, the daily average over the days
  begun, the share of quest work in all measured time; the view's one lifted
  card), `ReviewDayBars`, `ReviewCampaignHours`, `ReviewCampaignProgress`
  (rows link to `#/kampagnen?kampagne=<id>`, where the burn-up is),
  `ReviewQuestSplit`, `ReviewWeekTrend` (the line is the average of the
  seven weeks before the shown one, so the shown week is compared with it),
  `WeekQuota` (shared with `CalendarWeek.vue`, flat here), `ReviewDoneList`
  and `ReviewAnswers` (three text areas, explicit "Speichern", a quiet
  "Gespeichert", errors in place, typing never overwritten by a refresh).
- A week without measured time and without anything resolved shows one calm
  empty card instead of the charts; trend, quota and the questions stay. A
  week ahead shows only that card and a line that the questions open once it
  begins.
- Pure rules in `utils/week-review.ts` (figures, bar heights, the change in
  words "+4 Quests, 62 % → 71 %", texts for screen readers).
