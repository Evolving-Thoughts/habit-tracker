<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import ChallengeLine from "./ChallengeLine.vue";
import ChallengeMark from "./ChallengeMark.vue";
import ItemRow from "./ItemRow.vue";
import { campaignMark as markOf, categoryMark } from "../utils/category-mark";
import { formatDateForGermanDisplay } from "../utils/date";
import { measureOf, plannerRow, type MenuEntry } from "../utils/row-actions";
import type { DayPlannerItem } from "../types/day-planner";
import { streakLine } from "../utils/streak";

/**
 * A row of Heute on the shared row (ItemRow): ring, title with its meta
 * line, ▶ and the menu the view builds. Carried-over rows are compact and
 * show the view's chips instead of ▶ and the menu. In the order of the day
 * the whole card drags; its menu moves it a place up or down. The meta line
 * wraps on a phone too, as in the Kalender's lists: every part counts, and
 * the campaign chip moves on to the next line whole instead of shrinking.
 */
const props = withDefaults(defineProps<{
  item: DayPlannerItem;
  isUpdating: boolean;
  /** Shows the ring; a forecast run on another day has none. */
  checkable?: boolean;
  /** Shows ▶; another day has none, the stopwatch is for today. */
  measurable?: boolean;
  /** Clock time shown in the leading column; null keeps the column empty. */
  time?: string | null;
  /** Shows the original day instead of a time, for items carried over. */
  showDate?: boolean;
  /** Replaces ▶ and the menu with the choices in the slot. */
  compact?: boolean;
  /** In the order of the day: the whole card drags. */
  sortable?: boolean;
  /** "Aktionen für …": everything beyond ring, title and ▶. */
  menu?: MenuEntry[];
  /**
   * The Warum below the meta line is left out on a phone, so a long day
   * stays short there; from 40rem every open row shows it.
   */
  whyWideOnly?: boolean;
  /**
   * An appointment that is over but still open: a quiet question takes the
   * place of the Warum; "Anderer Tag …" leads the view's menu then.
   */
  past?: boolean;
  /**
   * Today's run of the Monats-Challenge: "Monats-Challenge · Tag 2 · noch 4"
   * in words in the meta line, which then wraps on a phone too.
   */
  challenge?: string | null;
  /** A run the schedule only forecasts: planned, not there yet. */
  forecast?: boolean;
}>(), { checkable: true, measurable: true, forecast: false });

const emit = defineEmits<{
  toggle: [item: DayPlannerItem];
  edit: [item: DayPlannerItem];
}>();

const state = computed(() =>
  props.item.status === "completed"
    ? "completed"
    : props.item.status === "skipped"
      ? "skipped"
      : "open",
);

/** The clock time in the leading column, where the row shows one. */
const shownTime = computed(() => (props.showDate ? null : props.time || null));

const details = computed(() => {
  const parts: string[] = [];
  if (state.value === "skipped") parts.push("Übersprungen");
  // A daily's running series, calm and only while there is one.
  const series =
    props.item.type === "habit" ? streakLine(props.item.streak) : null;
  if (series) parts.push(series);
  if (props.item.plannedDurationMinutes != null) {
    parts.push(
      props.item.workedMinutes > 0
        ? `${props.item.workedMinutes}/${props.item.plannedDurationMinutes} Min.`
        : `${props.item.plannedDurationMinutes} Min.`,
    );
  } else if (props.item.workedMinutes > 0) {
    parts.push(`${props.item.workedMinutes} Min. gearbeitet`);
  }
  // The time column already says it is an appointment.
  if (props.item.type === "todo" && props.item.timeOfDay && !shownTime.value)
    parts.push("Termin");
  return parts;
});

/** Every campaign has its own colour, like categories do. */
const campaignMark = computed(() => markOf(props.item.campaign));
/** A campaign's own quest wears its stripe but does not repeat its name. */
const campaignChip = computed(() => {
  const { item } = props;
  return item.type === "todo" && item.campaign?.id === item.todoId
    ? null
    : item.campaign;
});

const leading = computed(() =>
  props.showDate
    ? formatDateForGermanDisplay(props.item.scheduledDate).slice(0, 6)
    : (props.time ?? ""),
);

const measure = computed(() =>
  props.compact || !props.measurable
    ? null
    : measureOf(plannerRow(props.item)),
);
</script>

<template>
  <ItemRow
    class="planner-item"
    :class="{ 'planner-item--overdue': item.isOverdue }"
    :title="item.title"
    :state="state"
    :checkable="checkable"
    :keep-ring-column="!checkable"
    :forecast="forecast"
    :busy="isUpdating"
    :draggable="sortable"
    :campaign-mark="campaignMark"
    :measure="measure"
    :menu="compact || state !== 'open' ? [] : (menu ?? [])"
    wrap-meta
    @toggle="emit('toggle', item)"
    @edit="emit('edit', item)"
  >
    <template v-if="leading" #leading>
      <span class="planner-item__time">{{ leading }}</span>
    </template>
    <template
      v-if="
        item.type === 'habit' ||
        item.categoryName ||
        details.length ||
        campaignChip
      "
      #meta
    >
      <!-- A Daily says so first, as in the Plan. -->
      <span v-if="item.type === 'habit'" class="planner-item__daily">
        <AppIcon name="dailies" />Daily
      </span>
      <!-- Today's run names the challenge and where it stands; other runs wear the mark. -->
      <ChallengeLine
        v-if="challenge"
        class="planner-item__challenge"
        :line="challenge"
      />
      <ChallengeMark
        v-else-if="item.type === 'habit' && item.monthChallenge"
      />
      <span v-if="item.categoryName" class="planner-item__category">
        <i
          class="category-mark"
          :style="{
            background: categoryMark(item.categoryName, item.categoryColor),
          }"
          aria-hidden="true"
        />{{ item.categoryName }}
      </span>
      <span v-for="part in details" :key="part">{{ part }}</span>
      <CampaignChip v-if="campaignChip" :campaign="campaignChip" />
    </template>
    <!-- Over but open: asked, never warned; the ring answers it, "…" moves it. -->
    <template v-if="past && state === 'open'" #below>
      <p class="planner-item__nudge">Vorbei – erledigt?</p>
    </template>
    <!-- What it is for, quietly and on one line; done rows need it no more. -->
    <template v-else-if="item.why && state === 'open'" #below>
      <p
        class="planner-item__why"
        :class="{ 'planner-item__why--wide': whyWideOnly }"
        :title="item.why"
      >
        {{ item.why }}
      </p>
    </template>
    <template v-if="compact && $slots.default" #default>
      <slot />
    </template>
  </ItemRow>
</template>

<style scoped>
.planner-item__daily {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-weight: 700;
}

.planner-item__daily :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}


/* One quiet line; its unbroken text must not widen the list it sits in. */
.planner-item__why {
  margin: 0.1rem 0 0;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  contain: inline-size;
}

@media (max-width: 39.99rem) {
  .planner-item__why--wide {
    display: none;
  }
}

/* The question of a past appointment: one quiet line in muted ink. */
.planner-item__nudge {
  margin: 0.1rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
}

.planner-item__time {
  align-self: start;
  padding-top: 0.7rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.planner-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}
</style>
