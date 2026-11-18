# Quest hours: measured time towards campaigns

The app counts input, not output: time spent on quests that belong to a
campaign is **quest time** ("Quest-Stunden"), measured against a weekly goal.
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
  step). Ten colours (`moss`, `pine`, `sage`, `slate`, `indigo`, `heather`,
  `plum`, `berry`, `walnut`, `ochre`) and sixteen icons (`book`, `code`,
  `dumbbell`, `heart`, `home`, `briefcase`, `graduation`, `music`, `leaf`,
  `money`, `wrench`, `pen`, `camera`, `globe`, `star`, `flag`). The DTOs reject
  any other key with 400.
- The three campaign fields belong to a todo without parent. Setting one on a
  todo with a parent is a 400, both on create and update; moving a campaign
  below another todo clears them (`TodosService.update`). The database holds
  the rule too: `CHK_todos_campaign_fields`, next to `CHK_todos_weekly_target`
  and `CHK_users_weekly_quest_target` for the bounds (migration
  `1795300000000-QuestHours`).

## Rules

- **Campaign of a stretch**: the one the Logbuch already names
  (`withCampaigns` in `work-logs/day-logs.ts`, `todo-ancestry.ts`): a quest's
  topmost ancestor, a daily's goal that counts it in a period covering today.
  A deleted quest has none, so its time counts as other time.
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
what the tiles, Heute and the coming weekly review need:

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
Logbuch, quest hours) carries `{ id, title, color, icon }`.

## Frontend

- `utils/category-mark.ts` `campaignMark` is the one place that decides a
  campaign's colour: the stored colour, else one derived from the title as
  before. The colours are tokens in `style.css` (`--color-mark-<key>`); the
  first six are also the category marks. None is the action orange; they
  differ in lightness as well as hue, and every use names the campaign in text.
- Icons are drawn in `AppIcon.vue` in the app's stroke family.
- `CampaignFields.vue` edits colour (radio swatches with spoken names, the
  chosen one also named in words), icon (radio group) and "Wochenziel" in
  hours (halves allowed, empty is none). `PlannerItemEditor.vue` offers it for
  a todo without parent, `CreateTodoForm.vue` when the Kampagnen view creates
  a new campaign. Hours become minutes in `utils/quest-hours.ts`.
- `CampaignsView.vue` shows a tile per campaign (`CampaignTiles.vue`, tabs
  "Aktiv" and "Abgeschlossen") above the full hierarchy: icon, colour stripe,
  title, this week against its goal, an eight-week trend (`QuestTrend.vue`, a
  small SVG with the weeks in words as its label) and the total. A tile opens
  the campaign in the same view (`#/kampagnen?kampagne=<id>`, so Back closes
  it): its numbers, subtree progress, `GoalBurnup.vue` and the hierarchy of
  that campaign only, with every row action the full list has.
- Einstellungen: `QuestTargetSetting.vue` reads and saves the overall goal.
- Heute: one quiet line in the head, "Quest-Stunden heute 1 Std. 20 Min. ·
  Woche 6 Std. von 20 Std."; without a goal only the numbers, nothing at all
  without measured quest time this week and without a goal.
- Stripes in Heute, Plan and the calendar's Logbuch take the stored colour
  through `campaignMark`; those rows get no icon.
