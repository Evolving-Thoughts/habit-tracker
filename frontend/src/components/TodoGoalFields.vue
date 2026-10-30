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
  <label for="todo-period-start">Zeitraum von · optional</label>
  <input
    id="todo-period-start"
    v-model="periodStart"
    name="periodStart"
    type="date"
  />
  <label for="todo-period-end">Zeitraum bis · optional</label>
  <input id="todo-period-end" v-model="periodEnd" name="periodEnd" type="date" />

  <label for="todo-goal-habit">Habit-Ziel · optional</label>
  <select id="todo-goal-habit" v-model="habitId" name="goalHabit">
    <option :value="null">Keines</option>
    <option v-for="habit in habits" :key="habit.id" :value="habit.id">
      {{ habit.title }}
    </option>
  </select>
  <template v-if="habitId !== null">
    <label for="todo-goal-target">Sollmenge im Zeitraum</label>
    <input
      id="todo-goal-target"
      v-model="target"
      name="goalTarget"
      type="number"
      min="1"
      step="1"
    />
    <small>Erledigte Ausführungen zählen. Ein Habit zählt je Zeitraum für ein Ziel.</small>
  </template>
</template>
