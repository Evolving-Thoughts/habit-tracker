<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import AppNavigation from "./components/AppNavigation.vue";
import AppShortcuts from "./components/AppShortcuts.vue";
import TimerProvider from "./components/TimerProvider.vue";
import AuthView from "./views/AuthView.vue";
import { getMe, logout } from "./api/auth.api";
import type { User } from "./api/auth.api";
import type { AuthLink } from "./router";

const router = useRouter();
const route = useRoute();
const user = ref<User | null>(null);
const loading = ref(true);
/** Boot failure: null detail means the server could not be reached at all. */
const error = ref<{ detail: string | null } | null>(null);
function bootError(
  cause: unknown,
  fallback: string,
): { detail: string | null } {
  // fetch() rejects with a TypeError ("Failed to fetch") when offline.
  if (cause instanceof TypeError) return { detail: null };
  return { detail: cause instanceof Error ? cause.message : fallback };
}
const authViewKey = ref(0);
const link = ref<AuthLink | undefined>();
// An email link lands on its own route; take the token and leave the route,
// so the token is gone from the address bar and the history.
watch(
  () => route.meta.authLink && String(route.params.token),
  (token) => {
    if (!token || !route.meta.authLink) return;
    authViewKey.value += 1;
    link.value = { kind: route.meta.authLink, token };
    void router.replace({ name: "today" });
  },
  { immediate: true },
);
function clearLink(): void {
  if (link.value) user.value = null;
  link.value = undefined;
}
async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    user.value = await getMe();
  } catch (cause) {
    error.value = bootError(cause, "Der Server antwortet gerade nicht.");
  } finally {
    loading.value = false;
  }
}
function expire(): void {
  user.value = null;
  void router.replace({ name: "today" });
}
async function signOut(): Promise<void> {
  try {
    await logout();
    expire();
  } catch (cause) {
    error.value = bootError(cause, "Abmelden hat nicht geklappt.");
  }
}
/** Google sends the browser back with ?calendar=…; that belongs to settings. */
function readCalendarReturn(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("calendar")) return;
  url.searchParams.delete("calendar");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  void router.replace({ name: "settings" });
}
readCalendarReturn();

// A new view starts at its top, with the keyboard and screen reader in it.
watch(
  () => route.name,
  async () => {
    await nextTick();
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  },
);
onMounted(() => {
  void load();
  window.addEventListener("auth-expired", expire);
});
onUnmounted(() => {
  window.removeEventListener("auth-expired", expire);
});
</script>

<template>
  <main v-if="loading" class="app-navigation" role="status">
    Anmeldung wird geprüft …
  </main>
  <main v-else-if="error" class="boot-error">
    <section class="boot-error__card card" role="alert">
      <h1 class="boot-error__title">Keine Verbindung zum Server</h1>
      <p v-if="error.detail" class="boot-error__detail">{{ error.detail }}</p>
      <p class="boot-error__line">
        Deine Daten sind sicher. Prüfe die Verbindung und versuch es noch
        einmal.
      </p>
      <button type="button" class="btn btn--primary" @click="load">
        Erneut versuchen
      </button>
    </section>
  </main>
  <AuthView
    v-else-if="!user || link"
    :key="authViewKey"
    :link="link"
    @authenticated="
      user = $event;
      router.replace({ name: 'today' });
    "
    @link-cleared="clearLink"
  />
  <TimerProvider v-else :key="user.id" :hide-bar="route.meta.immersive">
    <AppNavigation v-if="!route.meta.immersive" />
    <AppShortcuts />

    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        v-bind="
          route.name === 'settings'
            ? { email: user.email, onSignOut: signOut }
            : {}
        "
      />
    </RouterView>
  </TimerProvider>
</template>

<style scoped>
.app-navigation {
  width: min(100% - 2rem, var(--page-width));
  margin: 0 auto;
  padding-top: var(--space-4);
}

.boot-error {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: var(--space-4);
}

.boot-error__card {
  display: grid;
  gap: var(--space-3);
  justify-items: center;
  width: min(100%, 26rem);
  padding: var(--space-6) var(--space-5);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.boot-error__title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.2;
  text-wrap: balance;
}

.boot-error__detail,
.boot-error__line {
  margin: 0;
  max-width: 34ch;
  color: var(--color-ink-muted);
}

.boot-error__detail {
  font-weight: 700;
}

.boot-error .btn--primary {
  margin-top: var(--space-2);
}
</style>
