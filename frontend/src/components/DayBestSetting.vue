<script setup lang="ts">
import { computed, ref } from "vue";
import {
  getDayBestSettings,
  saveDayBestSettings,
} from "../api/day-bests.api";
import { useLoader } from "../composables/useLoader";
import type { DayBestSettings } from "../types/day-best";
import { minutesOfTime } from "../utils/day-best";

/**
 * Einstellungen › Das Beste des Tages: from when Heute asks for the line,
 * and whether an evening push reminds an hour later. Both are stored on
 * the server, so they hold on every device; each change saves at once.
 */
const {
  data: settings,
  isLoading,
  errorMessage: loadError,
  reload,
} = useLoader<DayBestSettings | null>((signal) => getDayBestSettings(signal), {
  initial: null,
  fallbackError: "Die Einstellungen konnten nicht geladen werden.",
});

const busy = ref(false);
const saved = ref("");
const saveError = ref("");
const time = ref<string | null>(null);
const shownTime = computed(() => time.value ?? settings.value?.cardTime ?? "");
/* The reminder needs an hour before midnight. */
const tooLate = computed(
  () => !!shownTime.value && minutesOfTime(shownTime.value) >= 23 * 60,
);

/** Counts saves: only the answer to the latest one is shown. */
let revision = 0;
async function save(change: Partial<DayBestSettings>): Promise<void> {
  const current = ++revision;
  busy.value = true;
  saved.value = "";
  saveError.value = "";
  try {
    const result = await saveDayBestSettings(change);
    if (current !== revision) return;
    settings.value = result;
    // The field shows the stored time again, unless more was typed since.
    if (change.cardTime !== undefined && time.value === change.cardTime)
      time.value = null;
    saved.value = "Gespeichert.";
  } catch (cause) {
    if (current !== revision) return;
    saveError.value =
      cause instanceof Error
        ? cause.message
        : "Die Einstellung konnte nicht gespeichert werden.";
  } finally {
    if (current === revision) busy.value = false;
  }
}

function onTime(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  time.value = value;
  // An emptied or half-typed field waits; only a whole time is saved.
  if (!/^\d{2}:\d{2}$/.test(value) || value === settings.value?.cardTime)
    return;
  void save({ cardTime: value });
}
</script>

<template>
  <div class="day-best-setting">
    <p class="day-best-setting__text">
      Jeden Abend eine Zeile: was das Beste am Tag war. Ab der Uhrzeit fragt
      Heute danach; vorher bleibt die Karte weg.
    </p>
    <label class="field day-best-setting__time">
      Heute fragt ab
      <input
        type="time"
        name="dayBestCardTime"
        step="60"
        required
        :value="shownTime"
        :disabled="!settings"
        @change="onTime"
      />
    </label>
    <div class="day-best-setting__row">
      <span id="day-best-reminder-label" class="day-best-setting__label">
        Abends an das Beste des Tages erinnern
      </span>
      <button
        class="switch"
        type="button"
        role="switch"
        aria-labelledby="day-best-reminder-label"
        aria-describedby="day-best-reminder-text"
        :aria-checked="settings?.reminderEnabled ?? true"
        :disabled="!settings || busy"
        @click="save({ reminderEnabled: !settings?.reminderEnabled })"
      >
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </div>
    <p id="day-best-reminder-text" class="day-best-setting__text">
      Eine Stunde nach dieser Uhrzeit, wenn der Tag noch keine Zeile hat,
      höchstens einmal am Tag. Kommt nur auf Geräten, auf denen
      Benachrichtigungen eingeschaltet sind.
      <template v-if="tooLate">
        Ab 23 Uhr bleibt dafür vor Mitternacht keine Stunde, dann gibt es keine
        Erinnerung.
      </template>
    </p>
    <p class="day-best-setting__saved" role="status">{{ saved }}</p>
    <p v-if="saveError || loadError" class="form-error" role="alert">
      {{ saveError || loadError }}
    </p>
    <button
      v-if="loadError && !isLoading"
      class="btn btn--quiet"
      type="button"
      @click="reload()"
    >
      Erneut versuchen
    </button>
  </div>
</template>

<style scoped>
.day-best-setting {
  display: grid;
  gap: var(--space-2);
}

.day-best-setting p {
  margin: 0;
}

.day-best-setting__text {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.day-best-setting__time {
  justify-self: start;
  margin-top: var(--space-2);
}

.day-best-setting__time input {
  width: auto;
  min-width: 8rem;
  font-variant-numeric: tabular-nums;
}

.day-best-setting__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
  margin-top: var(--space-2);
}

.day-best-setting__label {
  font-weight: 700;
}

.day-best-setting__saved {
  min-height: 1.25rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
