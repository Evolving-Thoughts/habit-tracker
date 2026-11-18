<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getQuestTarget, setQuestTarget } from "../api/quest-hours.api";
import { notifyDataChanged } from "../composables/data-sync";
import {
  MAX_TARGET_HOURS,
  hoursToMinutes,
  minutesToHours,
} from "../utils/quest-hours";

const hours = ref<string | number>("");
const loaded = ref(false);
const busy = ref(false);
const error = ref("");
const saved = ref("");

async function load(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    hours.value = minutesToHours((await getQuestTarget()).weeklyTargetMinutes);
    loaded.value = true;
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : "Das Wochenziel konnte nicht geladen werden.";
  } finally {
    busy.value = false;
  }
}

async function save(): Promise<void> {
  if (busy.value) return;
  error.value = "";
  saved.value = "";
  busy.value = true;
  try {
    const { weeklyTargetMinutes } = await setQuestTarget(
      hoursToMinutes(hours.value),
    );
    hours.value = minutesToHours(weeklyTargetMinutes);
    saved.value =
      weeklyTargetMinutes === null ? "Kein Wochenziel." : "Gespeichert.";
    notifyDataChanged();
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "Das hat nicht geklappt.";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<template>
  <form class="quest-target" novalidate @submit.prevent="save">
    <p class="quest-target__text">
      Zeit auf Quests, die zu einer Kampagne gehören, zählt als Quest-Stunden.
      Heute zeigt, wie weit du in der Woche bist.
    </p>
    <div class="quest-target__row">
      <div class="field">
        <label for="quest-target-hours">Wochenziel in Stunden · optional</label>
        <input
          id="quest-target-hours"
          v-model="hours"
          name="weeklyQuestTarget"
          type="number"
          inputmode="decimal"
          min="0.5"
          :max="MAX_TARGET_HOURS"
          step="0.5"
          :disabled="!loaded"
          aria-describedby="quest-target-hint"
        />
      </div>
      <button class="btn" type="submit" :disabled="busy || !loaded">
        Speichern
      </button>
      <p v-if="saved" class="quest-target__saved" role="status">
        {{ saved }}
      </p>
    </div>
    <small id="quest-target-hint" class="quest-target__hint"
      >Halbe Stunden gehen auch. Leer heißt: kein Ziel.</small
    >
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button
      v-if="!loaded && !busy"
      class="btn btn--quiet"
      type="button"
      @click="load"
    >
      Erneut versuchen
    </button>
  </form>
</template>

<style scoped>
.quest-target {
  display: grid;
  gap: var(--space-2);
}

.quest-target p {
  margin: 0;
}

.quest-target__text {
  color: var(--color-ink-muted);
}

.quest-target__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: end;
}

.quest-target__row .field {
  flex: 1 1 10rem;
  max-width: 14rem;
}

.quest-target__saved {
  align-self: center;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.quest-target__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
