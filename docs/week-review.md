# The weekly review (Wochenrückblick)

One page per week that looks back: how many quest hours went where, how far
each campaign moved, what was done, the week's quota ("Dailies im
Wochensoll": completed runs against those due) and perfect week, and
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
  (`scopesByRoot`): every live todo below the campaign, never the campaign
  itself (a campaign with three quests, one done, is "1 von 3 Quests");
  done against all. The percentage is whole, 0 without any quest.
- **Stored snapshots** written before this rule counted the campaign too.
  Migration `1795500000000-ProgressBelowCampaign` deletes them all (only test
  data existed, and an old row cannot be corrected exactly: whether the
  campaign was done on that day is lost once it was reopened). Until new
  snapshots exist, earlier weeks are read back from the todos and say so
  (`source: 'reconstructed'`).
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
- **Daily goals** (unchanged): every todo of the campaign (the campaign included) that
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
  (the current week has the plain address). The header holds the title, a
  one-line lead ("Wie weit die Woche deine Kampagnen gebracht hat.") and the
  switcher: Vorige Woche, the range with "diese Woche", "vorige Woche",
  "vor 3 Wochen" below it, Nächste Woche, Diese Woche. On the phone it sits
  behind Mehr after Plan; on wide screens it sits behind Mehr up to 70rem and
  has its own tab in the right-hand group from there (`tabFrom: "wider"` in
  `router.ts`, see `DESIGN.md` for the steps of the bar).
- The page is a dashboard on top and the week's details below, one grid of
  cards each titled inside (`.card-title`). From 56rem it is up to 72rem
  wide, like the Plan wider than the page column:
  1. `ReviewFigures`: three figures, from 40rem three cards in a row, on a
     phone one card (quest hours over the two others). Quest hours against
     the overall goal ("von 20 Std. Wochenziel", "11 % vom Ziel", a flat bar;
     just the hours without a goal), the daily average over the days begun,
     the share of quest work in all measured time. The quest hours are the
     view's one lifted card.
  2. `ReviewDayBars` (about three fifths) beside a column with
     `ReviewCampaignHours` and `ReviewQuestSplit`; on a phone one below the
     other.
  3. `ReviewWeekTrend`, full width: eight weeks, the running one marked
     "bisher"; the line is the average of the seven weeks before the shown
     one, its value top right, so the shown week is compared with it.
  4. `ReviewCampaignProgress` (rows link to `#/kampagnen?kampagne=<id>`,
     where the burn-up is; two columns where there is room).
  5. `WeekQuota` with `dashboard`: "Dailies im Wochensoll" and "Perfekte
     Woche" as two flat cards side by side (one alone takes the width). The
     component is shared with `CalendarWeek.vue`, where the quota is lifted.
  6. `ReviewDoneList`: one card, days side by side where there is room. On a
     phone it starts closed with its count and "Alle n Einträge zeigen"; on
     a wide screen (56rem, decided when it appears) it is open up to eight
     entries and closed beyond.
  7. `ReviewAnswers`: three text areas (side by side from 56rem), explicit
     "Speichern", a quiet "Gespeichert", errors in place, typing never
     overwritten by a refresh.
- Both reads load with `useLoader`. While either loads, bones in the
  dashboard's grid (three figures, day bars beside two side cards, the
  weeks) hold the place. A failed read shows its error with a retry above
  the sections of the other read; an empty week is only claimed when both
  arrived.
- The charts appear only for measured time. A week without measured time
  and without anything resolved shows one calm empty card instead; the
  figures and the weeks before stay around it when earlier weeks have time,
  and quota and questions stay. A week ahead shows only that card and a
  line that the questions open once it begins.
- Pure rules in `utils/week-review.ts` (figures and their units, bar
  heights, the running week, the change in words "+4 Quests, 62 % → 71 %",
  texts for screen readers).
