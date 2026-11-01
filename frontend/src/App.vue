<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import TimerProvider from "./components/TimerProvider.vue";
import TodoHierarchyView from "./views/TodoHierarchyView.vue";
import HistoryView from "./views/HistoryView.vue";
import CalendarView from "./views/CalendarView.vue";
import CategoriesView from "./views/CategoriesView.vue";
import HabitsView from "./views/HabitsView.vue";
import SettingsView from "./views/SettingsView.vue";
import TodayView from "./views/TodayView.vue";
import TodoDumpView from "./views/TodoDumpView.vue";

import AuthView from "./views/AuthView.vue";
import { getMe, logout } from "./api/auth.api";
import type { User } from "./api/auth.api";
const user = ref<User | null>(null);
const loading = ref(true);
const error = ref("");
const authViewKey = ref(0);
const link = ref<{ kind: "verify" | "reset"; token: string } | undefined>();
function readLink(): void {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const kind = params.has("verify")
    ? "verify"
    : params.has("reset")
      ? "reset"
      : null;
  if (kind) {
    authViewKey.value += 1;
    link.value = { kind, token: params.get(kind)! };
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
}
readLink();
function clearLink(): void {
  if (link.value) user.value = null;
  link.value = undefined;
}
async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    user.value = await getMe();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Backend nicht erreichbar";
  } finally {
    loading.value = false;
  }
}
function expire(): void {
  user.value = null;
  activeView.value = "today";
}
async function signOut(): Promise<void> {
  try {
    await logout();
    expire();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Abmelden fehlgeschlagen";
  }
}
onMounted(() => {
  void load();
  window.addEventListener("auth-expired", expire);
  window.addEventListener("hashchange", readLink);
});
onUnmounted(() => {
  window.removeEventListener("auth-expired", expire);
  window.removeEventListener("hashchange", readLink);
});
function readCalendarReturn(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("calendar")) return false;
  url.searchParams.delete("calendar");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  return true;
}
const VIEWS = [
  { key: "today", label: "Heute", view: TodayView },
  { key: "todo-dump", label: "Todo-Dump", view: TodoDumpView },
  { key: "hierarchy", label: "Aufgabenbaum", view: TodoHierarchyView },
  { key: "habits", label: "Habits", view: HabitsView },
  { key: "categories", label: "Kategorien", view: CategoriesView },
  { key: "history", label: "Verlauf", view: HistoryView },
  { key: "calendar", label: "Kalender", view: CalendarView },
] as const;
const activeView = ref<(typeof VIEWS)[number]["key"] | "settings">(
  readCalendarReturn() ? "settings" : "today",
);
const shownView = computed(
  () => VIEWS.find(({ key }) => key === activeView.value)?.view,
);
</script>

<template>
  <main v-if="loading" class="app-navigation" role="status">
    Anmeldung wird geprüft …
  </main>
  <main v-else-if="error" class="app-navigation">
    <p role="alert">{{ error }}</p>
    <button type="button" @click="load">Erneut versuchen</button>
  </main>
  <AuthView
    v-else-if="!user || link"
    :key="authViewKey"
    :link="link"
    @authenticated="
      user = $event;
      activeView = 'today';
    "
    @link-cleared="clearLink"
  />
  <TimerProvider v-else :key="user.id">
    <nav class="app-navigation" aria-label="Ansichten">
      <button
        v-for="{ key, label } in VIEWS"
        :key="key"
        type="button"
        :aria-pressed="activeView === key"
        @click="activeView = key"
      >
        {{ label }}
      </button>
      <button
        type="button"
        class="app-navigation__settings"
        aria-label="Einstellungen"
        :aria-pressed="activeView === 'settings'"
        @click="activeView = 'settings'"
      >
        ⋮
      </button>
    </nav>

    <SettingsView
      v-if="activeView === 'settings'"
      :email="user.email"
      @sign-out="signOut"
    />
    <component :is="shownView" v-else />
  </TimerProvider>
</template>

<style scoped>
.app-navigation {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding-top: 1rem;
}

.app-navigation button {
  min-height: 2.75rem;
  padding: 0.65rem 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #2f3a4f;
  font: inherit;
  cursor: pointer;
}

.app-navigation .app-navigation__settings {
  position: absolute;
  top: 1rem;
  right: 0.75rem;
  width: 2.75rem;
  padding: 0;
  font-size: 1.25rem;
  line-height: 1;
}

.app-navigation button[aria-pressed="true"] {
  border-color: #2457c5;
  background: #2457c5;
  color: #ffffff;
}

@media (max-width: 56rem) {
  .app-navigation {
    box-sizing: border-box;
    padding-right: 3.5rem;
  }
}

@media (max-width: 32rem) {
  .app-navigation {
    width: min(100% - 1rem, 46rem);
  }
}
</style>
