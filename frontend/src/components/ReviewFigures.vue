<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import QuestTargetForm from "./QuestTargetForm.vue";
import type { PerfectWeek, WeekQuota } from "../types/history";
import type { QuestHoursResponse } from "../types/quest-hours";
import { categoryMark } from "../utils/category-mark";
import { formatDuration } from "../utils/today-agenda";
import {
  durationParts,
  reviewFigures,
  type FigurePart,
} from "../utils/week-review";

const props = withDefaults(
  defineProps<{
    hours: QuestHoursResponse;
    /**
     * The goal can be changed for the running week only; a week that is
     * over shows the goal it had.
     */
    editable?: boolean;
    /** The fourth figure: Dailies im Wochensoll and the perfect week. */
    dailies?: { quota: WeekQuota | null; perfectWeek: PerfectWeek | null } | null;
  }>(),
  { editable: false, dailies: null },
);
const emit = defineEmits<{ "target-saved": [minutes: number | null] }>();

const figures = computed(() => reviewFigures(props.hours));
/* A missed goal is a number like any other: the bar just stops short. */
const filled = computed(() =>
  figures.value.targetMinutes
    ? Math.min(100, (figures.value.questMinutes / figures.value.targetMinutes) * 100)
    : 0,
);
const averageNote = computed(() => {
  const days = figures.value.daysPassed;
  if (!days) return "Die Woche hat noch nicht begonnen";
  return days === 7 ? "über alle 7 Tage" : `über ${days} ${days === 1 ? "Tag" : "Tage"} bisher`;
});
const measured = computed(
  () => figures.value.questMinutes + figures.value.otherMinutes,
);
const UNKNOWN: FigurePart[] = [{ value: "–", unit: "" }];
const average = computed(() =>
  figures.value.dailyAverage === null
    ? UNKNOWN
    : durationParts(figures.value.dailyAverage),
);
const share = computed(() =>
  figures.value.questShare === null
    ? UNKNOWN
    : [{ value: String(figures.value.questShare), unit: "%" }],
);

const quota = computed(() =>
  props.dailies?.quota && props.dailies.quota.total > 0
    ? props.dailies.quota
    : null,
);
const perfectWeek = computed(() =>
  props.dailies?.perfectWeek?.categories.length
    ? props.dailies.perfectWeek
    : null,
);

/* The goal is edited in place, in the card it belongs to. */
const editing = ref(false);
const editButton = ref<HTMLButtonElement | null>(null);
async function closeEditor(): Promise<void> {
  editing.value = false;
  await nextTick();
  editButton.value?.focus();
}
function onSaved(minutes: number | null): void {
  emit("target-saved", minutes);
  void closeEditor();
}
</script>

<template>
  <!-- Four cards from 40rem (two by two, in a row from 64rem); on a phone one card. -->
  <section class="figures" aria-labelledby="review-figures-title">
    <h2 id="review-figures-title" class="visually-hidden">Kennzahlen</h2>
    <dl class="figures__list" :class="{ 'figures__list--three': !dailies }">
      <div class="figures__item figures__item--hours">
        <dt class="card-title">Kampagnen-Stunden</dt>
        <dd v-if="editable && !editing" class="figures__edit">
          <button
            ref="editButton"
            type="button"
            class="btn btn--quiet btn--icon"
            :aria-label="
              figures.targetMinutes === null
                ? 'Wochenziel setzen'
                : 'Wochenziel ändern'
            "
            :title="
              figures.targetMinutes === null
                ? 'Wochenziel setzen'
                : 'Wochenziel ändern'
            "
            @click="editing = true"
          >
            <AppIcon name="edit" />
          </button>
        </dd>
        <dd class="figures__value">
          <template
            v-for="(part, index) in durationParts(figures.questMinutes)"
            :key="index"
            >{{ index ? " " : "" }}{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <dd v-if="editing" class="figures__editor">
          <QuestTargetForm
            :minutes="figures.targetMinutes"
            cancellable
            autofocus
            @saved="onSaved"
            @cancel="closeEditor"
          />
        </dd>
        <template v-else-if="figures.targetMinutes !== null">
          <dd class="figures__note">
            von {{ formatDuration(figures.targetMinutes) }} Wochenziel
          </dd>
          <dd class="figures__goal">
            <span
              class="figures__bar"
              role="progressbar"
              aria-label="Kampagnen-Stunden gegen das Wochenziel"
              :aria-valuenow="figures.questMinutes"
              aria-valuemin="0"
              :aria-valuemax="figures.targetMinutes"
              :aria-valuetext="`${formatDuration(figures.questMinutes)} von ${formatDuration(figures.targetMinutes)}`"
            >
              <span :style="{ width: `${filled}%` }" />
            </span>
            <span class="figures__percent">{{ figures.targetPercent }} % vom Ziel</span>
          </dd>
        </template>
        <dd v-else-if="editable" class="figures__note">Kein Wochenziel</dd>
      </div>
      <div class="figures__item">
        <dt class="card-title">Tagesschnitt</dt>
        <dd class="figures__value">
          <template v-for="(part, index) in average" :key="index"
            >{{ index ? " " : "" }}{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <dd class="figures__note">{{ averageNote }}</dd>
      </div>
      <div class="figures__item">
        <dt class="card-title">Kampagnen-Arbeit</dt>
        <dd class="figures__value">
          <template v-for="(part, index) in share" :key="index"
            >{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <dd class="figures__note">
          {{
            measured
              ? `von ${formatDuration(measured)} gemessen`
              : "Noch nichts gemessen"
          }}
        </dd>
      </div>
      <div v-if="dailies" class="figures__item figures__item--dailies">
        <dt class="card-title">Dailies im Wochensoll</dt>
        <!-- "5 von 8": the done ones lead, what was due sits beside them. -->
        <dd v-if="quota" class="figures__value">
          {{ quota.completed }} <span class="figures__unit">von {{ quota.total }}</span>
        </dd>
        <dd v-else class="figures__value">–</dd>
        <dd class="figures__note">
          {{ quota ? "fälligen Ausführungen erledigt" : "Nichts fällig in dieser Woche" }}
        </dd>
        <dd v-if="perfectWeek" class="figures__perfect">
          <span class="figures__perfect-label">{{
            perfectWeek.perfect ? "Perfekte Woche! " : "Perfekte Woche: "
          }}</span>
          <ul class="figures__categories">
            <li
              v-for="(category, index) in perfectWeek.categories"
              :key="category.id"
            >
              <i
                class="figures__swatch"
                :style="{ background: categoryMark(category.name, category.color) }"
                aria-hidden="true"
              />{{ category.name }}
              <template v-if="category.reached">
                <AppIcon name="check" class="figures__check" />
                <span class="visually-hidden">erreicht</span>
              </template>
              <span v-else class="figures__count"
                >{{ category.completed }} von {{ category.target }}</span
              ><template v-if="index < perfectWeek.categories.length - 1"
                >,
              </template>
            </li>
          </ul>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.figures dd {
  margin: 0;
}

/* Phone: one lifted card, the quest hours over the smaller figures. */
.figures__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-card);
}

.figures__item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.figures__item--hours {
  grid-column: 1 / -1;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

/* The Dailies close the phone's card, under a hairline of their own. */
.figures__item--dailies {
  grid-column: 1 / -1;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.figures__item .card-title {
  margin: 0;
}

/* The pencil sits in the card's corner; the title keeps clear of it. */
.figures__item--hours .card-title {
  padding-right: var(--tap);
}

.figures__edit {
  position: absolute;
  top: calc(var(--space-2) * -1);
  right: calc(var(--space-2) * -1);
}

.figures__value {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.figures__item--hours .figures__value {
  font-size: clamp(2rem, 9vw, 2.5rem);
  line-height: 1.05;
}

/* The unit sits smaller beside its number, so the number leads. */
.figures__unit {
  color: var(--color-ink-muted);
  font-size: 0.55em;
  font-weight: 700;
  letter-spacing: 0;
}

.figures__note,
.figures__percent {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.figures__goal {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-2);
}

.figures__bar {
  display: block;
  height: 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.figures__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-bar);
  transition: width 240ms var(--ease-out);
}

.figures__editor {
  margin-top: var(--space-3);
}

/* The perfect week in one quiet run of text: "Sport ✓, Lesen 2 von 3". */
.figures__perfect {
  margin-top: var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.figures__perfect-label {
  color: var(--color-ink);
  font-weight: 700;
}

.figures__categories {
  display: inline;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Inline, so the commas and spaces between them flow like a sentence. */
.figures__categories li {
  display: inline;
  font-weight: 700;
}

.figures__swatch {
  display: inline-block;
  margin-right: 0.3rem;
  vertical-align: 0.05em;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 0.15rem;
}

.figures__check {
  margin-left: 0.15rem;
  vertical-align: -0.2em;
  width: 1rem;
  height: 1rem;
  color: var(--color-ink);
  stroke-width: 2.6;
}

.figures__count {
  font-weight: 600;
}

/*
 * From 40rem separate cards, two by two; from 64rem four in a row. The
 * quest hours keep the lift: they are what the week is measured by.
 */
@media (min-width: 40rem) {
  .figures__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0;
    background: none;
    box-shadow: none;
  }

  .figures__item,
  .figures__item--hours,
  .figures__item--dailies {
    grid-column: auto;
    padding: var(--space-4) var(--space-5) var(--space-5);
    border: 0;
    border-radius: var(--radius-card);
    background: var(--color-surface);
  }

  .figures__item--hours {
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-card);
  }

  .figures__edit {
    top: var(--space-2);
    right: var(--space-2);
  }

  .figures__item .figures__value {
    margin-top: var(--space-2);
    font-size: clamp(1.625rem, 3.4vw, 2.25rem);
    line-height: 1.1;
  }

  /* The goal and the perfect week sit on the cards' common bottom edge. */
  .figures__goal,
  .figures__perfect {
    margin-top: auto;
    padding-top: var(--space-3);
  }
}

/* Without the Dailies (their read failed) three cards share the row. */
@media (min-width: 40rem) {
  .figures__list--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 64rem) {
  .figures__list:not(.figures__list--three) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .figures__item .figures__value {
    font-size: clamp(1.625rem, 2.6vw, 2.25rem);
  }
}
</style>
