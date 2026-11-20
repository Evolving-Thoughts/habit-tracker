<script setup lang="ts">
import { computed } from "vue";
import { durationParts, type FigurePart } from "../utils/week-review";

/**
 * The strip above the campaign tiles: campaign hours this week and ever,
 * how many campaigns are running and how many are done. Numbers only; a
 * figure that is not loaded is "–".
 */
const props = defineProps<{
  /** Quest minutes this week; null while the hours are not loaded. */
  weekMinutes: number | null;
  /** Every quest minute ever measured; null while not loaded. */
  totalMinutes: number | null;
  active: number;
  done: number;
}>();

const UNKNOWN: FigurePart[] = [{ value: "–", unit: "" }];
const hours = (minutes: number | null): FigurePart[] =>
  minutes === null ? UNKNOWN : durationParts(minutes);
const count = (value: number): FigurePart[] => [
  { value: String(value), unit: "" },
];

const cells = computed(() => [
  {
    key: "week",
    label: "Kampagnen-Stunden diese Woche",
    parts: hours(props.weekMinutes),
  },
  {
    key: "total",
    label: "Kampagnen-Stunden insgesamt",
    parts: hours(props.totalMinutes),
  },
  { key: "active", label: "Kampagnen aktiv", parts: count(props.active) },
  { key: "done", label: "Kampagnen abgeschlossen", parts: count(props.done) },
]);
</script>

<template>
  <section class="campaign-stats" aria-labelledby="campaign-stats-title">
    <h2 id="campaign-stats-title" class="visually-hidden">
      Kampagnen in Zahlen
    </h2>
    <dl class="campaign-stats__list">
      <div
        v-for="cell in cells"
        :key="cell.key"
        class="campaign-stats__cell"
        :data-stat="cell.key"
      >
        <dt class="card-title">{{ cell.label }}</dt>
        <!-- "43 Std. 20 Min.": a line may break between the parts, never inside one. -->
        <dd class="campaign-stats__value">
          <template v-for="(part, index) in cell.parts" :key="index"
            >{{ index ? " " : ""
            }}<span class="campaign-stats__part"
              >{{ part.value
              }}<template v-if="part.unit"
                >{{ " " }}<span class="campaign-stats__unit">{{
                  part.unit
                }}</span></template
              ></span
            ></template
          >
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
/* One flat card; two cells a row on a phone, four from 40rem. */
.campaign-stats__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.campaign-stats__cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-3) var(--space-4);
}

/* Hairlines between the cells, never around the card. */
.campaign-stats__cell:nth-child(odd) {
  border-right: 1px solid var(--color-line);
}

.campaign-stats__cell:nth-child(-n + 2) {
  border-bottom: 1px solid var(--color-line);
}

.campaign-stats__cell .card-title {
  margin: 0;
}

.campaign-stats__value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.campaign-stats__part {
  white-space: nowrap;
}

/* The unit sits smaller beside its number, so the number leads. */
.campaign-stats__unit {
  color: var(--color-ink-muted);
  font-size: 0.55em;
  font-weight: 700;
  letter-spacing: 0;
}

@media (min-width: 40rem) {
  .campaign-stats__list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .campaign-stats__cell,
  .campaign-stats__cell:nth-child(odd),
  .campaign-stats__cell:nth-child(-n + 2) {
    border: 0;
  }

  .campaign-stats__cell + .campaign-stats__cell {
    border-left: 1px solid var(--color-line);
  }

  .campaign-stats__value {
    font-size: clamp(1.5rem, 3vw, 2rem);
  }
}
</style>
