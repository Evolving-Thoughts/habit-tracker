<script setup lang="ts">
import { ref } from "vue";
import AppIcon from "./AppIcon.vue";
import PlanEntry from "./PlanEntry.vue";
import { useSortable } from "../composables/useSortable";
import type { WeekPlanEntry } from "../types/week-plan";
import type { MenuEntry } from "../utils/row-actions";
import {
  boardDrop,
  DRAGGABLE,
  entryKey,
  isMovable,
  isMovableRun,
  type BoardDrop,
} from "../utils/week-plan";

/**
 * What was left behind (Liegen geblieben): open quests and daily runs from
 * an earlier day, the same ones Heute offers under Nachholen. A quest drags
 * onto a day of the board or into the Questlog column, a run onto a day of
 * its window, or either moves through its menu; the column itself takes
 * nothing back and keeps the earliest first.
 */
const props = withDefaults(defineProps<{
  open?: boolean;
  entries: WeekPlanEntry[];
  busy: boolean;
  /** "Aktionen für …" of an open entry. */
  menu: (entry: WeekPlanEntry) => MenuEntry[];
}>(), { open: true });

const emit = defineEmits<{
  toggle: [];
  edit: [entry: WeekPlanEntry];
  /** An entry was dropped on a day (a quest also into the Questlog column). */
  move: [drop: BoardDrop];
}>();

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: DRAGGABLE,
  group: "week-plan",
  accepts: () => false,
  sort: false,
  onMove: (_from, _to, { item, list: target, index }) => {
    const drop = boardDrop(item, target, index);
    if (drop && !props.busy) emit("move", drop);
  },
});
</script>

<template>
  <section class="plan-overdue" :class="{ 'plan-overdue--closed': !open }" aria-labelledby="plan-overdue-title">
    <header class="plan-overdue__header">
      <button type="button" class="btn btn--quiet btn--icon plan-overdue__toggle" :aria-label="open ? 'Liegen geblieben ausblenden' : 'Liegen geblieben einblenden'" :aria-expanded="open" aria-controls="plan-overdue-list" @click="emit('toggle')"><AppIcon :name="open ? 'chevron-left' : 'chevron'" /></button>
      <h2 id="plan-overdue-title" class="plan-overdue__title">
        Liegen geblieben
        <span class="count">{{ entries.length }}</span>
      </h2>
      <p v-if="open" class="plan-overdue__lead">
        Auf einen Tag ziehen oder über „…“ verschieben.
      </p>
    </header>
    <ol v-show="open" id="plan-overdue-list" ref="list" class="plan-overdue__list" aria-label="Liegen geblieben">
      <li
        v-for="entry in entries"
        :key="entryKey(entry, 'overdue')"
        :data-focus-key="entryKey(entry, 'overdue')"
        :data-todo-id="isMovable(entry) ? entry.todoId : undefined"
        :data-run-id="isMovableRun(entry) ? entry.occurrenceId : undefined"
      >
        <PlanEntry
          :entry="entry"
          :busy="busy"
          :menu="menu(entry)"
          @edit="emit('edit', entry)"
        />
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* A column like a day's, without a day: it only gives quests away. */
.plan-overdue {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3) 0.375rem 0.375rem;
  border-radius: var(--radius-card);
  background: var(--color-surface-faint);
}

.plan-overdue__header {
  padding: 0 0.625rem;
}

.plan-overdue__title {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}

.plan-overdue__title .count {
  font-size: 0.875rem;
}

.plan-overdue__lead {
  margin: 0.125rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.plan-overdue__list {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  margin: 0;
  padding: 0;
  list-style: none;
}
.plan-overdue__toggle { float: right; }
.plan-overdue--closed, .plan-overdue--closed .plan-overdue__header { padding-inline: 0; }
.plan-overdue--closed .plan-overdue__title { writing-mode: vertical-rl; margin: var(--space-2) auto; clear: both; }
</style>
