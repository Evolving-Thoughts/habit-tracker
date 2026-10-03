<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import PushSettings from "./components/PushSettings.vue";
import TimerProvider from "./components/TimerProvider.vue";
import HabitsView from "./views/HabitsView.vue";
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
const activeView = ref<"today" | "todo-dump" | "habits">("today");
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
        type="button"
        :aria-pressed="activeView === 'today'"
        @click="activeView = 'today'"
      >
        Heute
      </button>

      <button
        type="button"
        :aria-pressed="activeView === 'todo-dump'"
        @click="activeView = 'todo-dump'"
      >
        Todo-Dump
      </button>
      <button
        type="button"
        :aria-pressed="activeView === 'habits'"
        @click="activeView = 'habits'"
      >
        Habits
      </button>
      <button type="button" @click="signOut">Abmelden</button>
      <PushSettings />
      <span class="account-email">{{ user.email }}</span>
    </nav>

    <TodayView v-if="activeView === 'today'" />
    <TodoDumpView v-else-if="activeView === 'todo-dump'" />
    <HabitsView v-else />
  </TimerProvider>
</template>

<style scoped>
.account-email {
  align-self: center;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
  min-width: 0;
}
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

.app-navigation button[aria-pressed="true"] {
  border-color: #2457c5;
  background: #2457c5;
  color: #ffffff;
}

@media (max-width: 32rem) {
  .app-navigation {
    width: min(100% - 1rem, 46rem);
  }
}
</style>
