<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  disconnectCalendar,
  getCalendarStatus,
  startCalendarConnection,
  syncCalendar,
  type CalendarStatus,
} from "../api/calendar.api";
import { notifyDataChanged } from "../composables/data-sync";
import AppIcon from "./AppIcon.vue";

const status = ref<CalendarStatus | null>(null);
const busy = ref(false);
const error = ref("");

async function run(work: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await work();
    status.value = await getCalendarStatus();
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "Das hat nicht geklappt.";
  } finally {
    busy.value = false;
  }
}

async function connect(): Promise<void> {
  await run(async () => {
    window.location.assign((await startCalendarConnection()).url);
  });
}

async function syncNow(): Promise<void> {
  await run(async () => {
    await syncCalendar();
    notifyDataChanged();
  });
}

async function disconnect(): Promise<void> {
  const confirmed = window.confirm(
    "Verbindung trennen? Termine bleiben in Google, Quests bleiben in der App.",
  );
  if (confirmed) await run(disconnectCalendar);
}

/** "12.11. um 09:30 Uhr": German, without seconds. */
function formatSynced(value: string): string {
  const date = new Date(value);
  const day = date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} um ${time} Uhr`;
}

onMounted(() => run(() => Promise.resolve()));
</script>

<template>
  <div v-if="status?.configured" class="calendar-connection">
    <p v-if="status.connected" class="calendar-connection__state">
      <AppIcon name="check" class="calendar-connection__check" />
      <span>
        Verbunden<template v-if="status.lastSyncedAt"
          >, zuletzt abgeglichen am
          {{ formatSynced(status.lastSyncedAt) }}</template
        >
      </span>
    </p>
    <p v-else-if="status.revoked" class="calendar-connection__text">
      Google hat den Zugriff beendet. Bitte neu verbinden.
    </p>
    <p v-else class="calendar-connection__text">
      Verbinde deinen Google Kalender, damit deine Termine neben deinen Quests
      stehen.
    </p>
    <p
      v-if="status.connected && status.lastError"
      class="form-error"
      role="alert"
    >
      {{ status.lastError }}
    </p>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p
      v-if="status.connected && status.needsConsent"
      class="calendar-connection__text"
    >
      Für weitere Kalender braucht die App eine neue Berechtigung.
    </p>
    <div
      v-if="status.connected && status.calendars?.length"
      class="calendar-connection__calendars"
    >
      <p class="calendar-connection__legend">
        Termine aus diesen Kalendern zeigt die App an
      </p>
      <ul>
        <li v-for="calendar in status.calendars" :key="calendar.id">
          {{ calendar.title }}
        </li>
      </ul>
      <p class="calendar-connection__text">
        Geschrieben wird nur in den eigenen Kalender „Habit Tracker“: deine
        festen Termine. In andere Kalender schreibt die App nie.
      </p>
    </div>
    <div class="calendar-connection__actions">
      <button
        v-if="!status.connected"
        class="btn"
        type="button"
        :disabled="busy"
        @click="connect"
      >
        Verbinden
      </button>
      <template v-else>
        <button
          v-if="status.needsConsent"
          class="btn"
          type="button"
          :disabled="busy"
          @click="connect"
        >
          Berechtigungen erneuern
        </button>
        <button class="btn" type="button" :disabled="busy" @click="syncNow">
          <AppIcon name="refresh" />
          Jetzt abgleichen
        </button>
        <button
          class="btn btn--quiet"
          type="button"
          :disabled="busy"
          @click="disconnect"
        >
          Trennen
        </button>
      </template>
    </div>
  </div>
  <p v-else-if="error" class="form-error" role="alert">{{ error }}</p>
  <p v-else-if="status" class="calendar-connection__text">
    Google Kalender ist für diese App nicht eingerichtet.
  </p>
</template>

<style scoped>
.calendar-connection {
  display: grid;
  gap: var(--space-3);
}

.calendar-connection p,
p.calendar-connection__text {
  margin: 0;
}

.calendar-connection__text {
  max-width: 60ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.calendar-connection__state {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  color: var(--color-ink);
  font-weight: 600;
}

.calendar-connection__check {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.0625rem;
  color: var(--color-success);
}

.calendar-connection__calendars {
  display: grid;
  gap: var(--space-2);
}

.calendar-connection__legend {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.calendar-connection__calendars ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.calendar-connection__calendars li {
  display: flex;
  align-items: center;
  min-height: var(--tap);
  overflow-wrap: anywhere;
}

.calendar-connection__calendars li + li {
  border-top: 1px solid var(--color-line);
}

.calendar-connection__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
