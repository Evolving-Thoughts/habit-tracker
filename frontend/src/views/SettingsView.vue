<script setup lang="ts">
import CalendarConnection from "../components/CalendarConnection.vue";
</script>

<template>
  <main class="settings-view">
    <h1>Einstellungen</h1>
    <h2>Google Kalender</h2>
    <CalendarConnection />
  </main>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 1rem;
  width: min(100%, 46rem);
  margin: 0 auto;
  padding: 1.5rem 1rem;
  box-sizing: border-box;
}

.settings-view h1,
.settings-view h2 {
  margin: 0;
}

.settings-view h2 {
  font-size: 1.125rem;
}
</style>
