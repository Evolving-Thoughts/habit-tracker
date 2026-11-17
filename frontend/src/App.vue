<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppIcon from "./components/AppIcon.vue";
import TimerProvider from "./components/TimerProvider.vue";
import TodoHierarchyView from "./views/TodoHierarchyView.vue";
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
  activeView.value = "today";
}
async function signOut(): Promise<void> {
  try {
    await logout();
    expire();
  } catch (cause) {
    error.value = bootError(cause, "Abmelden hat nicht geklappt.");
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
  { key: "today", label: "Heute", view: TodayView, primary: true },
  {
    key: "todo-dump",
    label: "Todo-Dump",
    short: "Dump",
    view: TodoDumpView,
    primary: true,
  },
  { key: "habits", label: "Habits", view: HabitsView, primary: true },
  { key: "calendar", label: "Kalender", view: CalendarView, primary: true },
  {
    key: "hierarchy",
    label: "Aufgabenbaum",
    view: TodoHierarchyView,
    primary: false,
  },
  {
    key: "categories",
    label: "Kategorien",
    view: CategoriesView,
    primary: false,
  },
] as const;
type ViewKey = (typeof VIEWS)[number]["key"] | "settings";
const PRIMARY = VIEWS.filter((view) => view.primary);
const SECONDARY = VIEWS.filter((view) => !view.primary);
const activeView = ref<ViewKey>(readCalendarReturn() ? "settings" : "today");
const moreOpen = ref(false);
const shownView = computed(
  () => VIEWS.find(({ key }) => key === activeView.value)?.view,
);
const moreActive = computed(
  () =>
    activeView.value === "settings" ||
    SECONDARY.some(({ key }) => key === activeView.value),
);
function show(key: ViewKey): void {
  activeView.value = key;
  moreOpen.value = false;
  window.scrollTo({ top: 0 });
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") moreOpen.value = false;
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
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
      activeView = 'today';
    "
    @link-cleared="clearLink"
  />
  <TimerProvider v-else :key="user.id">
    <nav class="tab-bar" aria-label="Ansichten">
      <div class="tab-bar__inner">
        <button
          v-for="view in PRIMARY"
          :key="view.key"
          type="button"
          class="tab-bar__tab"
          :aria-label="view.label"
          :aria-current="activeView === view.key ? 'page' : undefined"
          @click="show(view.key)"
        >
          <AppIcon :name="view.key" />
          <span class="tab-bar__long">{{ view.label }}</span>
          <span class="tab-bar__short">{{
            "short" in view ? view.short : view.label
          }}</span>
        </button>
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
          <button
            v-for="{ key, label } in SECONDARY"
            :key="key"
            type="button"
            class="tab-bar__tab"
            :aria-current="activeView === key ? 'page' : undefined"
            @click="show(key)"
          >
            <AppIcon :name="key" />
            <span>{{ label }}</span>
          </button>
          <button
            type="button"
            class="tab-bar__tab"
            :aria-current="activeView === 'settings' ? 'page' : undefined"
            @click="show('settings')"
          >
            <AppIcon name="settings" />
            <span>Einstellungen</span>
          </button>
        </div>
      </div>
    </nav>
    <div
      v-if="moreOpen"
      class="tab-bar__scrim"
      aria-hidden="true"
      @click="moreOpen = false"
    />

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
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.tab-bar__tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-bar__long {
  display: none;
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
  .tab-bar__short {
    display: none;
  }

  .tab-bar__long {
    display: inline;
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
</style>
