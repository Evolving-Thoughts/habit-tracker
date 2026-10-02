<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getToday } from "../api/day-planner.api";
import type { DayPlannerResponse } from "../types/day-planner";

const planner = ref<DayPlannerResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

async function loadToday(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    planner.value = await getToday();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Unknown error";
  } finally {
    isLoading.value = false;
  }
}

onMounted(loadToday);
</script>

<template>
  <main>
    <h1>Heute</h1>

    <p v-if="isLoading">Tagesplan wird geladen …</p>

    <p v-else-if="errorMessage">
      {{ errorMessage }}
    </p>

    <pre v-else>{{ planner }}</pre>
  </main>
</template>
