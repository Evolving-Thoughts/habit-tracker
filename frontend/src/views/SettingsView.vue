<script setup lang="ts">
import AppIcon from "../components/AppIcon.vue";
import CalendarConnection from "../components/CalendarConnection.vue";
import PushSettings from "../components/PushSettings.vue";
import QuestTargetSetting from "../components/QuestTargetSetting.vue";
import ShortcutSettings from "../components/ShortcutSettings.vue";
import ThemeSetting from "../components/ThemeSetting.vue";
import { useKeyboardLikely } from "../composables/useShortcuts";

defineProps<{ email: string }>();
defineEmits<{ signOut: [] }>();
// Only where a keyboard is likely; a phone has no keys to switch off.
const keyboardLikely = useKeyboardLikely();
</script>

<template>
  <main class="page settings-view">
    <header class="page-header">
      <h1 class="page-title">Einstellungen</h1>
    </header>

    <div class="settings-view__sections">
      <section class="card" aria-labelledby="settings-quest-hours">
        <h2 id="settings-quest-hours" class="section-title">
          Wochenziel Quest-Stunden
        </h2>
        <QuestTargetSetting />
      </section>

      <section class="card" aria-labelledby="settings-theme">
        <h2 id="settings-theme" class="section-title">Darstellung</h2>
        <ThemeSetting />
      </section>

      <section class="card" aria-labelledby="settings-push">
        <h2 id="settings-push" class="section-title">Benachrichtigungen</h2>
        <PushSettings />
      </section>

      <section class="card" aria-labelledby="settings-calendar">
        <h2 id="settings-calendar" class="section-title">Google Kalender</h2>
        <CalendarConnection />
      </section>

      <section
        v-if="keyboardLikely"
        class="card"
        aria-labelledby="settings-shortcuts"
      >
        <h2 id="settings-shortcuts" class="section-title">Tastatur</h2>
        <ShortcutSettings />
      </section>

      <section class="card" aria-labelledby="settings-account">
        <h2 id="settings-account" class="section-title">Konto</h2>
        <div class="settings-view__account">
          <p class="settings-view__email">
            Angemeldet als <strong>{{ email }}</strong>
          </p>
          <button
            class="btn btn--quiet"
            type="button"
            @click="$emit('signOut')"
          >
            <AppIcon name="logout" />
            Abmelden
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.settings-view__sections {
  display: grid;
  gap: var(--space-3);
}

.settings-view__sections > .card {
  padding: var(--space-5);
}

.settings-view .section-title {
  margin: 0 0 var(--space-3);
}

.settings-view__account {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  align-items: center;
  justify-content: space-between;
}

.settings-view__email {
  margin: 0;
  min-width: 0;
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
}

.settings-view__email strong {
  color: var(--color-ink);
  font-weight: 700;
}

/* The quiet button sits at the card's edge; pull it in line with the text. */
.settings-view__account .btn {
  margin-inline-end: calc(var(--space-2) * -1);
}

@media (max-width: 32rem) {
  .settings-view__sections > .card {
    padding: var(--space-4);
  }
}
</style>
