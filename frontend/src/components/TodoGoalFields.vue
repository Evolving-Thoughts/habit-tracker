<script setup lang="ts">
import { onMounted, ref } from "vue";
import { request } from "../api/http";

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
</script>

<template>
  <div class="goal-fields__row">
    <label class="field">
      Zeitraum von · optional
      <input v-model="periodStart" name="periodStart" type="date" />
    </label>
    <label class="field">
      Zeitraum bis · optional
      <input v-model="periodEnd" name="periodEnd" type="date" />
    </label>
  </div>

  <label class="field">
    Zählt für ein Habit · optional
    <select v-model="habitId" name="goalHabit">
      <option :value="null">Keines</option>
      <option v-for="habit in habits" :key="habit.id" :value="habit.id">
        {{ habit.title }}
      </option>
    </select>
  </label>
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
      >Jede erledigte Ausführung des Habits zählt mit.</small
    >
  </div>
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
