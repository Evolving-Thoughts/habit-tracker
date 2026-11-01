<script setup lang="ts">
import CalendarConnection from "../components/CalendarConnection.vue";
import DayEndSetting from "../components/DayEndSetting.vue";
import PushSettings from "../components/PushSettings.vue";

defineProps<{ email: string }>();
defineEmits<{ signOut: [] }>();
</script>

<template>
  <main class="settings-view">
    <h1>Einstellungen</h1>
    <section aria-labelledby="settings-calendar">
      <h2 id="settings-calendar">Google Kalender</h2>
      <CalendarConnection />
    </section>
    <section aria-labelledby="settings-planning">
      <h2 id="settings-planning">Planung</h2>
      <DayEndSetting />
    </section>
    <section aria-labelledby="settings-push">
      <h2 id="settings-push">Timer-Benachrichtigungen</h2>
      <PushSettings />
    </section>
    <section aria-labelledby="settings-account">
      <h2 id="settings-account">Konto</h2>
      <p class="settings-view__email">{{ email }}</p>
      <button type="button" @click="$emit('signOut')">Abmelden</button>
    </section>
  </main>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 1.5rem;
  width: min(100%, 46rem);
  margin: 0 auto;
  padding: 1.5rem 1rem;
  box-sizing: border-box;
}

.settings-view h1,
.settings-view h2,
.settings-view p {
  margin: 0;
}

.settings-view h2 {
  font-size: 1.125rem;
}

.settings-view section {
  display: grid;
  gap: 0.5rem;
  justify-items: start;
}

.settings-view section > :deep(*) {
  max-width: 100%;
  box-sizing: border-box;
}

.settings-view__email {
  overflow-wrap: anywhere;
}

.settings-view button {
  min-height: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #fff;
  color: #2f3a4f;
  font: inherit;
  cursor: pointer;
}
</style>
