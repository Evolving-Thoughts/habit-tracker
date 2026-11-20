<script setup lang="ts">
import { onMounted, ref } from "vue";
import { getQuestTarget } from "../api/quest-hours.api";
import { notifyDataChanged } from "../composables/data-sync";
import QuestTargetForm from "./QuestTargetForm.vue";

const stored = ref<number | null>(null);
const loaded = ref(false);
const busy = ref(false);
const error = ref("");
const saved = ref("");

async function load(): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    stored.value = (await getQuestTarget()).weeklyTargetMinutes;
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

function onSaved(minutes: number | null): void {
  stored.value = minutes;
  saved.value = minutes === null ? "Kein Wochenziel." : "Gespeichert.";
  notifyDataChanged();
}

onMounted(load);
</script>

<template>
  <div class="quest-target">
    <p class="quest-target__text">
      Zeit auf Quests, die zu einer Kampagne gehören, zählt als
      Kampagnen-Stunden. Heute und der Wochenrückblick zeigen, wie weit du in
      der Woche bist.
    </p>
    <QuestTargetForm
      :minutes="stored"
      :disabled="!loaded"
      @saved="onSaved"
      @submit.capture="saved = ''"
    >
      <template #status>
        <p v-if="saved" class="quest-target__saved" role="status">
          {{ saved }}
        </p>
      </template>
    </QuestTargetForm>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <button
      v-if="!loaded && !busy"
      class="btn btn--quiet"
      type="button"
      @click="load"
    >
      Erneut versuchen
    </button>
  </div>
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

.quest-target__saved {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
