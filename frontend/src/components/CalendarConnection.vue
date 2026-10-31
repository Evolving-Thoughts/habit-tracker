<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  disconnectCalendar,
  getCalendarStatus,
  setCalendarBlocksPlanning,
  startCalendarConnection,
  syncCalendar,
  type CalendarStatus,
} from "../api/calendar.api";
import { notifyDataChanged } from "../composables/data-sync";

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

async function setBlocks(id: string, value: boolean): Promise<void> {
  await run(() => setCalendarBlocksPlanning(id, value));
}

async function disconnect(): Promise<void> {
  const confirmed = window.confirm(
    "Verbindung trennen? Termine bleiben in Google, Todos bleiben in der App.",
  );
  if (confirmed) await run(disconnectCalendar);
}

onMounted(() => run(() => Promise.resolve()));
</script>

<template>
  <section
    v-if="status?.configured"
    class="calendar-connection"
    aria-label="Google Kalender"
  >
    <p v-if="status.connected">
      Google Kalender verbunden<template v-if="status.lastSyncedAt">
        · zuletzt abgeglichen
        {{ new Date(status.lastSyncedAt).toLocaleString("de-DE") }}</template
      >
    </p>
    <p v-else-if="status.revoked">
      Google hat den Zugriff beendet. Bitte neu verbinden.
    </p>
    <p v-else>Google Kalender ist nicht verbunden.</p>
    <p v-if="status.connected && status.lastError" role="alert">
      {{ status.lastError }}
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="status.connected && status.needsConsent">
      Für weitere Kalender braucht die App eine neue Berechtigung.
    </p>
    <fieldset
      v-if="status.connected && status.calendars?.length"
      class="calendar-connection__calendars"
    >
      <legend>Hindernis bei „Neu planen“</legend>
      <label v-for="calendar in status.calendars" :key="calendar.id">
        <input
          type="checkbox"
          :checked="calendar.blocksPlanning"
          :disabled="busy"
          @change="
            setBlocks(
              calendar.id,
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        {{ calendar.title }}
      </label>
    </fieldset>
    <div class="calendar-connection__actions">
      <button
        v-if="!status.connected"
        type="button"
        :disabled="busy"
        @click="connect"
      >
        Verbinden
      </button>
      <template v-else>
        <button
          v-if="status.needsConsent"
          type="button"
          :disabled="busy"
          @click="connect"
        >
          Berechtigungen erneuern
        </button>
        <button type="button" :disabled="busy" @click="syncNow">
          Jetzt abgleichen
        </button>
        <button type="button" :disabled="busy" @click="disconnect">
          Trennen
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
.calendar-connection {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  font-size: 0.875rem;
}

.calendar-connection p {
  margin: 0;
}

.calendar-connection__calendars {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.5rem;
}

.calendar-connection__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
