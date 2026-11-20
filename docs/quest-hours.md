# Quest hours: measured time towards campaigns

The app counts input, not output: time spent on quests that belong to a
campaign is **quest time** ("Kampagnen-Stunden"), measured against a weekly goal.
There are no points, levels or badges, and a missed goal is shown as a plain
number, never in a warning colour.

## Model

- Measured work is the Logbuch (`work_logs`, see `logbook.md`). Quest hours
  add no table of their own; they are read from the stretches.
- **Weekly goals** are minutes (integers, like `plannedDurationMinutes`):
  `users.weeklyQuestTargetMinutes` is the overall goal, `todos.weeklyTargetMinutes`
  an optional goal per campaign. Both are 1 to 6000 (100 hours) or null.
- **Colour and icon** of a campaign: `todos.color` and `todos.icon`, each a
  key from a fixed list (`backend/src/todos/campaign-style.ts`,
  `frontend/src/types/campaign.ts`; the contract check holds both lists in
  step). Sixteen colours, the core eight first (`indigo`, `navy`, `ochre`,
  `pine`, `berry`, `plum`, `teal`, `walnut`), then `moss`, `sage`, `sky`,
  `slate`, `heather`, `wine`, `olive`, `lilac`; every key stored before the
  palette grew is still one of them. Thirty-two icons: `book`, `code`,
  `dumbbell`, `heart`, `home`, `briefcase`, `graduation`, `music`, `leaf`,
  `money`, `wrench`, `pen`, `camera`, `globe`, `star`, `flag`, `bike`,
  `coffee`, `plane`, `palette`, `mountain`, `moon`, `people`, `chat`, `bulb`,
  `trophy`, `pot`, `gamepad`, `paw`, `laptop`, `map`, `drop`. The DTOs reject
  any other key with 400; the column is `varchar(16)` without a check, so
  the list lives in code only.
- **Colour of a category:** `categories.color` (nullable, migration
  `CategoryColor`), a key from the same colours. Null lets the name pick one
  (see below). `POST /categories` and `PATCH /categories/:id` take
  `color` (a key or null); every category response carries it.
- The three campaign fields belong to a todo without parent. Setting one on a
  todo with a parent is a 400, both on create and update; moving a campaign
  below another todo clears them (`TodosService.update`). The database holds
  the rule too: `CHK_todos_campaign_fields`, next to `CHK_todos_weekly_target`
  and `CHK_users_weekly_quest_target` for the bounds (migration
  `1795300000000-QuestHours`).

## Rules

- **Campaign of a stretch**: the one the Logbuch already names
  (`withCampaigns` in `work-logs/day-logs.ts`, `todo-ancestry.ts`): a quest's
  topmost ancestor; for a daily's run, the campaign the daily names
  (`habits.campaignId`, see below) and, only without one, the goal that
  counts the daily in a period covering today. A deleted quest has none, so
  its time counts as other time; a daily whose named campaign was deleted
  falls back to its goal. Like the goal, the named campaign is read as it is
  now: changing a daily's campaign moves all of its measured time along.
- **Campaign of a daily**: `habits.campaignId` (nullable FK to `todos.id`,
  `ON DELETE SET NULL`, migration `DailyCampaignAndRunNotes`). Create and
  update (`campaignId` in `POST /habits`, `PATCH /habits/:id`) accept only a
  live top-level todo of the same user (`habits/habit-campaign.ts`, 400
  otherwise); null clears it. Todos are soft-deleted, so the FK only guards
  hard deletes: a soft-deleted campaign stays referenced and simply stops
  counting. Should the named todo later move below another quest, the daily
  counts for that quest's campaign. Habit responses carry `campaignId` and
  `campaign` (`{ id, title, color, icon }`, the named campaign or else the
  goal's), so the Dailies view shows the chip; day planner, Plan, Kalender and
  week review already name a run's campaign through the same
  `TodoAncestry.habitCampaign`.
- **What is a campaign**: a top-level todo with todos below it, or one that
  was given a weekly goal, colour or icon. Choosing one of these makes even a
  lone top-level quest a campaign; a lone goal that counts a daily stays one
  for that daily's time, as before.
- **Minutes of a day**: `questTimeOfDay` in `quest-hours/quest-time.ts` splits
  `workedMinutesBy` by campaign. Overlap counts once (for the stretch that
  started first), a stretch across Berlin midnight is cut to each day, and a
  23- or 25-hour day counts as it is. Quest minutes are the parts with a
  campaign, other minutes the part without. The campaign parts add up to the
  quest minutes, and quest plus other minutes are exactly `workedMinutes` of
  the day.
- **Weeks** run Monday to Sunday in Europe/Berlin and are sums of their days
  (`questWeek`, `questSoFar`), so they add up the same way.

## Reads

### `GET /quest-hours?week=YYYY-MM-DD`

`week` must be a Monday (validated like `GET /day-planner/week`: a malformed
date, another weekday or an unknown query field is 400). One endpoint carries
what the tiles, Heute and the weekly review (`week-review.md`) need:

```ts
{
  startDate, endDate, today,
  weeklyTargetMinutes: number | null,   // the overall goal
  questMinutes, otherMinutes,           // the week
  days: { date, questMinutes, otherMinutes }[],          // Monday to Sunday
  weeks: { startDate, questMinutes }[], // eight weeks up to this one, oldest first
  campaigns: {
    campaign: { id, title, color, icon },
    minutes,                 // this week
    weeklyTargetMinutes,     // its goal or null
    weeks: number[],         // aligned with `weeks`
    totalMinutes,            // every quest minute ever measured for it
  }[],
}
```

`campaigns` lists every campaign with measured time or a weekly goal, most
time this week first. It is one `REPEATABLE READ` snapshot that writes
nothing, scoped to the signed-in user. Totals and the trend need every stretch
the user logged, so this read loads all of their work logs; that is fine at
the app's size and the first thing to change if accounts grow large.

### `GET /quest-hours/target`, `PUT /quest-hours/target`

`{ weeklyTargetMinutes: number | null }`: the overall goal, read and written
for the signed-in user only. The write runs in the user's unit of work; a
missing field, a fraction, 0 or more than 6000 is 400.

### Heute and every campaign name

`GET /day-planner/today` adds `questHours: { todayMinutes, weekMinutes,
weeklyTargetMinutes }`, computed by the same functions from the week's
stretches. Every answer that names a campaign (Heute, Plan, the calendar's
lists and Logbuch, quest hours, the week review) carries
`{ id, title, color, icon }`. Answers that name a category by
`categoryName` (Heute, the calendar's lists) also carry `categoryColor`,
and the Perfect Week rows carry `color`; `categories/category-lookup.ts`
resolves both from one read of the user's categories.

## Frontend

- `utils/category-mark.ts` decides every colour: `categoryMark(name, color)`
  takes a category's stored colour, else one of the eight core colours from
  the name (FNV-1a); `campaignMark` does the same for a campaign and its
  title. The colours are tokens in `style.css` (`--color-mark-<key>`), none
  the action orange. The core eight stay apart under protanopia,
  deuteranopia and tritanopia in both themes; `src/palette.spec.ts`
  simulates them (Machado 2009 on linear sRGB, OKLab distance) and checks
  3:1 against what a mark sits on. Every use names the campaign or category
  in text as well; rows show `CampaignChip.vue` (icon and name) beside the
  stripe.
- `MarkPicker.vue` is the one palette: radio swatches, "Automatisch" first,
  then the core colours, then the extra ones, each with its name as tooltip
  and spoken label and the choice in words below. Campaigns use it in
  `CampaignFields.vue`, categories behind their dot in
  `CategorySettings.vue` (also when creating one).
- Icons are drawn in `AppIcon.vue` in the app's stroke family.
- `CampaignFields.vue` edits colour (`MarkPicker`), icon (radio group) and "Wochenziel" in
  hours (halves allowed, empty is none). `PlannerItemEditor.vue` offers it for
  a todo without parent, behind the disclosure "Kampagne", which starts open
  once one of the three is set; `CreateTodoForm.vue` shows it open when the
  Kampagnen view creates a new campaign. Hours become minutes in `utils/quest-hours.ts`.
- `CampaignsView.vue` shows a tile per campaign (`CampaignTiles.vue`, tabs
  "Aktiv" and "Abgeschlossen") above the tree of the campaigns and their
  quests (loose quests are not in it): icon, colour stripe, title, this week
  against its goal, an eight-week trend (`QuestTrend.vue`, a small SVG with
  the weeks in words as its label) and the total. A tile opens the campaign in
  the same view (`#/kampagnen?kampagne=<id>`, so Back closes it): its own
  `why` under the title, a group "Diese Woche" (this week against its goal as
  a bar, the eight-week trend labelled "letzte 8 Wochen" and the total), a
  group "Fortschritt" (the quests below it, never itself, see
  `todo-hierarchy.md`, as "x von y Quests" with a bar, and `GoalBurnup.vue`,
  which offers its switches only once it has two days to draw), "Bearbeiten"
  and "…" with the campaign's own actions, and the quests below it as the
  tree, with every row action the full list has. The campaign is the card,
  not a row of the tree.
- Einstellungen: `QuestTargetSetting.vue` reads and saves the overall goal.
- Heute: one quiet line in the head that relates the day's quest time to
  what was worked (both from the same stretches, so the part is never more
  than the whole), then the week: "1 Std. 40 Min. gearbeitet, davon 1 Std.
  20 Min. auf Kampagnen · Woche 4 Std. 11 Min. von 20 Std."; "…, alles auf
  Kampagnen" when all of it was; just "40 Min. gearbeitet · Kampagnen diese
  Woche …" when none was; only the week before anything was worked today;
  without a goal only the numbers; nothing without time and goal
  (`workLine` in `utils/quest-hours.ts`). A figure keeps its unit (no-break
  spaces: "4 Std. 20 Min." never breaks inside). With a goal, a slim ink bar
  on deep apricot below shows the week's campaign hours against it (a
  `progressbar` with both figures as its text); behind the goal is a shorter
  bar, never a warning colour.
- Stripes in Heute, Plan and the calendar's Logbuch take the stored colour
  through `campaignMark`; those rows get no icon.
