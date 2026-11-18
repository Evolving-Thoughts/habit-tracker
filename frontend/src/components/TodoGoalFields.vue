<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { request } from "../api/http";
import { formatDateForGermanDisplay } from "../utils/date";
import FormDisclosure from "./FormDisclosure.vue";

/**
 * "Ziel mit Daily": a quest counts the runs of a daily in a period. The
 * period means nothing without the daily, so it lives only in here.
 */
const periodStart = defineModel<string>("periodStart", { required: true });
const periodEnd = defineModel<string>("periodEnd", { required: true });
const habitId = defineModel<number | null>("habitId", { required: true });
const target = defineModel<string | number>("target", { required: true });

const habits = ref<{ id: number; title: string }[]>([]);

onMounted(async () => {
  try {
    habits.value = await request<{ id: number; title: string }[]>("/habits");
  } catch {
    // The rest of the editor stays usable without the habit list.
    habits.value = [];
  }
});

const hasPeriod = computed(() => !!periodStart.value || !!periodEnd.value);
// An old period without a daily stays visible, so it can be cleared.
const showsPeriod = computed(() => habitId.value !== null || hasPeriod.value);

const shortDate = (date: string) => formatDateForGermanDisplay(date).slice(0, 6);
/** "Joggen, 20-mal · 01.11.–30.11.": what is set, for the closed button. */
const summary = computed(() => {
  const parts: string[] = [];
  if (habitId.value !== null) {
    const title =
      habits.value.find((habit) => habit.id === habitId.value)?.title ??
      "Daily";
    parts.push(String(target.value).trim() ? `${title}, ${target.value}-mal` : title);
  }
  if (hasPeriod.value)
    parts.push(
      `${periodStart.value ? shortDate(periodStart.value) : "…"}–${periodEnd.value ? shortDate(periodEnd.value) : "…"}`,
    );
  return parts.join(" · ");
});
</script>

<template>
  <FormDisclosure
    label="Ziel mit Daily"
    detail="Daily und Zeitraum"
    :summary="summary"
    :start-open="habitId !== null || hasPeriod"
  >
    <label class="field">
      Zählt für ein Daily
      <select v-model="habitId" name="goalHabit">
        <option :value="null">Keines</option>
        <option v-for="habit in habits" :key="habit.id" :value="habit.id">
          {{ habit.title }}
        </option>
      </select>
    </label>
    <template v-if="showsPeriod">
      <div class="goal-fields__row">
        <label class="field">
          Zeitraum von
          <input v-model="periodStart" name="periodStart" type="date" />
        </label>
        <label class="field">
          Zeitraum bis
          <input v-model="periodEnd" name="periodEnd" type="date" />
        </label>
      </div>
      <div v-if="habitId !== null" class="field">
        <label for="todo-goal-target">Wie oft im Zeitraum?</label>
        <input
          id="todo-goal-target"
          v-model="target"
          name="goalTarget"
          type="number"
          min="1"
          step="1"
          aria-describedby="todo-goal-hint"
        />
        <small id="todo-goal-hint" class="goal-fields__hint"
          >Jede erledigte Ausführung des Dailys zählt mit.</small
        >
      </div>
    </template>
  </FormDisclosure>
</template>

<style scoped>
.goal-fields__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.goal-fields__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
@media (max-width: 32rem) {
  .goal-fields__row {
    grid-template-columns: 1fr;
  }
}
</style>
