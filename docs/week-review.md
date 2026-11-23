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
  with its weekly goal, the overall goal that held for the week and the
  eight-week trend (quest and other minutes per week).
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
  switcher: Diese Woche, Vorige Woche, the range with "diese Woche",
  "vorige Woche", "vor 3 Wochen" below it, Nächste Woche. "Diese Woche"
  shows only away from the current week (`utils/week-review.ts`
  `offersWayBack`, the same rule as the "Heute" of the Plan and the Kalender);
  after it the focus goes to the range. On the phone it sits
  behind Mehr; from 56rem it is the last labelled tab of the top bar, a group
  of its own (`groupStart` in `router.ts`, see `DESIGN.md` for the bar).
- The page is a dashboard on top and the week's details below, one grid of
  cards each titled inside (`.card-title`). From 56rem it is up to 72rem
  wide, like the Plan wider than the page column:
  1. `ReviewFigures`: four figures, from 40rem separate cards two by two,
     from 64rem four in a row (above the fold on a desktop); on a phone one
     card (quest hours on top, average and share side by side, the Dailies
     below a hairline). Quest hours against the overall goal of that week
     ("von 20 Std. Wochenziel", "11 % vom Ziel", a flat bar; just the hours
     without a goal), the daily average over the days begun, the share of
     quest work in all measured time, and "Dailies im Wochensoll" ("5 von
     8", "fälligen Ausführungen erledigt"; "–" when nothing was due) with
     the perfect week in one line below it ("Perfekte Woche: Sport ✓, Lesen
     2 von 3"; "Perfekte Woche!" when every category reached its target).
     The Dailies come from the review read; when it fails or the week lies
     ahead the row has three cards. The quest hours are the view's one
     lifted card. The share is said only here: the split card below shows
     the two times, not their percentages again.
     On the running week the quest-hours card has a quiet pencil button
     ("Wochenziel ändern", "Wochenziel setzen" without a goal, then "Kein
     Wochenziel" as its line). It opens `QuestTargetForm` in place: hours
     and minutes, "Gilt ab dieser Woche; vergangene Wochen behalten ihr
     Ziel.", Speichern and Abbrechen (Escape too); the focus goes into the
     hours and back to the pencil. Saving writes the goal for this and the
     coming weeks (`quest-hours.md`), shows it at once and refreshes the
     other views. A past week shows its own goal read-only, without the
     button.
  2. `ReviewDayBars` (about three fifths) beside a column with
     `ReviewCampaignHours` and `ReviewQuestSplit`; on a phone one below the
     other. Today is marked quietly in the day bars: "Heute" in ink 800 and a
     2px ink baseline under its column, no frame, so the bars lead.
  3. `ReviewWeekTrend`, full width: eight weeks, each a stacked column of
     Kampagnen-Arbeit (on the baseline, `--color-bar`) and Sonstiges on top
     (`--color-mark-none`), 2px apart, the same keys as the split card, with
     a legend in the head. One scale for the whole stack; the dashed line is
     the average quest time of the seven weeks before the shown one, its
     value in the legend, so the shown week's quest part is compared with
     it. Under each column the quest time, "+0:45" other time, the date and,
     for the running week, "bisher"; the shown week has a 2px ink baseline
     and bold labels. Each column's tooltip and the text alternative name
     both parts.
  4. `ReviewCampaignProgress` (rows link to `#/kampagnen?kampagne=<id>`,
     where the burn-up is; two columns where there is room).
  5. `ReviewDoneList`: one card. From 64rem the week as seven fixed
     columns, Monday to Sunday: each day keeps its place, an empty one shows
     a quiet "–" ("Nichts erledigt" for screen readers), today says "Heute"
     with a 2px ink line under its heading (`aria-current="date"`).
     Narrower, the days with entries stack. On a phone it starts closed with
     its count and "Liste zeigen"; on a wide screen (56rem, decided when it
     appears) it is open up to eight entries and closed beyond.
  6. `ReviewDayBests`: the week's lines of "Das Beste des Tages"
     (`GET /day-bests?from=<Monday>&to=<Sunday>`, its own read), Monday to
     Sunday, each day linking to its line in `#/das-beste?tag=…`; no card
     for a week without lines (`day-best.md`).
  7. `ReviewAnswers`: three text areas (side by side from 56rem), explicit
     "Speichern", a quiet "Gespeichert", errors in place, typing never
     overwritten by a refresh.
- Both reads load with `useLoader`. While either loads, bones in the
  dashboard's grid (four figures, day bars beside two side cards, the
  weeks) hold the place. A failed read shows its error with a retry above
  the sections of the other read; an empty week is only claimed when both
  arrived.
- The charts appear only for measured time. A week without measured time
  and without anything resolved shows one calm empty card instead; the
  figures stay around it when earlier weeks have time or Dailies were due,
  the weeks before when they have time, and the questions stay. A week ahead shows only that card and a
  line that the questions open once it begins.
- Bars in the review use `--color-bar`: ink by day, a calmer warm tone
  (#bfa491) at night, where full ink would be the brightest thing on the
  page; it keeps at least 3:1 on cards, the lifted card and tracks
  (`theme.spec.ts`).
- Pure rules in `utils/week-review.ts` (figures and their units, bar
  heights, the stacked weeks (`weekTrend`, `weekBarText`), the running week, the change in words "+4 Quests, 62 % → 71 %",
  texts for screen readers). Counts let the noun follow the number:
  `questCount` gives "0 von 1 Quest" and "9 von 12 Quests", `dailyGoalText`
  "0 von 1 Ausführung" (`questWord` in `utils/todo-hierarchy.ts` is shared
  with the campaign progress and the burn-up).
