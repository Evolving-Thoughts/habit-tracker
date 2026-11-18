<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import AppIcon from "./components/AppIcon.vue";
import TimerProvider from "./components/TimerProvider.vue";
import AuthView from "./views/AuthView.vue";
import { getMe, logout } from "./api/auth.api";
import type { User } from "./api/auth.api";
import { VIEWS, type AuthLink } from "./router";

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

/* Wide screens show some Mehr views as tabs, so those render in both places. */
const PRIMARY = VIEWS.filter((view) => view.primary || view.tabWhenWide);
const SECONDARY = VIEWS.filter((view) => !view.primary);
const moreOpen = ref(false);
const moreActive = computed(() =>
  SECONDARY.some(({ name }) => name === route.name),
);
// A new view starts at its top, with the keyboard and screen reader in it.
watch(
  () => route.name,
  async () => {
    moreOpen.value = false;
    await nextTick();
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  },
);
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") moreOpen.value = false;
}
onMounted(() => {
  void load();
  window.addEventListener("auth-expired", expire);
  window.addEventListener("keydown", onKeydown);
});
onUnmounted(() => {
  window.removeEventListener("auth-expired", expire);
  window.removeEventListener("keydown", onKeydown);
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
    <nav v-if="!route.meta.immersive" class="tab-bar" aria-label="Ansichten">
      <div class="tab-bar__inner">
        <RouterLink
          v-for="view in PRIMARY"
          :key="view.name"
          :to="{ name: view.name }"
          class="tab-bar__tab"
          :class="{ 'tab-bar__tab--wide': !view.primary }"
        >
          <AppIcon :name="view.name" />
          <span>{{ view.label }}</span>
        </RouterLink>
        <button
          type="button"
          class="tab-bar__tab tab-bar__more"
          :aria-expanded="moreOpen"
          aria-controls="more-views"
          :data-active="moreActive || undefined"
          @click="moreOpen = !moreOpen"
        >
          <AppIcon name="more" />
          <span>Mehr</span>
        </button>
        <div
          id="more-views"
          class="tab-bar__secondary"
          :data-open="moreOpen || undefined"
        >
          <RouterLink
            v-for="view in SECONDARY"
            :key="view.name"
            :to="{ name: view.name }"
            class="tab-bar__tab"
            :class="{ 'tab-bar__tab--narrow': view.tabWhenWide }"
            :title="view.label"
          >
            <AppIcon :name="view.name" />
            <span>{{ view.label }}</span>
          </RouterLink>
        </div>
      </div>
    </nav>
    <div
      v-if="moreOpen"
      class="tab-bar__scrim"
      aria-hidden="true"
      @click="moreOpen = false"
    />

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

.tab-bar {
  position: fixed;
  inset: auto 0 0;
  z-index: 30;
  padding: 0 var(--space-2) env(safe-area-inset-bottom, 0px);
  background: var(--color-surface);
  box-shadow:
    0 -1px 0 var(--color-line),
    0 -8px 24px rgb(107 50 18 / 8%);
}

.tab-bar__inner {
  position: relative;
  display: flex;
  max-width: var(--page-width);
  margin: 0 auto;
}

.tab-bar__tab {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 0.2rem;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: var(--tab-bar-height);
  padding: var(--space-2) var(--space-1);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.tab-bar__tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bar__tab:active {
  transform: var(--press);
}

.tab-bar__tab[aria-current="page"],
.tab-bar__more[data-active] {
  color: var(--color-action);
}

.tab-bar__tab[aria-current="page"] :deep(svg),
.tab-bar__more[data-active] :deep(svg) {
  stroke-width: 2.4;
}

.tab-bar__secondary {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  display: none;
  flex-direction: column;
  min-width: 14rem;
  padding: var(--space-2);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow:
    var(--shadow-card),
    0 12px 32px rgb(107 50 18 / 16%);
}

.tab-bar__secondary[data-open] {
  display: flex;
}

.tab-bar__secondary .tab-bar__tab {
  flex-direction: row;
  gap: var(--space-3);
  justify-content: flex-start;
  min-height: var(--tap-large);
  padding: 0 var(--space-4);
  font-size: 1rem;
}

.tab-bar__scrim {
  position: fixed;
  inset: 0;
  z-index: 25;
  background: rgb(43 29 22 / 18%);
}

.tab-bar__tab--wide {
  display: none;
}

/* Wide screens have room for every view, so nothing hides behind Mehr. */
@media (min-width: 56rem) {
  .tab-bar {
    inset: 0 0 auto;
    padding: 0 var(--space-4);
    box-shadow: 0 1px 0 var(--color-line);
  }

  .tab-bar__inner {
    max-width: 64rem;
    gap: var(--space-1);
  }

  .tab-bar__tab {
    flex: 0 0 auto;
    flex-direction: row;
    gap: var(--space-2);
    min-height: 3.5rem;
    padding: 0 var(--space-3);
    font-size: 0.9375rem;
  }

  .tab-bar__more,
  .tab-bar__scrim,
  .tab-bar__tab--narrow {
    display: none;
  }

  .tab-bar__tab--wide {
    display: flex;
  }

  .tab-bar__secondary,
  .tab-bar__secondary[data-open] {
    position: static;
    display: flex;
    flex-direction: row;
    min-width: 0;
    padding: 0;
    margin-left: auto;
    border-radius: 0;
    background: none;
    box-shadow: none;
  }

  .tab-bar__secondary .tab-bar__tab {
    gap: var(--space-2);
    min-height: 3.5rem;
    padding: 0 var(--space-3);
    font-size: 0.9375rem;
  }
}

/*
 * Ten views with labels need about 78rem. Below that the rarer views on the
 * right keep only their icon; the name stays for screen readers and on hover.
 */
@media (min-width: 56rem) and (max-width: 81.99rem) {
  .tab-bar__secondary .tab-bar__tab {
    justify-content: center;
    width: var(--tap);
    padding: 0;
  }

  .tab-bar__secondary .tab-bar__tab span {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}

@media (min-width: 82rem) {
  .tab-bar__inner {
    max-width: 80rem;
  }
}
</style>
